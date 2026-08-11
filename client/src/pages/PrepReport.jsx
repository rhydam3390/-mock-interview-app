import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Download, TrendingUp, Target, ListChecks } from "lucide-react";
import Sidebar from "../components/Sidebar";
import "../styles/sidebar.css";
import "../styles/dashboard.css";
import "../styles/report.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const scoreClass = (score) => {
  if (score >= 7.5) return "rp-score-good";
  if (score >= 5) return "rp-score-avg";
  return "rp-score-low";
};

const PrepReport = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/interview/history?limit=200`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setInterviews(data.interviews);
      } catch {
        // fail silently — report just shows what it can
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [token]);

  const completed = interviews.filter((i) => i.status === "completed");

  const avgScore = completed.length
    ? Math.round((completed.reduce((s, i) => s + (i.overallScore || 0), 0) / completed.length) * 10) / 10
    : 0;
  const bestScore = completed.length ? Math.max(...completed.map((i) => i.overallScore || 0)) : 0;

  // Per-role breakdown
  const byRole = {};
  completed.forEach((i) => {
    if (!byRole[i.role]) byRole[i.role] = { total: 0, count: 0 };
    byRole[i.role].total += i.overallScore || 0;
    byRole[i.role].count += 1;
  });
  const roleBreakdown = Object.entries(byRole)
    .map(([role, stats]) => ({ role, avg: Math.round((stats.total / stats.count) * 10) / 10, count: stats.count }))
    .sort((a, b) => b.count - a.count);

  // Weak categories across everything
  const byCategory = {};
  completed.forEach((i) => {
    i.answers?.forEach((a) => {
      if (!a.category) return;
      if (!byCategory[a.category]) byCategory[a.category] = { total: 0, count: 0 };
      byCategory[a.category].total += a.score || 0;
      byCategory[a.category].count += 1;
    });
  });
  const weakCategories = Object.entries(byCategory)
    .filter(([, stats]) => stats.count >= 2)
    .map(([category, stats]) => ({ category, avg: Math.round((stats.total / stats.count) * 10) / 10, count: stats.count }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 6);

  // Trend: second half vs first half
  const chronological = [...completed].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const mid = Math.floor(chronological.length / 2);
  const firstHalfAvg = chronological.length >= 2
    ? chronological.slice(0, mid || 1).reduce((s, i) => s + (i.overallScore || 0), 0) / (mid || 1)
    : 0;
  const secondHalfAvg = chronological.length >= 2
    ? chronological.slice(mid).reduce((s, i) => s + (i.overallScore || 0), 0) / (chronological.length - mid)
    : 0;
  const trendDelta = Math.round((secondHalfAvg - firstHalfAvg) * 10) / 10;

  const recentSessions = chronological.slice(-15).reverse();

  return (
    <div className="app-shell">
      <div className="no-print"><Sidebar /></div>
      <div className="app-content">
        <div className="app-topbar no-print">
          <span className="app-topbar-user">Hi, {user?.name?.split(" ")[0]} 👋</span>
        </div>
        <main className="app-content-main dash-main">
        <div className="dash-hero no-print">
          <h1>Prep Report</h1>
          <p>A summary of your progress, weak areas, and session history — export it to keep for reference.</p>
        </div>

        {!loading && (
          <button className="auth-btn no-print" style={{ maxWidth: "220px", marginBottom: "2rem" }} onClick={() => window.print()}>
            <Download size={16} strokeWidth={2.25} style={{ marginRight: ".4rem" }} /> Export as PDF
          </button>
        )}

        {loading ? (
          <p style={{ color: "var(--muted)" }}>Loading your report...</p>
        ) : completed.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Complete a few interviews first to generate a prep report.</p>
        ) : (
          <div className="report-sheet">
            <div className="report-print-header">
              <h1>InterviewAI — Prep Report</h1>
              <p>{user?.name} · Generated {new Date().toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>

            <div className="report-stats-row">
              <div className="report-stat">
                <span className="report-stat-num">{completed.length}</span>
                <span className="report-stat-label">Interviews Completed</span>
              </div>
              <div className="report-stat">
                <span className="report-stat-num">{avgScore}</span>
                <span className="report-stat-label">Average Score</span>
              </div>
              <div className="report-stat">
                <span className="report-stat-num">{bestScore}</span>
                <span className="report-stat-label">Best Score</span>
              </div>
              <div className="report-stat">
                <span className="report-stat-num">
                  {trendDelta > 0.3 ? `+${trendDelta}` : trendDelta}
                </span>
                <span className="report-stat-label">Recent Trend</span>
              </div>
            </div>

            <div className="report-section">
              <h2><TrendingUp size={16} strokeWidth={2.25} /> Performance by Role</h2>
              <div className="report-table">
                {roleBreakdown.map((r) => (
                  <div key={r.role} className="report-row">
                    <span className="report-row-label">{r.role}</span>
                    <span className="report-row-sub">{r.count} session{r.count !== 1 ? "s" : ""}</span>
                    <span className={`report-row-score ${scoreClass(r.avg)}`}>{r.avg}/10</span>
                  </div>
                ))}
              </div>
            </div>

            {weakCategories.length > 0 && (
              <div className="report-section">
                <h2><Target size={16} strokeWidth={2.25} /> Areas to Focus On</h2>
                <div className="report-table">
                  {weakCategories.map((c) => (
                    <div key={c.category} className="report-row">
                      <span className="report-row-label">{c.category}</span>
                      <span className="report-row-sub">{c.count} question{c.count !== 1 ? "s" : ""}</span>
                      <span className={`report-row-score ${scoreClass(c.avg)}`}>{c.avg}/10</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="report-section">
              <h2><ListChecks size={16} strokeWidth={2.25} /> Recent Sessions</h2>
              <div className="report-table">
                {recentSessions.map((s) => (
                  <div key={s._id} className="report-row">
                    <span className="report-row-label">{s.role}</span>
                    <span className="report-row-sub">
                      {new Date(s.createdAt).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })} · {s.difficulty}
                    </span>
                    <span className={`report-row-score ${scoreClass(s.overallScore || 0)}`}>{s.overallScore || 0}/10</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        </main>
      </div>
    </div>
  );
};

export default PrepReport;