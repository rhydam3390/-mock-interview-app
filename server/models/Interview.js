const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
  questionText: String,
  type: { type: String, enum: ["mcq", "descriptive"], default: "descriptive" },

  // Descriptive fields
  userAnswer: { type: String, default: "" },
  score: { type: Number, default: 0 }, // 1-10
  strengths: [String],
  improvements: [String],
  idealAnswerSummary: String,
  verdict: { type: String, enum: ["Good", "Average", "Needs Work"], default: "Average" },

  // MCQ fields
  options: [String],
  correctOptionIndex: Number,
  selectedOptionIndex: { type: Number, default: null },
  isCorrect: { type: Boolean, default: null },
  explanation: String,
});

const interviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, required: true },
    difficulty: { type: String, required: true },
    answers: [answerSchema],
    overallScore: { type: Number, default: 0 },
    mcqCorrectCount: { type: Number, default: 0 },
    mcqTotalCount: { type: Number, default: 0 },
    status: { type: String, enum: ["in-progress", "completed"], default: "in-progress" },
    durationSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Interview", interviewSchema);