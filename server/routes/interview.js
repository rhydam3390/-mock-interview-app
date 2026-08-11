const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect } = require("../middleware/authMiddleware");
const {
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
} = require("../controllers/interviewController");

// In-memory storage — we only need the file briefly to extract text, no need
// to persist it to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

router.get("/roles", protect, getRoles);
router.post("/start", protect, startInterview);
router.post("/resume-start", protect, startResumeInterview);
router.post("/parse-resume", protect, upload.single("resume"), parseResumeFile);
router.get("/weak-areas", protect, getWeakAreas);
router.post("/weak-start", protect, startWeakAreaInterview);
router.post("/full-round-start", protect, startFullRoundInterview);
router.post("/:id/answer", protect, submitAnswer);
router.post("/:id/abandon", protect, abandonInterview);
router.post("/:id/finish", protect, finishInterview);
router.get("/history", protect, getHistory);
router.get("/:id", protect, getInterviewById);

module.exports = router;