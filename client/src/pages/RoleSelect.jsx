import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Code2, Server, Rocket, Cpu, MessageCircle, Puzzle, Briefcase, Check, Lightbulb, ArrowLeft, FileText, Upload, X, Target, Layers, Plus, Trash2 } from "lucide-react";
import Sidebar from "../components/Sidebar";
import "../styles/sidebar.css";
import "../styles/dashboard.css";
import "../styles/roleselect.css";

const RESUME_ROLE_ID = "__resume__";

// Question count is now driven by level, not manually chosen — Senior pulls
// from the role's entire question bank (question pools are 50/role).
const LEVEL_QUESTION_COUNTS = { Easy: 20, Medium: 35, Hard: 50 };

// Each role gets its own icon + gradient color theme
const ROLE_THEME = {
  "Frontend Developer": { icon: Code2, gradient: "linear-gradient(135deg, #6c63ff, #00d4aa)", desc: "React, JavaScript, CSS & UI" },
  "Backend Developer": { icon: Server, gradient: "linear-gradient(135deg, #ff6b6b, #ffa94d)", desc: "APIs, Databases & Servers" },
  "Full Stack Developer": { icon: Rocket, gradient: "linear-gradient(135deg, #6c63ff, #8b5cf6)", desc: "End-to-end web development" },
  "AI/ML Engineer": { icon: Cpu, gradient: "linear-gradient(135deg, #00d4aa, #00a8ff)", desc: "Machine Learning & Models" },
  "HR Round": { icon: MessageCircle, gradient: "linear-gradient(135deg, #f9a825, #ff6b6b)", desc: "Behavioural & soft skills" },
  "DSA": { icon: Puzzle, gradient: "linear-gradient(135deg, #8b5cf6, #00a8ff)", desc: "Data Structures & Algorithms" },
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const RoleSelect = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [difficulty, setDifficulty] = useState("Medium");
  const numQuestions = LEVEL_QUESTION_COUNTS[difficulty];
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [parsingFile, setParsingFile] = useState(false);
  const [parseError, setParseError] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  // Mode: "single" (normal single-role flow) or "fullround" (chained rounds)
  const [mode, setMode] = useState("single");

  // Weak-area retry
  const [weakAreas, setWeakAreas] = useState([]);
  const [weakAreasLoading, setWeakAreasLoading] = useState(false);

  // Full-round simulation builder
  const [fullRounds, setFullRounds] = useState([]);
  const [draftRole, setDraftRole] = useState("");
  const [draftDifficulty, setDraftDifficulty] = useState("Medium");
  const levelSectionRef = useRef(null);

  const selectRole = (roleId) => {
    setSelectedRole(roleId);
    setTimeout(() => {
      levelSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

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

  // Fetch weak-area suggestions whenever a real (non-resume) role is selected
  useEffect(() => {
    if (!selectedRole || selectedRole === RESUME_ROLE_ID || mode !== "single") {
      setWeakAreas([]);
      return;
    }
    const fetchWeakAreas = async () => {
      setWeakAreasLoading(true);
      try {
        const res = await fetch(`${API_URL}/interview/weak-areas?role=${encodeURIComponent(selectedRole)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setWeakAreas(data.success ? data.weakAreas : []);
      } catch {
        setWeakAreas([]);
      } finally {
        setWeakAreasLoading(false);
      }
    };
    fetchWeakAreas();
  }, [selectedRole, mode, token]);

  const handleStart = async () => {
    if (!selectedRole) return;
    setStarting(true);
    setError("");
    try {
      const isResumeMode = selectedRole === RESUME_ROLE_ID;
      const res = await fetch(`${API_URL}/interview/${isResumeMode ? "resume-start" : "start"}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          isResumeMode
            ? { resumeText, jobDescription, difficulty, numQuestions }
            : { role: selectedRole, difficulty, numQuestions }
        ),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      navigate(`/interview/${data.interviewId}`);
    } catch (err) {
      setError(err.message || "Could not start interview");
      setStarting(false);
    }
  };

  const handleResumeFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError("");
    setParsingFile(true);
    setResumeFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const res = await fetch(`${API_URL}/interview/parse-resume`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      setResumeText(data.text);
    } catch (err) {
      setParseError(err.message || "Could not read that file");
      setResumeFileName("");
    } finally {
      setParsingFile(false);
      e.target.value = ""; // allow re-selecting the same file later
    }
  };

  const clearResumeFile = () => {
    setResumeFileName("");
    setResumeText("");
    setParseError("");
  };

  const handleStartWeakAreas = async () => {
    if (!selectedRole || weakAreas.length === 0) return;
    setStarting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/interview/weak-start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: selectedRole,
          difficulty,
          categories: weakAreas.map((w) => w.category),
          numQuestions,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      navigate(`/interview/${data.interviewId}`);
    } catch (err) {
      setError(err.message || "Could not start weak-area practice");
      setStarting(false);
    }
  };

  const addRound = () => {
    if (!draftRole) return;
    setFullRounds((prev) => [...prev, { role: draftRole, difficulty: draftDifficulty, numQuestions: 4 }]);
    setDraftRole("");
  };

  const removeRound = (idx) => {
    setFullRounds((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleStartFullRound = async () => {
    if (fullRounds.length < 2) return;
    setStarting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/interview/full-round-start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rounds: fullRounds }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      navigate(`/interview/${data.interviewId}`);
    } catch (err) {
      setError(err.message || "Could not start full round simulation");
      setStarting(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <div className="app-topbar">
          <span className="app-topbar-user">Hi, {user?.name?.split(" ")[0]} 👋</span>
        </div>
        <main className="app-content-main dash-main">
        <div className="dash-hero">
          <h1>Start a New Interview</h1>
          <p>Pick a role, set difficulty, and begin practicing.</p>
        </div>

        <div className="mode-tabs">
          <button
            className={`mode-tab ${mode === "single" ? "mode-tab-active" : ""}`}
            onClick={() => setMode("single")}
          >
            Single Role
          </button>
          <button
            className={`mode-tab ${mode === "fullround" ? "mode-tab-active" : ""}`}
            onClick={() => setMode("fullround")}
          >
            <Layers size={14} strokeWidth={2.25} /> Full Round Simulation
          </button>
        </div>

        {error && <div className="auth-error" style={{ marginBottom: "1.5rem" }}>{error}</div>}

        {loading ? (
          <p style={{ color: "#6b6b80" }}>Loading roles...</p>
        ) : mode === "fullround" ? (
          <>
            <div className="section-title">Build Your Interview Rounds</div>
            <p className="role-tip">
              <Lightbulb size={15} strokeWidth={2.25} />
              Chain 2–4 rounds back to back. Like a real interview day, MCQ answers won't be revealed until you finish the whole simulation.
            </p>

            <div className="round-builder">
              <select
                className="progress-role-select round-select"
                value={draftRole}
                onChange={(e) => setDraftRole(e.target.value)}
              >
                <option value="">Choose a role...</option>
                {roles.map((r) => (
                  <option key={r._id} value={r._id}>{r._id}</option>
                ))}
              </select>
              <select
                className="progress-role-select round-select"
                value={draftDifficulty}
                onChange={(e) => setDraftDifficulty(e.target.value)}
              >
                <option value="Easy">Junior</option>
                <option value="Medium">Mid-level</option>
                <option value="Hard">Senior</option>
              </select>
              <button className="round-add-btn" onClick={addRound} disabled={!draftRole}>
                <Plus size={15} strokeWidth={2.5} /> Add Round
              </button>
            </div>

            {fullRounds.length > 0 && (
              <div className="round-list">
                {fullRounds.map((r, idx) => (
                  <div key={idx} className="round-item">
                    <span className="round-item-index">{idx + 1}</span>
                    <span className="round-item-label">{r.role} — {r.difficulty === "Easy" ? "Junior" : r.difficulty === "Hard" ? "Senior" : "Mid-level"}</span>
                    <button className="round-item-remove" onClick={() => removeRound(idx)} aria-label="Remove round">
                      <Trash2 size={14} strokeWidth={2.25} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              className="auth-btn start-btn"
              disabled={fullRounds.length < 2 || starting}
              onClick={handleStartFullRound}
            >
              {starting ? "Starting simulation..." : fullRounds.length < 2 ? "Add at least 2 rounds" : `Start Full Round Simulation (${fullRounds.length} rounds) →`}
            </button>
          </>
        ) : (
          <>
            <div className="section-title">1. Choose a Role</div>
            <div className="role-cards-grid">
              <div
                className={`role-big-card role-resume-card ${selectedRole === RESUME_ROLE_ID ? "role-big-selected" : ""}`}
                onClick={() => selectRole(RESUME_ROLE_ID)}
              >
                <div className="role-big-glow" style={{ background: "linear-gradient(135deg, #00d4aa, #6c63ff)" }} />
                <div className="role-big-icon" style={{ background: "linear-gradient(135deg, #00d4aa, #6c63ff)" }}>
                  <FileText size={22} strokeWidth={2.25} color="#08080f" />
                </div>
                <div className="role-big-name">Resume-Based</div>
                <div className="role-big-desc">Questions built from your actual resume</div>
                <div className="role-big-footer">
                  <span className="role-big-count">AI-generated for you</span>
                  {selectedRole === RESUME_ROLE_ID && (
                    <span className="role-big-check">
                      <Check size={13} strokeWidth={3} /> Selected
                    </span>
                  )}
                </div>
              </div>
              {roles.map((r) => {
                const theme = ROLE_THEME[r._id] || { icon: Briefcase, gradient: "linear-gradient(135deg, #6c63ff, #8b5cf6)", desc: "Practice questions" };
                const RoleIcon = theme.icon;
                const isSelected = selectedRole === r._id;
                return (
                  <div
                    key={r._id}
                    className={`role-big-card ${isSelected ? "role-big-selected" : ""}`}
                    onClick={() => selectRole(r._id)}
                  >
                    <div className="role-big-glow" style={{ background: theme.gradient }} />
                    <div className="role-big-icon" style={{ background: theme.gradient }}>
                      <RoleIcon size={22} strokeWidth={2.25} color="#08080f" />
                    </div>
                    <div className="role-big-name">{r._id}</div>
                    <div className="role-big-desc">{theme.desc}</div>
                    <div className="role-big-footer">
                      <span className="role-big-count">{r.count} questions</span>
                      {isSelected && (
                        <span className="role-big-check">
                          <Check size={13} strokeWidth={3} /> Selected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedRole && selectedRole !== RESUME_ROLE_ID && weakAreas.length > 0 && (
              <div className="weak-areas-callout">
                <div className="weak-areas-header">
                  <Target size={16} strokeWidth={2.25} />
                  <span>Based on your past sessions, you're weakest in:</span>
                </div>
                <div className="weak-areas-chips">
                  {weakAreas.map((w) => (
                    <span key={w.category} className="weak-area-chip">
                      {w.category} <span className="weak-area-score">{w.averageScore}/10</span>
                    </span>
                  ))}
                </div>
                <button className="weak-areas-btn" onClick={handleStartWeakAreas} disabled={starting}>
                  Practice these weak areas instead <ArrowLeft size={14} strokeWidth={2.25} style={{ transform: "rotate(180deg)" }} />
                </button>
              </div>
            )}

            {selectedRole === RESUME_ROLE_ID && (
              <div className="resume-input-block">
                <label className="resume-label">
                  Upload your resume <span className="resume-optional">(PDF or Word)</span>
                </label>

                {!resumeFileName ? (
                  <label className="resume-upload-dropzone">
                    <Upload size={20} strokeWidth={2} />
                    <span>{parsingFile ? "Reading your file..." : "Click to upload a PDF or .docx file"}</span>
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={handleResumeFile}
                      disabled={parsingFile}
                      hidden
                    />
                  </label>
                ) : (
                  <div className="resume-file-chip">
                    <FileText size={16} strokeWidth={2.25} />
                    <span className="resume-file-name">{resumeFileName}</span>
                    {parsingFile && <span className="resume-file-status">Reading...</span>}
                    <button
                      type="button"
                      className="resume-file-remove"
                      onClick={clearResumeFile}
                      aria-label="Remove file"
                    >
                      <X size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                )}

                {parseError && <p className="resume-parse-error">{parseError}</p>}

                <div className="resume-divider">
                  <span>or paste it manually</span>
                </div>

                <label className="resume-label" htmlFor="resume-text">
                  Resume text <span className="resume-required">*</span>
                </label>
                <textarea
                  id="resume-text"
                  className="resume-textarea"
                  placeholder="Paste your resume content here — work experience, projects, skills, etc."
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  rows={7}
                />
                <label className="resume-label" htmlFor="job-description">
                  Target job description <span className="resume-optional">(optional)</span>
                </label>
                <textarea
                  id="job-description"
                  className="resume-textarea"
                  placeholder="Paste the job description you're preparing for, to make questions even more targeted."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={5}
                />
              </div>
            )}

            <div className="section-title" ref={levelSectionRef}>2. Choose Your Level</div>
            <div className="diff-row">
              {[
                { value: "Easy", label: "Junior" },
                { value: "Medium", label: "Mid-level" },
                { value: "Hard", label: "Senior" },
              ].map((d) => (
                <button
                  key={d.value}
                  className={`diff-btn ${difficulty === d.value ? "diff-active" : ""}`}
                  onClick={() => setDifficulty(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="level-hint">
              {difficulty === "Easy" && `Fundamentals-focused — ${LEVEL_QUESTION_COUNTS.Easy} questions, good for early-career practice.`}
              {difficulty === "Medium" && `Practical, real-world scenarios — ${LEVEL_QUESTION_COUNTS.Medium} questions, good for a few years of experience.`}
              {difficulty === "Hard" && `Deeper, higher-stakes questions — all ${LEVEL_QUESTION_COUNTS.Hard} questions in this role's bank, for full senior-level coverage.`}
            </p>

            <p className="role-tip">
              <Lightbulb size={15} strokeWidth={2.25} />
              {selectedRole === RESUME_ROLE_ID
                ? "Questions will be generated from your resume — at least half will reference something specific you've done."
                : "This round mixes multiple-choice and written questions evenly, so you'll get practice with both."}
            </p>

            <button
              className="auth-btn start-btn"
              disabled={
                !selectedRole ||
                starting ||
                parsingFile ||
                (selectedRole === RESUME_ROLE_ID && resumeText.trim().length < 50)
              }
              onClick={handleStart}
            >
              {starting
                ? selectedRole === RESUME_ROLE_ID
                  ? "Generating your questions..."
                  : "Starting..."
                : "Start Interview →"}
            </button>
          </>
        )}
        </main>
      </div>
    </div>
  );
};

export default RoleSelect;