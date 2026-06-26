import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/interview.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SECONDS_PER_QUESTION = 120; // 2 minutes per question
const MCQ_REVEAL_DELAY = 1800; // ms to show right/wrong before auto-advancing

const Interview = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState(null);
  const [mcqResult, setMcqResult] = useState(null); // { isCorrect, correctOptionIndex, explanation }
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const res = await fetch(`${API_URL}/interview/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        setQuestions(data.interview.answers);
      } catch (err) {
        setError(err.message || "Could not load interview");
      } finally {
        setLoading(false);
      }
    };
    fetchInterview();
  }, [id, token]);

  // Timer countdown — paused while showing MCQ result
  useEffect(() => {
    if (loading || questions.length === 0 || mcqResult) return;
    setTimeLeft(SECONDS_PER_QUESTION);
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleNext(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, loading, questions.length, mcqResult]);

  const currentQ = questions[currentIndex];
  const isMCQ = currentQ?.type === "mcq";

  const goToNextOrFinish = () => {
    setMcqResult(null);
    setSelectedOption(null);
    setAnswer("");
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      finishInterview();
    }
  };

  const handleNext = async (isAutoSkip = false) => {
    if (isMCQ) {
      // If time ran out with nothing selected, just move on
      if (selectedOption === null && isAutoSkip) {
        goToNextOrFinish();
        return;
      }
      return; // MCQ advances via handleOptionSelect, not this button
    }

    // Descriptive question
    try {
      await fetch(`${API_URL}/interview/${id}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questionIndex: currentIndex, answerText: answer.trim() }),
      });
    } catch {
      // fail silently, still advance locally
    }
    goToNextOrFinish();
  };

  const handleOptionSelect = async (optIndex) => {
    if (mcqResult) return; // already answered, ignore further clicks
    setSelectedOption(optIndex);

    try {
      const res = await fetch(`${API_URL}/interview/${id}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questionIndex: currentIndex, selectedOptionIndex: optIndex }),
      });
      const data = await res.json();
      setMcqResult({
        isCorrect: data.isCorrect,
        correctOptionIndex: data.correctOptionIndex,
        explanation: data.explanation,
      });
    } catch {
      setMcqResult({ isCorrect: optIndex === currentQ.correctOptionIndex, correctOptionIndex: currentQ.correctOptionIndex, explanation: "" });
    }

    setTimeout(() => {
      goToNextOrFinish();
    }, MCQ_REVEAL_DELAY);
  };

  const finishInterview = async () => {
    setSubmitting(true);
    const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    try {
      await fetch(`${API_URL}/interview/${id}/finish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ durationSeconds }),
      });
      navigate(`/results/${id}`);
    } catch {
      setError("Could not finish interview. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="interview-page-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="interview-page-loading">
        <div className="auth-error">{error}</div>
      </div>
    );
  }

  const progressPct = ((currentIndex + 1) / questions.length) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="interview-bg">
      {submitting && (
        <div className="ai-analyzing-overlay">
          <div className="ai-analyzing-box">
            <div className="ai-pulse-icon">🤖</div>
            <h2>AI is analyzing your answers...</h2>
            <p>This usually takes 10-20 seconds. Scoring each descriptive answer for accuracy, clarity, and completeness.</p>
            <div className="spinner" style={{ margin: "1.2rem auto 0" }} />
          </div>
        </div>
      )}

      <div className="interview-wrap">
        <div className="interview-header">
          <div className="interview-meta">
            <span className="meta-role">
              {isMCQ ? "🔘 MCQ" : "✍️ Descriptive"} — Question {currentIndex + 1} of {questions.length}
            </span>
          </div>
          <div className={`timer-badge ${timeLeft <= 20 ? "timer-warning" : ""}`}>
            ⏱ {minutes}:{seconds.toString().padStart(2, "0")}
          </div>
        </div>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="question-card">
          <div className="q-number">Question {String(currentIndex + 1).padStart(2, "0")}</div>
          <div className="q-text">{currentQ?.questionText}</div>
        </div>

        {isMCQ ? (
          <div className="mcq-options">
            {currentQ.options.map((opt, idx) => {
              let optClass = "mcq-option";
              if (mcqResult) {
                if (idx === mcqResult.correctOptionIndex) optClass += " mcq-correct";
                else if (idx === selectedOption) optClass += " mcq-wrong";
              } else if (idx === selectedOption) {
                optClass += " mcq-selected";
              }
              return (
                <button
                  key={idx}
                  className={optClass}
                  onClick={() => handleOptionSelect(idx)}
                  disabled={!!mcqResult}
                >
                  <span className="mcq-letter">{String.fromCharCode(65 + idx)}</span>
                  {opt}
                </button>
              );
            })}

            {mcqResult && (
              <div className={`mcq-feedback ${mcqResult.isCorrect ? "mcq-feedback-good" : "mcq-feedback-bad"}`}>
                {mcqResult.isCorrect ? "✅ Correct!" : "❌ Not quite."} {mcqResult.explanation}
              </div>
            )}
          </div>
        ) : (
          <>
            <textarea
              className="answer-area"
              placeholder="Type your answer here... Be specific and use examples where possible."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <div className="answer-actions">
              <span className="word-count">{answer.trim().split(/\s+/).filter(Boolean).length} words</span>
              <button className="next-btn" onClick={() => handleNext(false)} disabled={submitting}>
                {submitting
                  ? "Finishing..."
                  : currentIndex < questions.length - 1
                  ? "Next Question →"
                  : "Finish Interview ✓"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Interview;