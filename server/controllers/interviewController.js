const Question = require("../models/Question");
const Interview = require("../models/Interview");
const User = require("../models/User");
const { getAIFeedback } = require("../services/aiFeedback");

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

// @route  POST /api/interview/start
// Body: { role, difficulty, numQuestions }
// Fetches a 50/50 mix of MCQ + Descriptive questions
const startInterview = async (req, res) => {
  try {
    const { role, difficulty, numQuestions = 6 } = req.body;

    if (!role || !difficulty) {
      return res.status(400).json({ message: "Role and difficulty are required" });
    }

    const total = Number(numQuestions);
    const mcqCount = Math.round(total / 2);
    const descCount = total - mcqCount;

    const [mcqQuestions, descQuestions] = await Promise.all([
      Question.aggregate([
        { $match: { role, difficulty, type: "mcq" } },
        { $sample: { size: mcqCount } },
      ]),
      Question.aggregate([
        { $match: { role, difficulty, type: "descriptive" } },
        { $sample: { size: descCount } },
      ]),
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
      ...(answer.type === "mcq" && {
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
    const interviews = await Interview.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

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
  submitAnswer,
  finishInterview,
  getHistory,
  getInterviewById,
};