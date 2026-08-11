import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Zap, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import "../styles/auth.css";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(form.email, form.password);
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
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Login to continue your interview prep</p>

        {error && (
          <div className="auth-error">
            <AlertCircle size={16} strokeWidth={2.25} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
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
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
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
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? <span className="btn-spinner" /> : <>Login <ArrowRight size={16} strokeWidth={2.25} /></>}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;