import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/dashboard.css";
import "../styles/roleselect.css";

// Each role gets its own icon + gradient color theme
const ROLE_THEME = {
  "Frontend Developer": { icon: "⚛️", gradient: "linear-gradient(135deg, #6c63ff, #00d4aa)", desc: "React, JavaScript, CSS & UI" },
  "Backend Developer": { icon: "🛠️", gradient: "linear-gradient(135deg, #ff6b6b, #ffa94d)", desc: "APIs, Databases & Servers" },
  "Full Stack Developer": { icon: "🚀", gradient: "linear-gradient(135deg, #6c63ff, #8b5cf6)", desc: "End-to-end web development" },
  "AI/ML Engineer": { icon: "🤖", gradient: "linear-gradient(135deg, #00d4aa, #00a8ff)", desc: "Machine Learning & Models" },
  "HR Round": { icon: "💬", gradient: "linear-gradient(135deg, #f9a825, #ff6b6b)", desc: "Behavioural & soft skills" },
  "DSA": { icon: "🧩", gradient: "linear-gradient(135deg, #8b5cf6, #00a8ff)", desc: "Data Structures & Algorithms" },
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const RoleSelect = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [difficulty, setDifficulty] = useState("Medium");
  const [numQuestions, setNumQuestions] = useState(5);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch(`${API_URL}/interview/roles`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setRoles(data.roles);
      } catch {
        setError("Could not load roles. Is the backend running?");
      } finally {
        setLoading(false);
      }
    };
    fetchRoles();
  }, [token]);

  const handleStart = async () => {
    if (!selectedRole) return;
    setStarting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/interview/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: selectedRole, difficulty, numQuestions }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      navigate(`/interview/${data.interviewId}`);
    } catch (err) {
      setError(err.message || "Could not start interview");
      setStarting(false);
    }
  };

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
          <h1>Start a New Interview</h1>
          <p>Pick a role, set difficulty, and begin practicing.</p>
        </div>

        {error && <div className="auth-error" style={{ marginBottom: "1.5rem" }}>{error}</div>}

        {loading ? (
          <p style={{ color: "#6b6b80" }}>Loading roles...</p>
        ) : (
          <>
            <div className="section-title">1. Choose a Role</div>
            <div className="role-cards-grid">
              {roles.map((r) => {
                const theme = ROLE_THEME[r._id] || { icon: "💼", gradient: "linear-gradient(135deg, #6c63ff, #8b5cf6)", desc: "Practice questions" };
                const isSelected = selectedRole === r._id;
                return (
                  <div
                    key={r._id}
                    className={`role-big-card ${isSelected ? "role-big-selected" : ""}`}
                    onClick={() => setSelectedRole(r._id)}
                  >
                    <div className="role-big-glow" style={{ background: theme.gradient }} />
                    <div className="role-big-icon" style={{ background: theme.gradient }}>
                      {theme.icon}
                    </div>
                    <div className="role-big-name">{r._id}</div>
                    <div className="role-big-desc">{theme.desc}</div>
                    <div className="role-big-footer">
                      <span className="role-big-count">{r.count} questions</span>
                      {isSelected && <span className="role-big-check">✓ Selected</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="section-title">2. Choose Difficulty</div>
            <div className="diff-row">
              {["Easy", "Medium", "Hard"].map((d) => (
                <button
                  key={d}
                  className={`diff-btn ${difficulty === d ? "diff-active" : ""}`}
                  onClick={() => setDifficulty(d)}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="section-title">3. Number of Questions</div>
            <div className="diff-row">
              {[3, 5, 8].map((n) => (
                <button
                  key={n}
                  className={`diff-btn ${numQuestions === n ? "diff-active" : ""}`}
                  onClick={() => setNumQuestions(n)}
                >
                  {n} Questions
                </button>
              ))}
            </div>

            <p style={{ color: "#6b6b80", fontSize: ".82rem", marginBottom: "1rem", maxWidth: "480px" }}>
              💡 Your interview will be a 50/50 mix of multiple-choice and descriptive questions.
            </p>

            <button
              className="auth-btn start-btn"
              disabled={!selectedRole || starting}
              onClick={handleStart}
            >
              {starting ? "Starting..." : "Start Interview →"}
            </button>
          </>
        )}
      </main>
    </div>
  );
};

export default RoleSelect;