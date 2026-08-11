const Question = require("../models/Question");
const Interview = require("../models/Interview");
const User = require("../models/User");
const { getAIFeedback } = require("../services/aiFeedback");
const { generateQuestionsFromResume } = require("../services/resumeQuestions");
const { extractResumeText } = require("../services/resumeParser");

// @route  POST /api/interview/parse-resume
// Accepts a multipart file upload (field name "resume", PDF or .docx),
// extracts and returns its plain text so the frontend can populate the
// resume textarea without the user having to copy-paste manually.
const parseResumeFile = async (req, res) => {
  try {
    const { text } = await extractResumeText(req.file);
    if (!text || text.length < 50) {
      return res.status(400).json({
        message: "Couldn't find enough readable text in that file — it may be image-based. Try pasting the text instead.",
      });
    }
    res.status(200).json({ success: true, text });
  } catch (error) {
    console.error("Parse resume file error:", error.message);
    res.status(error.status || 500).json({ message: error.message || "Server error parsing resume file" });
  }
};

// @route  GET /api/interview/roles
const getRoles = async (req, res) => {
  try {
    const roles = await Question.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);
    res.status(200).json({ success: true, roles });
  } catch (error) {
    res.status(500).json({ message: "Server error fetching roles" });
  }
};

// Helper: shuffle an array (Fisher-Yates)
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// How many of the user's most recent completed sessions (for the same role +
// difficulty) to avoid repeating questions from. If the question pool is too
// small to satisfy this, we backfill from the full pool rather than fail.
const RECENT_SESSIONS_TO_AVOID = 2;

// @route  POST /api/interview/start
// Body: { role, difficulty, numQuestions }
// Fetches a 50/50 mix of MCQ + Descriptive questions, avoiding ones the user
// was recently asked for this role/difficulty where the pool size allows it.
const startInterview = async (req, res) => {
  try {
    const { role, difficulty, numQuestions = 6 } = req.body;

    if (!role || !difficulty) {
      return res.status(400).json({ message: "Role and difficulty are required" });
    }

    const total = Number(numQuestions);
    const mcqCount = Math.round(total / 2);
    const descCount = total - mcqCount;

    // Gather question IDs the user was already asked in their recent sessions
    // for this same role + difficulty, so we can steer clear of them.
    const recentInterviews = await Interview.find({
      user: req.user._id,
      role,
      difficulty,
      status: "completed",
    })
      .sort({ createdAt: -1 })
      .limit(RECENT_SESSIONS_TO_AVOID)
      .select("answers.questionId");

    const recentlySeenIds = recentInterviews.flatMap((iv) =>
      iv.answers.map((a) => a.questionId).filter(Boolean)
    );

    // Sample a given type/count while excluding recently-seen questions first;
    // if that leaves too few (small pool), backfill from the full pool so an
    // interview never comes back short just because of the exclusion.
    const fetchQuestions = async (type, count) => {
      if (count <= 0) return [];
      let results = await Question.aggregate([
        { $match: { role, difficulty, type, _id: { $nin: recentlySeenIds } } },
        { $sample: { size: count } },
      ]);
      if (results.length < count) {
        const excludeIds = [...recentlySeenIds, ...results.map((q) => q._id)];
        const backfill = await Question.aggregate([
          { $match: { role, difficulty, type, _id: { $nin: excludeIds } } },
          { $sample: { size: count - results.length } },
        ]);
        results = [...results, ...backfill];
      }
      return results;
    };

    const [mcqQuestions, descQuestions] = await Promise.all([
      fetchQuestions("mcq", mcqCount),
      fetchQuestions("descriptive", descCount),
    ]);

    let combined = shuffle([...mcqQuestions, ...descQuestions]);

    if (combined.length < total) {
      const needed = total - combined.length;
      const usedIds = combined.map((q) => q._id);
      const extra = await Question.aggregate([
        { $match: { role, difficulty, _id: { $nin: usedIds } } },
        { $sample: { size: needed } },
      ]);
      combined = shuffle([...combined, ...extra]);
    }

    // If the role's pool at this exact difficulty still isn't enough (e.g.
    // Senior requesting all 50 questions, but "Hard" alone only has ~17),
    // fill the rest from the same role at ANY difficulty so higher levels
    // genuinely get the full breadth of the role's question bank.
    if (combined.length < total) {
      const needed = total - combined.length;
      const usedIds = combined.map((q) => q._id);
      const crossDifficulty = await Question.aggregate([
        { $match: { role, _id: { $nin: usedIds } } },
        { $sample: { size: needed } },
      ]);
      combined = shuffle([...combined, ...crossDifficulty]);
    }

    if (combined.length === 0) {
      return res.status(404).json({ message: "No questions found for this role/difficulty" });
    }

    const interview = await Interview.create({
      user: req.user._id,
      role,
      difficulty,
      answers: combined.map((q) => ({
        questionId: q._id,
        questionText: q.questionText,
        type: q.type,
        category: q.category,
        userAnswer: "",
        score: 0,
        options: q.type === "mcq" ? q.options : undefined,
        correctOptionIndex: q.type === "mcq" ? q.correctOptionIndex : undefined,
        explanation: q.type === "mcq" ? q.explanation : undefined,
        selectedOptionIndex: null,
        isCorrect: null,
      })),
      status: "in-progress",
      mcqTotalCount: combined.filter((q) => q.type === "mcq").length,
    });

    res.status(201).json({
      success: true,
      interviewId: interview._id,
      questions: interview.answers.map((a, idx) => ({
        index: idx,
        questionId: a.questionId,
        questionText: a.questionText,
        type: a.type,
        options: a.options,
      })),
    });
  } catch (error) {
    console.error("Start interview error:", error);
    res.status(500).json({ message: "Server error starting interview" });
  }
};

