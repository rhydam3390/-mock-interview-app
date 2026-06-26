const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      enum: [
        "Frontend Developer",
        "Backend Developer",
        "Full Stack Developer",
        "AI/ML Engineer",
        "HR Round",
        "DSA",
      ],
    },
    difficulty: {
      type: String,
      required: true,
      enum: ["Easy", "Medium", "Hard"],
    },
    questionText: {
      type: String,
      required: true,
    },
    category: {
      type: String, // e.g. "React", "Node.js", "System Design", "Behavioural"
      default: "General",
    },
    type: {
      type: String,
      enum: ["mcq", "descriptive"],
      default: "descriptive",
    },
    // Only used when type === "mcq"
    options: {
      type: [String], // e.g. ["Option A", "Option B", "Option C", "Option D"]
      default: undefined,
    },
    correctOptionIndex: {
      type: Number, // index into options[] that is correct
      default: undefined,
    },
    explanation: {
      type: String, // why the correct answer is correct (shown after scoring)
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", questionSchema);