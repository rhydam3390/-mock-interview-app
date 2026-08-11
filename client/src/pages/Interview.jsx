import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Circle, PenLine, Sparkles, Check, X, ArrowRight, ArrowLeft, Mic, MicOff, LogOut, Zap, Clock } from "lucide-react";
import "../styles/interview.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const MCQ_REVEAL_DELAY = 4000; // ms to show the explanation before auto-advancing

const formatElapsed = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const Interview = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [isFullRound, setIsFullRound] = useState(false);
  const [rounds, setRounds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false); // finishing the whole interview
  const [savingAnswer, setSavingAnswer] = useState(false); // saving current answer while navigating
  const [error, setError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef(Date.now());

  // Voice input (Web Speech API) — Chrome/Edge support it, others may not
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef(null);
  const answerBeforeListeningRef = useRef("");
  const SpeechRecognitionAPI =
    typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const voiceSupported = !!SpeechRecognitionAPI;

  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const res = await fetch(`${API_URL}/interview/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        setQuestions(data.interview.answers);
        setIsFullRound(!!data.interview.isFullRound);
        setRounds(data.interview.rounds || []);
      } catch (err) {
        setError(err.message || "Could not load interview");
      } finally {
        setLoading(false);
      }
    };
    fetchInterview();
  }, [id, token]);

  // Elapsed time counter — informational only, no limit and no auto-submit
  useEffect(() => {
    const t = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const currentQ = questions[currentIndex];
  const isMCQ = currentQ?.type === "mcq";
  const answer = currentQ?.localAnswerText ?? currentQ?.userAnswer ?? "";
  const selectedOption = currentQ?.localSelectedOption ?? currentQ?.selectedOptionIndex ?? null;
  const mcqResult = currentQ?.localMcqResult ?? null;

  // Updates one question's local draft/answer state in place
  const updateQuestionLocal = (idx, patch) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  };

  const saveDescriptiveAnswer = async (idx, text) => {
    setSavingAnswer(true);
    try {
      await fetch(`${API_URL}/interview/${id}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questionIndex: idx, answerText: text.trim() }),
      });
    } catch {
      // fail silently — the local draft is still preserved for the session
    } finally {
      setSavingAnswer(false);
    }
  };

  // Free navigation — jump to any question, saving the current descriptive
  // draft first so nothing is lost.
  const goToIndex = async (newIndex) => {
    if (newIndex < 0 || newIndex >= questions.length || newIndex === currentIndex) return;
    if (!isMCQ) {
      await saveDescriptiveAnswer(currentIndex, answer);
      updateQuestionLocal(currentIndex, { answered: answer.trim().length > 0 });
    }
    setCurrentIndex(newIndex);
  };

  const handlePrevious = () => goToIndex(currentIndex - 1);
  const handleNextNav = () => goToIndex(currentIndex + 1);

  const goToNextOrFinish = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      finishInterview();
    }
  };

  const handleDone = async () => {
    if (isMCQ) return; // MCQ advances via handleOptionSelect, not this button
    await saveDescriptiveAnswer(currentIndex, answer);
    updateQuestionLocal(currentIndex, { answered: answer.trim().length > 0 });
    goToNextOrFinish();
  };

  const toggleListening = () => {
    if (!voiceSupported) return;
    setVoiceError("");

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    const listeningIndex = currentIndex;
    answerBeforeListeningRef.current = answer;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const base = answerBeforeListeningRef.current;
      updateQuestionLocal(listeningIndex, { localAnswerText: base ? `${base} ${transcript}` : transcript });
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoiceError("Microphone access was blocked — check your browser's site permissions.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setVoiceError("Voice input hit a snag — you can keep typing instead.");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleEndSession = async () => {
    const confirmed = window.confirm(
      "End this session now? Your progress won't be scored, and this session won't count toward your history."
    );
    if (!confirmed) return;

    try {
      await fetch(`${API_URL}/interview/${id}/abandon`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // best-effort — navigate away regardless
    }
    navigate("/dashboard");
  };

  // Stop any active recognition when moving to a new question or leaving the page
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, [currentIndex]);

  const handleOptionSelect = async (optIndex) => {
    if (mcqResult || (isFullRound && selectedOption !== null)) return; // already answered, ignore further clicks
    const answerIndex = currentIndex;
    updateQuestionLocal(answerIndex, { localSelectedOption: optIndex });

    try {
      const res = await fetch(`${API_URL}/interview/${id}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questionIndex: answerIndex, selectedOptionIndex: optIndex }),
      });
      const data = await res.json();

      // Full-round simulation withholds correctness until the whole session
      // finishes, like a real interview — just save and move on quickly.
      if (isFullRound) {
        updateQuestionLocal(answerIndex, { answered: true });
        setTimeout(() => goToNextOrFinish(), 350);
        return;
      }

      updateQuestionLocal(answerIndex, {
        localMcqResult: {
          isCorrect: data.isCorrect,
          correctOptionIndex: data.correctOptionIndex,
          explanation: data.explanation,
        },
        answered: true,
      });
    } catch {
      if (isFullRound) {
        updateQuestionLocal(answerIndex, { answered: true });
        setTimeout(() => goToNextOrFinish(), 350);
        return;
      }
      updateQuestionLocal(answerIndex, {
        localMcqResult: { isCorrect: optIndex === currentQ.correctOptionIndex, correctOptionIndex: currentQ.correctOptionIndex, explanation: "" },
        answered: true,
      });
    }

    // Stay on the question for a few seconds so the user can read the
    // explanation before it auto-advances.
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

  return (
    <div className="interview-bg">
      {submitting && (
        <div className="ai-analyzing-overlay">
          <div className="ai-analyzing-box">
            <div className="ai-pulse-icon"><Sparkles size={40} strokeWidth={1.75} /></div>
            <h2>Reviewing your answers…</h2>
            <p>This usually takes 10-20 seconds. Scoring each descriptive answer for accuracy, clarity, and completeness.</p>
            <div className="spinner" style={{ margin: "1.2rem auto 0" }} />
          </div>
        </div>
      )}

      <div className="interview-topbar">
        <div className="interview-logo">
          <span className="logo-icon"><Zap size={18} strokeWidth={2.5} /></span>
          <span className="logo-text">InterviewAI</span>
        </div>
        <div className="interview-timer">
          <Clock size={14} strokeWidth={2.25} /> {formatElapsed(elapsedSeconds)}
        </div>
      </div>

      <div className="interview-layout">
        <div className="interview-wrap">
          <div className="interview-header">
            <div className="interview-meta">
              {isFullRound && rounds.length > 0 && (
                <span className="meta-round">
                  Round {(currentQ?.roundIndex ?? 0) + 1} of {rounds.length}: {currentQ?.roundRole}
                </span>
              )}
              <span className="meta-role">
                {isMCQ ? <Circle size={12} strokeWidth={3} /> : <PenLine size={12} strokeWidth={2.5} />}
                {isMCQ ? "Multiple choice" : "Written answer"} — Question {currentIndex + 1} of {questions.length}
              </span>
            </div>
            <button className="end-session-btn" onClick={handleEndSession} type="button">
              <LogOut size={14} strokeWidth={2.25} /> End Session
            </button>
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
                    disabled={!!mcqResult || (isFullRound && selectedOption !== null)}
                  >
                    <span className="mcq-letter">{String.fromCharCode(65 + idx)}</span>
                    {opt}
                  </button>
                );
              })}

              {mcqResult && (
                <div className={`mcq-feedback ${mcqResult.isCorrect ? "mcq-feedback-good" : "mcq-feedback-bad"}`}>
                  <span className="mcq-feedback-lead">
                    {mcqResult.isCorrect ? <Check size={15} strokeWidth={3} /> : <X size={15} strokeWidth={3} />}
                    {mcqResult.isCorrect ? "Correct" : "Not quite"}
                  </span>
                  {mcqResult.explanation}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="answer-input-wrap">
                <textarea
                  className="answer-area"
                  placeholder="Type your answer here... Be specific and use examples where possible."
                  value={answer}
                  onChange={(e) => updateQuestionLocal(currentIndex, { localAnswerText: e.target.value })}
                />
                {voiceSupported && (
                  <button
                    type="button"
                    className={`mic-btn ${isListening ? "mic-btn-active" : ""}`}
                    onClick={toggleListening}
                    title={isListening ? "Stop recording" : "Answer by voice"}
                    aria-label={isListening ? "Stop voice recording" : "Start voice recording"}
                  >
                    {isListening ? <MicOff size={17} strokeWidth={2.15} /> : <Mic size={17} strokeWidth={2.15} />}
                  </button>
                )}
              </div>
              {isListening && (
                <p className="mic-status"><span className="mic-pulse-dot" /> Listening — speak your answer, then tap the mic to stop.</p>
              )}
              {voiceError && <p className="mic-error">{voiceError}</p>}
              <div className="answer-actions">
                <span className="word-count">{answer.trim().split(/\s+/).filter(Boolean).length} words</span>
              </div>
            </>
          )}

          <div className="interview-nav-buttons">
            <button className="nav-hop-btn" onClick={handlePrevious} disabled={currentIndex === 0 || submitting}>
              <ArrowLeft size={15} strokeWidth={2.25} /> Previous
            </button>

            {!isMCQ && (
              <button className="next-btn" onClick={handleDone} disabled={submitting || savingAnswer}>
                {submitting ? (
                  "Finishing…"
                ) : savingAnswer ? (
                  "Saving…"
                ) : currentIndex < questions.length - 1 ? (
                  <>Done <Check size={15} strokeWidth={2.75} /></>
                ) : (
                  <>Finish Interview <Check size={15} strokeWidth={2.75} /></>
                )}
              </button>
            )}

            <button className="nav-hop-btn" onClick={handleNextNav} disabled={currentIndex >= questions.length - 1 || submitting}>
              Next <ArrowRight size={15} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Interview;