// @route  GET /api/interview/weak-areas?role=<role>
// Aggregates the user's completed interviews to find which question
// categories they've scored lowest in, so they can retry just those.
const MIN_ANSWERS_FOR_WEAK_AREA = 2; // need at least this many data points to count a category

const getWeakAreas = async (req, res) => {
  try {
    const { role } = req.query;
    if (!role) {
      return res.status(400).json({ message: "Role is required" });
    }

    const interviews = await Interview.find({
      user: req.user._id,
      role,
      status: "completed",
    }).select("answers");

    const byCategory = {};
    interviews.forEach((iv) => {
      iv.answers.forEach((a) => {
        if (!a.category) return;
        if (!byCategory[a.category]) byCategory[a.category] = { total: 0, count: 0 };
        byCategory[a.category].total += a.score || 0;
        byCategory[a.category].count += 1;
      });
    });

    const weakAreas = Object.entries(byCategory)
      .filter(([, stats]) => stats.count >= MIN_ANSWERS_FOR_WEAK_AREA)
      .map(([category, stats]) => ({
        category,
        averageScore: Math.round((stats.total / stats.count) * 10) / 10,
        questionsAnswered: stats.count,
      }))
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 5);

    res.status(200).json({ success: true, weakAreas });
  } catch (error) {
    console.error("Get weak areas error:", error);
    res.status(500).json({ message: "Server error fetching weak areas" });
  }
};

