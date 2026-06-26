import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/results.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const VERDICT_COLOR = {
  Good: "score-good",
  Average: "score-avg",
  "Needs Work": "score-low",
};

const Results = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res = await fetch(`${API_URL}/interview/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setInterview(data.interview);
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [id, token]);

  if (loading) {
    return (
      <div className="interview-page-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="interview-page-loading">
        <p style={{ color: "#6b6b80" }}>Interview not found.</p>
      </div>
    );
  }

  const mcqAnswers = interview.answers.filter((a) => a.type === "mcq");
  const descAnswers = interview.answers.filter((a) => a.type !== "mcq");
  const mcqCorrect = interview.mcqCorrectCount ?? mcqAnswers.filter((a) => a.isCorrect).length;
  const mcqTotal = interview.mcqTotalCount ?? mcqAnswers.length;
  const mcqPct = mcqTotal > 0 ? Math.round((mcqCorrect / mcqTotal) * 100) : 0;

  const overallScore = interview.overallScore || 0;
  const overallPct = Math.round((overallScore / 10) * 100);

  // Average descriptive score (AI-scored) shown separately from MCQ
  const descScores = descAnswers.map((a) => a.score || 0);
  const descAvg = descScores.length
    ? Math.round((descScores.reduce((a, b) => a + b, 0) / descScores.length) * 10) / 10
    : 0;

  return (
    <div className="results-bg">
      <div className="results-wrap">
        <div className="results-hero">
          <div
            className="results-score-ring"
            style={{ background: `conic-gradient(#6c63ff 0% ${overallPct}%, rgba(255,255,255,.06) ${overallPct}% 100%)` }}
          >
            <span className="ring-num">{overallScore}</span>
          </div>
          <h1 className="results-title">
            {overallScore >= 8 ? "Excellent Performance! 🎉" : overallScore >= 5 ? "Good Effort! 👍" : "Keep Practicing! 💪"}
          </h1>
          <p className="results-sub">
            {interview.role} · {interview.difficulty} · {interview.answers.length} questions
          </p>
        </div>

        {/* Score Summary Row */}
        <div className="score-summary-row">
          {mcqTotal > 0 && (
            <div className="mcq-summary-card">
              <div className="mcq-summary-ring">
                <span className="mcq-summary-num">{mcqPct}%</span>
              </div>
              <div>
                <div className="mcq-summary-title">MCQ Score</div>
                <div className="mcq-summary-sub">{mcqCorrect} correct out of {mcqTotal}</div>
              </div>
            </div>
          )}
          {descAnswers.length > 0 && (
            <div className="mcq-summary-card">
              <div className="mcq-summary-ring" style={{ background: "linear-gradient(135deg, #00d4aa, #6c63ff)" }}>
                <span className="mcq-summary-num">{descAvg}/10</span>
              </div>
              <div>
                <div className="mcq-summary-title">AI Descriptive Score</div>
                <div className="mcq-summary-sub">Avg across {descAnswers.length} written answers</div>
              </div>
            </div>
          )}
        </div>

        {/* MCQ Review */}
        {mcqAnswers.length > 0 && (
          <>
            <div className="section-title" style={{ marginBottom: "1rem", marginTop: "2rem" }}>MCQ Review</div>
            <div className="qa-review">
              {mcqAnswers.map((a, idx) => (
                <div className="qa-item" key={idx}>
                  <div className="qa-q">{a.questionText}</div>
                  <div className="mcq-review-options">
                    {a.options?.map((opt, optIdx) => {
                      let cls = "mcq-review-opt";
                      if (optIdx === a.correctOptionIndex) cls += " mcq-review-correct";
                      else if (optIdx === a.selectedOptionIndex) cls += " mcq-review-wrong";
                      return (
                        <div key={optIdx} className={cls}>
                          {String.fromCharCode(65 + optIdx)}. {opt}
                        </div>
                      );
                    })}
                  </div>
                  {a.explanation && <div className="qa-explanation">💡 {a.explanation}</div>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Descriptive Review - Full AI Feedback */}
        {descAnswers.length > 0 && (
          <>
            <div className="section-title" style={{ marginBottom: "1rem", marginTop: "2rem" }}>
              Descriptive Answers — AI Feedback
            </div>
            <div className="qa-review">
              {descAnswers.map((a, idx) => (
                <div className="qa-item" key={idx}>
                  <div className="qa-item-header">
                    <div className="qa-q">{a.questionText}</div>
                    <span className={`qa-score ${VERDICT_COLOR[a.verdict] || "score-avg"}`}>
                      {a.score}/10
                    </span>
                  </div>

                  <div className="qa-a">
                    {a.userAnswer ? a.userAnswer : <em style={{ color: "#6b6b80" }}>No answer provided</em>}
                  </div>

                  {(a.strengths?.length > 0 || a.improvements?.length > 0) && (
                    <div className="qa-feedback-tags">
                      {a.strengths?.map((s, i) => (
                        <span className="fb-tag fb-good" key={`s${i}`}>✓ {s}</span>
                      ))}
                      {a.improvements?.map((imp, i) => (
                        <span className="fb-tag fb-improve" key={`i${i}`}>+ {imp}</span>
                      ))}
                    </div>
                  )}

                  {a.idealAnswerSummary && (
                    <div className="qa-explanation">💡 <strong>Ideal answer:</strong> {a.idealAnswerSummary}</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="results-actions">
          <button className="btn-outline" onClick={() => navigate("/dashboard")}>← Back to Dashboard</button>
          <button className="btn-primary" onClick={() => navigate("/interview/new")}>Try Another Interview 🔁</button>
        </div>
      </div>
    </div>
  );
};

export default Results;