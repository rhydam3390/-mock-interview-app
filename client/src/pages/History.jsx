import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { TrendingUp, TrendingDown, Minus, FolderOpen } from "lucide-react";
import Sidebar from "../components/Sidebar";
import "../styles/sidebar.css";
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

// Simple dependency-free SVG line chart showing score trend over time.
const ProgressChart = ({ sessions }) => {
  if (sessions.length < 2) {
    return (
      <p className="progress-chart-empty">
        Complete at least 2 interviews in this view to see your progress trend.
      </p>
    );
  }

  const width = 640;
  const height = 160;
  const padding = 24;
  const maxScore = 10;

  const points = sessions.map((s, i) => {
    const x = padding + (i / (sessions.length - 1)) * (width - padding * 2);
    const y = height - padding - ((s.overallScore || 0) / maxScore) * (height - padding * 2);
    return { x, y, score: s.overallScore || 0 };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  // Trend = average of the second half vs the first half of the sessions shown
  const mid = Math.floor(sessions.length / 2);
  const firstHalfAvg = sessions.slice(0, mid || 1).reduce((s, iv) => s + (iv.overallScore || 0), 0) / (mid || 1);
  const secondHalfAvg = sessions.slice(mid).reduce((s, iv) => s + (iv.overallScore || 0), 0) / (sessions.length - mid);
  const delta = Math.round((secondHalfAvg - firstHalfAvg) * 10) / 10;

  return (
    <>
      <div className="progress-card-header">
        <span className="progress-card-title">Score Trend</span>
        <span
          className={`progress-trend ${delta > 0.3 ? "progress-trend-up" : delta < -0.3 ? "progress-trend-down" : "progress-trend-flat"}`}
        >
          {delta > 0.3 ? <TrendingUp size={14} strokeWidth={2.5} /> : delta < -0.3 ? <TrendingDown size={14} strokeWidth={2.5} /> : <Minus size={14} strokeWidth={2.5} />}
          {delta > 0.3 ? `Improving (+${delta})` : delta < -0.3 ? `Declining (${delta})` : "Holding steady"}
        </span>
      </div>
      <svg className="progress-chart-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6c63ff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6c63ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#progressFill)" />
        <path d={linePath} fill="none" stroke="#6c63ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#08080f" stroke="#6c63ff" strokeWidth="2.5" />
        ))}
      </svg>
    </>
  );
};

const History = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [chartRole, setChartRole] = useState("All");

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

  // Chronological (oldest first) for the trend chart, optionally filtered by role
  const chartSessions = [...completedOnly]
    .filter((i) => chartRole === "All" || i.role === chartRole)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <div className="app-topbar">
          <span className="app-topbar-user">Hi, {user?.name?.split(" ")[0]} 👋</span>
        </div>
        <main className="app-content-main dash-main">
        <div className="dash-hero">
          <h1>Interview History</h1>
          <p>Review your past sessions and track your improvement over time.</p>
        </div>

        {error && <div className="auth-error" style={{ marginBottom: "1.5rem" }}>{error}</div>}

        {loading ? (
          <p style={{ color: "#6b6b80" }}>Loading history...</p>
        ) : completedOnly.length === 0 ? (
          <div className="history-empty">
            <div className="history-empty-icon"><FolderOpen size={32} strokeWidth={1.75} /></div>
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

            <div className="progress-card">
              {roles.length > 2 && (
                <select
                  className="progress-role-select"
                  value={chartRole}
                  onChange={(e) => setChartRole(e.target.value)}
                  style={{ marginBottom: ".8rem" }}
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>{r === "All" ? "All roles" : r}</option>
                  ))}
                </select>
              )}
              <ProgressChart sessions={chartSessions} />
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
    </div>
  );
};

export default History;