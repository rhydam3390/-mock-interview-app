// This file handles all communication with the Gemini API
// to score descriptive interview answers.

const GEMINI_MODEL = "gemini-2.5-flash"; // free tier model
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500; // wait 1.5s between retries

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Calls Gemini once. Throws on failure so callGeminiWithRetry can catch and retry.
const callGeminiOnce = async (prompt) => {
  const response = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
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
    // The response may have been cut off mid-string. Try a simple repair:
    // close any unterminated string and the object itself, then retry parsing.
    console.error("Initial JSON parse failed, attempting repair:", parseError.message);
    let repaired = cleanText;

    // If it ends mid-string (odd number of unescaped quotes), close the string
    const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      repaired += '"';
    }
    // Close any open arrays/objects
    const openBraces = (repaired.match(/{/g) || []).length;
    const closeBraces = (repaired.match(/}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/]/g) || []).length;
    repaired += "]".repeat(Math.max(0, openBrackets - closeBrackets));
    repaired += "}".repeat(Math.max(0, openBraces - closeBraces));

    return JSON.parse(repaired); // if this also fails, it throws and triggers a retry
  }
};

// Retries automatically on 503 (server overloaded) or 429 (rate limited)
const callGeminiWithRetry = async (prompt) => {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callGeminiOnce(prompt);
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
      verdict: "Needs Work",
    };
  }

  const prompt = `You are an expert technical interviewer evaluating a candidate's answer for a ${role} position (${difficulty} difficulty level).

Question: ${questionText}

Candidate's Answer: ${userAnswer}

Evaluate this answer and respond with ONLY a valid JSON object in this exact format, with no other text before or after, and no markdown code fences. Keep every text field SHORT and concise — this is critical:
{
  "score": <integer from 1 to 10>,
  "strengths": ["short strength point (max 10 words)", "short strength point (max 10 words)"],
  "improvements": ["short improvement point (max 10 words)", "short improvement point (max 10 words)"],
  "idealAnswerSummary": "A brief 1-2 sentence summary, max 30 words",
  "verdict": "Good" or "Average" or "Needs Work"
}

Keep the ENTIRE response compact — no extra text, no long explanations. Maximum 2 strengths and 2 improvements.

Scoring guide:
- 8-10 (Good): Accurate, complete, well-explained, uses relevant examples
- 5-7 (Average): Mostly correct but missing depth, examples, or has minor inaccuracies
- 1-4 (Needs Work): Incorrect, very incomplete, or shows fundamental misunderstanding

Be fair but honest — this feedback genuinely helps the candidate improve.`;

  try {
    const feedback = await callGeminiWithRetry(prompt);

    feedback.score = Math.max(1, Math.min(10, Number(feedback.score) || 5));
    feedback.strengths = Array.isArray(feedback.strengths) ? feedback.strengths : [];
    feedback.improvements = Array.isArray(feedback.improvements) ? feedback.improvements : [];
    feedback.idealAnswerSummary = feedback.idealAnswerSummary || "";
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
      verdict: "Average",
    };
  }
};

module.exports = { getAIFeedback };