// @route  POST /api/interview/weak-start
// Body: { role, difficulty, categories, numQuestions }
// Starts an interview sampling only from the given weak categories for a role.
const startWeakAreaInterview = async (req, res) => {
  try {
    const { role, difficulty, categories, numQuestions = 6 } = req.body;

    if (!role || !difficulty || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ message: "Role, difficulty, and at least one category are required" });
    }

    const total = Number(numQuestions);
    const pool = await Question.aggregate([
      { $match: { role, difficulty, category: { $in: categories } } },
      { $sample: { size: total } },
    ]);

    let combined = shuffle(pool);

    // Backfill from the same categories at any difficulty if the pool was too small
    if (combined.length < total) {
      const usedIds = combined.map((q) => q._id);
      const backfill = await Question.aggregate([
        { $match: { role, category: { $in: categories }, _id: { $nin: usedIds } } },
        { $sample: { size: total - combined.length } },
      ]);
      combined = shuffle([...combined, ...backfill]);
    }

    if (combined.length === 0) {
      return res.status(404).json({ message: "No questions found for these weak areas" });
    }

    const interview = await Interview.create({
      user: req.user._id,
      role,
      difficulty,
      answers: combined.map((q) => ({
        questionId: q._id,
        questionText: q.questionText,
        type: q.type,
        category: q.category,
        userAnswer: "",
        score: 0,
        options: q.type === "mcq" ? q.options : undefined,
        correctOptionIndex: q.type === "mcq" ? q.correctOptionIndex : undefined,
        explanation: q.type === "mcq" ? q.explanation : undefined,
        selectedOptionIndex: null,
        isCorrect: null,
      })),
      status: "in-progress",
      mcqTotalCount: combined.filter((q) => q.type === "mcq").length,
    });

    res.status(201).json({
      success: true,
      interviewId: interview._id,
      questions: interview.answers.map((a, idx) => ({
        index: idx,
        questionId: a.questionId,
        questionText: a.questionText,
        type: a.type,
        options: a.options,
      })),
    });
  } catch (error) {
    console.error("Start weak-area interview error:", error);
    res.status(500).json({ message: "Server error starting weak-area interview" });
  }
};

// @route  POST /api/interview/full-round-start
// Body: { rounds: [{ role, difficulty, numQuestions }, ...] }
// Chains multiple rounds into ONE interview session. Like a real interview
// day, MCQ correctness is withheld until the whole session is finished
// (see submitAnswer/finishInterview) rather than revealed after each question.
const startFullRoundInterview = async (req, res) => {
  try {
    const { rounds } = req.body;

    if (!Array.isArray(rounds) || rounds.length < 2) {
      return res.status(400).json({ message: "Full round simulation needs at least 2 rounds" });
    }

    const roundResults = await Promise.all(
      rounds.map(async (round, roundIndex) => {
        const total = Number(round.numQuestions) || 4;
        const mcqCount = Math.round(total / 2);
        const descCount = total - mcqCount;

        const [mcqQuestions, descQuestions] = await Promise.all([
          Question.aggregate([
            { $match: { role: round.role, difficulty: round.difficulty, type: "mcq" } },
            { $sample: { size: mcqCount } },
          ]),
          Question.aggregate([
            { $match: { role: round.role, difficulty: round.difficulty, type: "descriptive" } },
            { $sample: { size: descCount } },
          ]),
        ]);

        const roundQuestions = shuffle([...mcqQuestions, ...descQuestions]);
        return roundQuestions.map((q) => ({
          questionId: q._id,
          questionText: q.questionText,
          type: q.type,
          category: q.category,
          roundRole: round.role,
          roundIndex,
          userAnswer: "",
          score: 0,
          options: q.type === "mcq" ? q.options : undefined,
          correctOptionIndex: q.type === "mcq" ? q.correctOptionIndex : undefined,
          explanation: q.type === "mcq" ? q.explanation : undefined,
          selectedOptionIndex: null,
          isCorrect: null,
        }));
      })
    );

    const allAnswers = roundResults.flat();

    if (allAnswers.length === 0) {
      return res.status(404).json({ message: "No questions found for these rounds" });
    }

    const interview = await Interview.create({
      user: req.user._id,
      role: rounds.map((r) => r.role).join(" + "),
      difficulty: "Mixed",
      answers: allAnswers,
      status: "in-progress",
      mcqTotalCount: allAnswers.filter((a) => a.type === "mcq").length,
      isFullRound: true,
      rounds: rounds.map((r) => ({ role: r.role, difficulty: r.difficulty })),
    });

    res.status(201).json({
      success: true,
      interviewId: interview._id,
      questions: interview.answers.map((a, idx) => ({
        index: idx,
        questionId: a.questionId,
        questionText: a.questionText,
        type: a.type,
        options: a.options,
        roundRole: a.roundRole,
        roundIndex: a.roundIndex,
      })),
    });
  } catch (error) {
    console.error("Start full-round interview error:", error);
    res.status(500).json({ message: "Server error starting full-round interview" });
  }
};

