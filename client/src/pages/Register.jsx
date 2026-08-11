import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Zap, Mail, Lock, User, Eye, EyeOff, AlertCircle, Check, ArrowRight } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import "../styles/auth.css";

const ROLES = [
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Mobile Developer",
  "Data Analyst",
  "Data Engineer",
  "Data Scientist",
  "Machine Learning (ML) Engineer",
  "DevOps Engineer",
  "Cloud Architect",
  "Site Reliability Engineer (SRE)",
  "Cybersecurity Analyst",
  "Penetration Tester (Ethical Hacker)",
  "Network Engineer",
  "Manual QA Tester",
  "QA Automation Engineer",
  "Software Development Engineer in Test (SDET)",
  "Product Manager (PM)",
  "UI/UX Designer",
  "Scrum Master",
  "Other",
];

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    targetRole: "Full Stack Developer",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const passwordLongEnough = form.password.length >= 6;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!passwordLongEnough) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const result = await register(form);
    setLoading(false);
    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glow" />
      <div className="auth-card">
        <div className="auth-logo" style={{ justifyContent: "space-between" }}>
          <span
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
            onClick={() => navigate("/")}
          >
            <span className="logo-icon"><Zap size={20} strokeWidth={2.5} /></span>
            <span className="logo-text">InterviewAI</span>
          </span>
          <ThemeToggle />
        </div>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Start your AI-powered interview prep</p>

        {error && (
          <div className="auth-error">
            <AlertCircle size={16} strokeWidth={2.25} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Full Name</label>
            <div className="input-with-icon">
              <User size={16} strokeWidth={2} className="input-icon" />
              <input
                type="text"
                name="name"
                placeholder="Rahul Sharma"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>Email</label>
            <div className="input-with-icon">
              <Mail size={16} strokeWidth={2} className="input-icon" />
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <Lock size={16} strokeWidth={2} className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="input-icon-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
              </button>
            </div>
            {form.password.length > 0 && (
              <span className={`password-hint ${passwordLongEnough ? "password-hint-ok" : ""}`}>
                {passwordLongEnough && <Check size={12} strokeWidth={3} />}
                {passwordLongEnough ? "Looks good" : `At least 6 characters (${form.password.length}/6)`}
              </span>
            )}
          </div>
          <div className="form-group">
            <label>Target Role</label>
            <select name="targetRole" value={form.targetRole} onChange={handleChange}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? <span className="btn-spinner" /> : <>Create Account <ArrowRight size={16} strokeWidth={2.25} /></>}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;