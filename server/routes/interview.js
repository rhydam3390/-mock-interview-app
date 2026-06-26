const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getRoles,
  startInterview,
  submitAnswer,
  finishInterview,
  getHistory,
  getInterviewById,
} = require("../controllers/interviewController");

router.get("/roles", protect, getRoles);
router.post("/start", protect, startInterview);
router.post("/:id/answer", protect, submitAnswer);
router.post("/:id/finish", protect, finishInterview);
router.get("/history", protect, getHistory);
router.get("/:id", protect, getInterviewById);

module.exports = router;