// @route  POST /api/interview/resume-start
// Body: { resumeText, jobDescription, difficulty, numQuestions }
// Generates interview questions tailored to the candidate's actual resume
// (and optional target job description) via AI, saves them as real Question
// documents under the "Resume-Based" role, then starts an interview session
// using the exact same flow (answer/finish/results) as a normal interview.
const startResumeInterview = async (req, res) => {
  try {
    const { resumeText, jobDescription, difficulty = "Medium", numQuestions = 6 } = req.body;

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ message: "Please paste your full resume text (at least a few sentences)." });
    }

    let generated;
    try {
      generated = await generateQuestionsFromResume({
        resumeText,
        jobDescription,
        difficulty,
        numQuestions: Number(numQuestions),
      });
    } catch (genError) {
      console.error("Resume question generation error:", genError.message);
      return res.status(genError.status || 502).json({
        message: "Couldn't generate questions from your resume right now. Please try again in a moment.",
      });
    }

    const inserted = await Question.insertMany(generated);
    const combined = shuffle(inserted);

    const interview = await Interview.create({
      user: req.user._id,
      role: "Resume-Based",
      difficulty,
      answers: combined.map((q) => ({
        questionId: q._id,
        questionText: q.questionText,
        type: q.type,
        category: q.category,
        userAnswer: "",
        score: 0,
        options: q.type === "mcq" ? q.options : undefined,
        correctOptionIndex: q.type === "mcq" ? q.correctOptionIndex : undefined,
        explanation: q.type === "mcq" ? q.explanation : undefined,
        selectedOptionIndex: null,
        isCorrect: null,
      })),
      status: "in-progress",
      mcqTotalCount: combined.filter((q) => q.type === "mcq").length,
    });

    res.status(201).json({
      success: true,
      interviewId: interview._id,
      questions: interview.answers.map((a, idx) => ({
        index: idx,
        questionId: a.questionId,
        questionText: a.questionText,
        type: a.type,
        options: a.options,
      })),
    });
  } catch (error) {
    console.error("Start resume interview error:", error);
    res.status(500).json({ message: "Server error starting resume-based interview" });
  }
};

// @route  POST /api/interview/:id/answer
const submitAnswer = async (req, res) => {
  try {
    const { id } = req.params;
    const { questionIndex, answerText, selectedOptionIndex } = req.body;

    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    if (interview.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized for this interview" });
    }

    if (questionIndex < 0 || questionIndex >= interview.answers.length) {
      return res.status(400).json({ message: "Invalid question index" });
    }

    const answer = interview.answers[questionIndex];

    if (answer.type === "mcq") {
      answer.selectedOptionIndex = selectedOptionIndex;
      answer.isCorrect = selectedOptionIndex === answer.correctOptionIndex;
      answer.score = answer.isCorrect ? 10 : 0;
      answer.verdict = answer.isCorrect ? "Good" : "Needs Work";
    } else {
      answer.userAnswer = answerText || "";
    }

    await interview.save();

    res.status(200).json({
      success: true,
      message: "Answer saved",
      // In full-round simulation mode, don't reveal correctness immediately —
      // it stays hidden until the whole session finishes, like a real interview.
      ...(answer.type === "mcq" && !interview.isFullRound && {
        isCorrect: answer.isCorrect,
        correctOptionIndex: answer.correctOptionIndex,
        explanation: answer.explanation,
      }),
    });
  } catch (error) {
    console.error("Submit answer error:", error);
    res.status(500).json({ message: "Server error saving answer" });
  }
};

