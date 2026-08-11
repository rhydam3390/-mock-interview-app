// This file handles all communication with the Gemini API
// to score descriptive interview answers.

const GEMINI_MODEL = "gemini-2.5-flash"; // free tier model
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500; // wait 1.5s between retries

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Calls Gemini once. Throws on failure so callGeminiWithRetry can catch and retry.
// `maxOutputTokens` is configurable per-call since some prompts (e.g. generating
// several full questions) need much more room than a single short feedback object.
const callGeminiOnce = async (prompt, maxOutputTokens = 2048) => {
  const response = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    const error = new Error(`Gemini API returned status ${response.status}`);
    error.status = response.status;
    error.body = errText;
    throw error;
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleanText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(cleanText);
  } catch (parseError) {
    console.error("Initial JSON parse failed, attempting repair:", parseError.message);

    // If this looks like a truncated array of objects (our question-generation
    // case), the most reliable repair is to trim back to the last FULLY
    // complete object and close the array there — rather than guessing how
    // to patch whatever the response was cut off in the middle of.
    if (cleanText.startsWith("[")) {
      const arrayRepaired = repairTruncatedArray(cleanText);
      if (arrayRepaired !== null) {
        try {
          return JSON.parse(arrayRepaired);
        } catch {
          // fall through to the generic repair below as a last resort
        }
      }
    }

    // Generic repair for a single truncated object: close any unterminated
    // string and any open arrays/objects, then retry parsing.
    let repaired = cleanText;
    const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      repaired += '"';
    }
    const openBraces = (repaired.match(/{/g) || []).length;
    const closeBraces = (repaired.match(/}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/]/g) || []).length;
    repaired += "]".repeat(Math.max(0, openBrackets - closeBrackets));
    repaired += "}".repeat(Math.max(0, openBraces - closeBraces));

    return JSON.parse(repaired); // if this also fails, it throws and triggers a retry
  }
};

// Scans a truncated JSON array-of-objects string and trims it back to the end
// of the last fully-balanced object, then closes the array. Returns null if
// no complete object could be found. This is far more reliable than blind
// quote/bracket closing when the cutoff happens mid-property rather than
// mid-string.
const repairTruncatedArray = (text) => {
  let depth = 0;
  let inString = false;
  let escape = false;
  let lastCompleteObjectEnd = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) lastCompleteObjectEnd = i;
    }
  }

  if (lastCompleteObjectEnd === -1) return null;
  return text.slice(0, lastCompleteObjectEnd + 1) + "]";
};

// Retries automatically on 503 (server overloaded) or 429 (rate limited)
const callGeminiWithRetry = async (prompt, maxOutputTokens = 2048) => {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callGeminiOnce(prompt, maxOutputTokens);
    } catch (error) {
      lastError = error;
      const isRetryable = error.status === 503 || error.status === 429 || error instanceof SyntaxError;
      console.error(`Gemini API attempt ${attempt} failed:`, error.status || error.name, error.body || error.message);

      if (isRetryable && attempt < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY_MS / 1000}s... (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      break;
    }
  }
  throw lastError;
};

const getAIFeedback = async (questionText, userAnswer, role, difficulty) => {
  if (!userAnswer || userAnswer.trim().length === 0) {
    return {
      score: 0,
      strengths: [],
      improvements: ["No answer was provided for this question."],
      idealAnswerSummary: "Try to attempt every question, even with a partial answer.",
      idealAnswerReasoning: "",
      verdict: "Needs Work",
    };
  }

  const prompt = `You are an expert technical interviewer evaluating a candidate's answer for a ${role} position (${difficulty} difficulty level).

Question: ${questionText}

Candidate's Answer: ${userAnswer}

Evaluate this answer and respond with ONLY a valid JSON object in this exact format, with no other text before or after, and no markdown code fences:
{
  "score": <integer from 1 to 10>,
  "strengths": ["short strength point (max 10 words)", "short strength point (max 10 words)"],
  "improvements": ["short improvement point (max 10 words)", "short improvement point (max 10 words)"],
  "idealAnswerSummary": "A brief 1-2 sentence summary of the ideal answer, max 30 words",
  "idealAnswerReasoning": "2-4 sentences explaining WHY the ideal answer is structured that way — what a real interviewer is specifically listening for, what separates a strong answer from a weak one on THIS question, and what makes this candidate's answer fall short of or meet that bar. Max 80 words. Be concrete and specific to this question, not generic advice.",
  "verdict": "Good" or "Average" or "Needs Work"
}

Keep strengths/improvements SHORT (max 2 each). idealAnswerSummary and idealAnswerReasoning are the only fields that should have real substance — the reasoning field is for teaching the candidate how an interviewer actually thinks, not just restating the correct content.

Scoring guide:
- 8-10 (Good): Accurate, complete, well-explained, uses relevant examples
- 5-7 (Average): Mostly correct but missing depth, examples, or has minor inaccuracies
- 1-4 (Needs Work): Incorrect, very incomplete, or shows fundamental misunderstanding

Be fair but honest — this feedback genuinely helps the candidate improve.`;

  try {
    // Slightly higher budget than before since idealAnswerReasoning adds real length
    const feedback = await callGeminiWithRetry(prompt, 1400);

    feedback.score = Math.max(1, Math.min(10, Number(feedback.score) || 5));
    feedback.strengths = Array.isArray(feedback.strengths) ? feedback.strengths : [];
    feedback.improvements = Array.isArray(feedback.improvements) ? feedback.improvements : [];
    feedback.idealAnswerSummary = feedback.idealAnswerSummary || "";
    feedback.idealAnswerReasoning = feedback.idealAnswerReasoning || "";
    feedback.verdict = ["Good", "Average", "Needs Work"].includes(feedback.verdict)
      ? feedback.verdict
      : "Average";

    return feedback;
  } catch (error) {
    console.error("AI feedback error (after retries):", error.message);
    return {
      score: 5,
      strengths: ["Answer was submitted."],
      improvements: ["AI feedback temporarily unavailable — Gemini's free servers were busy. Please try this interview again in a moment."],
      idealAnswerSummary: "",
      idealAnswerReasoning: "",
      verdict: "Average",
    };
  }
};

module.exports = { getAIFeedback, callGeminiWithRetry };