import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/dashboard.css";
import "../styles/history.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const ROLE_ICON = {
  "Frontend Developer": "⚛️",
  "Backend Developer": "🛠️",
  "Full Stack Developer": "🚀",
  "AI/ML Engineer": "🤖",
  "HR Round": "💬",
  "DSA": "🧩",
};

const scoreClass = (score) => {
  if (score >= 7.5) return "score-good";
  if (score >= 5) return "score-avg";
  return "score-low";
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
};

const History = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterRole, setFilterRole] = useState("All");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/interview/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setInterviews(data.interviews);
        else setError(data.message || "Could not load history");
      } catch {
        setError("Could not load history. Is the backend running?");
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [token]);

  const completedOnly = interviews.filter((i) => i.status === "completed");
  const roles = ["All", ...new Set(completedOnly.map((i) => i.role))];
  const filtered = filterRole === "All" ? completedOnly : completedOnly.filter((i) => i.role === filterRole);

  // Quick aggregate stats
  const avgScore = completedOnly.length
    ? Math.round((completedOnly.reduce((sum, i) => sum + (i.overallScore || 0), 0) / completedOnly.length) * 10) / 10
    : 0;
  const bestScore = completedOnly.length
    ? Math.max(...completedOnly.map((i) => i.overallScore || 0))
    : 0;

  return (
    <div className="dashboard">
      <div className="dash-glow" />
      <nav className="dash-nav">
        <div className="auth-logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">InterviewAI</span>
        </div>
        <button className="logout-btn" onClick={() => navigate("/dashboard")}>
          ← Back
        </button>
      </nav>

      <main className="dash-main">
        <div className="dash-hero">
          <h1>Interview History</h1>
          <p>Review your past sessions and track your improvement over time.</p>
        </div>

        {error && <div className="auth-error" style={{ marginBottom: "1.5rem" }}>{error}</div>}

        {loading ? (
          <p style={{ color: "#6b6b80" }}>Loading history...</p>
        ) : completedOnly.length === 0 ? (
          <div className="history-empty">
            <div className="history-empty-icon">🗂️</div>
            <h2>No completed interviews yet</h2>
            <p>Start your first mock interview to see your history here.</p>
            <button className="auth-btn" style={{ maxWidth: "260px", margin: "1.5rem auto 0" }} onClick={() => navigate("/interview/new")}>
              Start an Interview →
            </button>
          </div>
        ) : (
          <>
            <div className="stats-row" style={{ marginBottom: "2rem" }}>
              <div className="stat-card">
                <span className="stat-num">{completedOnly.length}</span>
                <span className="stat-label">Total Interviews</span>
              </div>
              <div className="stat-card">
                <span className="stat-num">{avgScore}</span>
                <span className="stat-label">Average Score</span>
              </div>
              <div className="stat-card">
                <span className="stat-num">{bestScore}</span>
                <span className="stat-label">Best Score</span>
              </div>
            </div>

            <div className="history-filters">
              {roles.map((r) => (
                <button
                  key={r}
                  className={`filter-chip ${filterRole === r ? "filter-chip-active" : ""}`}
                  onClick={() => setFilterRole(r)}
                >
                  {r !== "All" && <span style={{ marginRight: ".4rem" }}>{ROLE_ICON[r] || "💼"}</span>}
                  {r}
                </button>
              ))}
            </div>

            <div className="history-list">
              {filtered.map((interview) => (
                <div
                  key={interview._id}
                  className="history-item-card"
                  onClick={() => navigate(`/results/${interview._id}`)}
                >
                  <div className="hist-left">
                    <div className="hist-icon">{ROLE_ICON[interview.role] || "💼"}</div>
                    <div>
                      <div className="hist-role">{interview.role} — {interview.difficulty}</div>
                      <div className="hist-date">
                        {formatDate(interview.createdAt)} · {interview.answers?.length || 0} questions
                      </div>
                    </div>
                  </div>
                  <div className="hist-right">
                    <span className={`hist-score ${scoreClass(interview.overallScore || 0)}`}>
                      {interview.overallScore || 0}
                    </span>
                    <span className="hist-arrow">→</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default History;