// This file handles generating interview questions tailored to a specific
// candidate's resume (and optionally a target job description), using the
// same Gemini integration as the AI feedback engine.

const { callGeminiWithRetry } = require("./aiFeedback");

// Keep resume/JD input bounded so prompts stay reasonably sized and cheap.
const MAX_RESUME_CHARS = 6000;
const MAX_JD_CHARS = 3000;

const buildPrompt = (resumeText, jobDescription, difficulty, numQuestions) => {
  const mcqCount = Math.round(numQuestions / 2);
  const descCount = numQuestions - mcqCount;

  return `You are an expert technical interviewer preparing a mock interview tailored to ONE specific candidate.

Below is the candidate's resume${jobDescription ? " and the job description they're targeting" : ""}. Read it carefully and generate interview questions that specifically reference the candidate's actual projects, skills, tools, and experience listed — not generic questions that could apply to anyone in their field.

RESUME:
"""
${resumeText}
"""
${jobDescription ? `\nTARGET JOB DESCRIPTION:\n"""\n${jobDescription}\n"""\n` : ""}

Generate exactly ${numQuestions} interview questions at a ${difficulty} difficulty level: ${mcqCount} multiple-choice questions and ${descCount} descriptive (open-ended) questions.

At least half the questions should directly reference something specific from the resume (a named project, technology, role, or achievement) — for example "You mention working on [specific project] — walk me through..." rather than a generic question about the general topic.

Respond with ONLY a valid JSON array in this exact format, no markdown code fences, no text before or after:
[
  {
    "type": "mcq",
    "category": "short topic label",
    "questionText": "the question",
    "options": ["option A", "option B", "option C", "option D"],
    "correctOptionIndex": 0,
    "explanation": "brief explanation of the correct answer, max 25 words"
  },
  {
    "type": "descriptive",
    "category": "short topic label",
    "questionText": "the question, ideally referencing something specific from the resume"
  }
]

Rules:
- "type" must be exactly "mcq" or "descriptive"
- mcq questions must have exactly 4 options and a valid correctOptionIndex (0-3)
- descriptive questions must NOT include "options" or "correctOptionIndex" fields
- Keep questionText under 40 words
- Do not invent skills/projects the candidate didn't mention — only reference what's actually in the resume`;
};

// Validates and sanitizes one generated question object. Returns null if it's
// too malformed to safely use (rather than throwing and failing the whole batch).
const sanitizeQuestion = (q, difficulty) => {
  if (!q || typeof q !== "object") return null;
  if (!q.questionText || typeof q.questionText !== "string") return null;

  const type = q.type === "mcq" ? "mcq" : q.type === "descriptive" ? "descriptive" : null;
  if (!type) return null;

  const base = {
    role: "Resume-Based",
    difficulty,
    type,
    category: typeof q.category === "string" && q.category.trim() ? q.category.trim() : "Resume",
    questionText: q.questionText.trim(),
  };

  if (type === "mcq") {
    if (!Array.isArray(q.options) || q.options.length !== 4) return null;
    const correctOptionIndex = Number(q.correctOptionIndex);
    if (!Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex > 3) return null;
    return {
      ...base,
      options: q.options.map((o) => String(o)),
      correctOptionIndex,
      explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
    };
  }

  return base;
};

// Generates and validates a set of resume-tailored questions.
// Returns an array of sanitized question objects ready for Question.insertMany().
// Throws if generation fails outright (caller should surface a clear error to the user).
const generateQuestionsFromResume = async ({ resumeText, jobDescription, difficulty, numQuestions }) => {
  const trimmedResume = (resumeText || "").trim().slice(0, MAX_RESUME_CHARS);
  const trimmedJD = (jobDescription || "").trim().slice(0, MAX_JD_CHARS);

  if (trimmedResume.length < 50) {
    const err = new Error("Resume text is too short to generate meaningful questions.");
    err.status = 400;
    throw err;
  }

  const prompt = buildPrompt(trimmedResume, trimmedJD, difficulty, numQuestions);

  // Each generated question (especially MCQs with 4 options + explanation) needs
  // real room — scale the token budget with question count so responses don't
  // get cut off mid-JSON, which was causing repeated parse failures.
  const maxOutputTokens = Math.min(8192, 800 + numQuestions * 260);
  const raw = await callGeminiWithRetry(prompt, maxOutputTokens);

  if (!Array.isArray(raw)) {
    throw new Error("AI did not return a valid question list.");
  }

  const sanitized = raw
    .map((q) => sanitizeQuestion(q, difficulty))
    .filter(Boolean);

  if (sanitized.length === 0) {
    throw new Error("AI response did not contain any usable questions.");
  }

  return sanitized;
};

module.exports = { generateQuestionsFromResume };