// @route  POST /api/interview/:id/finish
// Now calls the AI feedback engine for every descriptive answer before finishing
// @route  POST /api/interview/:id/abandon
// Ends a session early without generating AI feedback — used by the "End
// Session" button. No score is computed; the session is marked abandoned so
// it's excluded from History/Prep Report stats, unlike a completed session.
const abandonInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }
    if (interview.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized for this interview" });
    }
    if (interview.status === "in-progress") {
      interview.status = "abandoned";
      await interview.save();
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Abandon interview error:", error);
    res.status(500).json({ message: "Server error ending session" });
  }
};

const finishInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const { durationSeconds } = req.body;

    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    if (interview.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized for this interview" });
    }

    // Run AI feedback for all descriptive answers IN PARALLEL (much faster than one-by-one)
    const descriptiveIndexes = [];
    const feedbackPromises = [];

    interview.answers.forEach((a, idx) => {
      if (a.type === "descriptive") {
        descriptiveIndexes.push(idx);
        feedbackPromises.push(
          getAIFeedback(a.questionText, a.userAnswer, interview.role, interview.difficulty)
        );
      }
    });

    const feedbackResults = await Promise.all(feedbackPromises);

    // Apply the AI feedback results back onto the matching answers
    descriptiveIndexes.forEach((answerIdx, i) => {
      const feedback = feedbackResults[i];
      const answer = interview.answers[answerIdx];
      answer.score = feedback.score;
      answer.strengths = feedback.strengths;
      answer.improvements = feedback.improvements;
      answer.idealAnswerSummary = feedback.idealAnswerSummary;
      answer.idealAnswerReasoning = feedback.idealAnswerReasoning;
      answer.verdict = feedback.verdict;
    });

    // Calculate MCQ stats
    const mcqAnswers = interview.answers.filter((a) => a.type === "mcq");
    const mcqCorrect = mcqAnswers.filter((a) => a.isCorrect).length;

    // Overall score = average of all question scores (MCQ scored 0 or 10, descriptive scored 1-10 by AI)
    const allScores = interview.answers.map((a) => a.score || 0);
    const overallScore = allScores.length
      ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
      : 0;

    interview.status = "completed";
    interview.durationSeconds = durationSeconds || 0;
    interview.mcqCorrectCount = mcqCorrect;
    interview.mcqTotalCount = mcqAnswers.length;
    interview.overallScore = overallScore;
    await interview.save();

    // Update user's running average score + total interviews
    const user = await User.findById(req.user._id);
    const prevTotal = user.totalInterviews || 0;
    const prevAvg = user.averageScore || 0;
    user.averageScore = Math.round(((prevAvg * prevTotal + overallScore) / (prevTotal + 1)) * 10) / 10;
    user.totalInterviews = prevTotal + 1;
    await user.save();

    res.status(200).json({ success: true, interview });
  } catch (error) {
    console.error("Finish interview error:", error);
    res.status(500).json({ message: "Server error finishing interview" });
  }
};

// @route  GET /api/interview/history
const getHistory = async (req, res) => {
  try {
    const limit = Math.min(200, Number(req.query.limit) || 20);
    const interviews = await Interview.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({ success: true, interviews });
  } catch (error) {
    res.status(500).json({ message: "Server error fetching history" });
  }
};

// @route  GET /api/interview/:id
const getInterviewById = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }
    if (interview.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    res.status(200).json({ success: true, interview });
  } catch (error) {
    res.status(500).json({ message: "Server error fetching interview" });
  }
};

module.exports = {
  getRoles,
  startInterview,
  startResumeInterview,
  parseResumeFile,
  getWeakAreas,
  startWeakAreaInterview,
  startFullRoundInterview,
  submitAnswer,
  abandonInterview,
  finishInterview,
  getHistory,
  getInterviewById,
};