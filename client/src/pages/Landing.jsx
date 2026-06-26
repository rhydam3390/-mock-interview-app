import { useNavigate } from "react-router-dom";
import "../styles/landing.css";

const FEATURES = [
  { icon: "🤖", title: "Real AI Feedback", desc: "Every written answer is scored and reviewed by AI — not a static answer key." },
  { icon: "🔘", title: "MCQ + Descriptive", desc: "A realistic mix of quick-fire MCQs and in-depth written questions." },
  { icon: "⏱️", title: "Timed Sessions", desc: "Practice under real interview pressure with a live countdown per question." },
  { icon: "📊", title: "Track Progress", desc: "See your score history and improvement across every role you practice." },
];

const ROLES = ["Frontend Developer", "Backend Developer", "Full Stack Developer", "AI/ML Engineer", "HR Round", "DSA"];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <div className="landing-glow landing-glow-1" />
      <div className="landing-glow landing-glow-2" />

      <nav className="landing-nav">
        <div className="auth-logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">InterviewAI</span>
        </div>
        <div className="landing-nav-actions">
          <button className="nav-link-btn" onClick={() => navigate("/login")}>Login</button>
          <button className="nav-cta-btn" onClick={() => navigate("/register")}>Get Started</button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="hero-eyebrow">✦ AI-Powered Interview Practice</div>
        <h1 className="hero-headline">
          Walk into your next<br />
          interview <span className="hero-gradient-text">already prepared.</span>
        </h1>
        <p className="hero-sub">
          Practice real interview questions, get instant AI-scored feedback on your answers,
          and walk in knowing exactly where you stand.
        </p>
        <div className="hero-actions">
          <button className="hero-cta-primary" onClick={() => navigate("/register")}>
            Start Practicing — Free →
          </button>
          <button className="hero-cta-secondary" onClick={() => navigate("/login")}>
            I already have an account
          </button>
        </div>

        <div className="role-pills">
          {ROLES.map((r) => (
            <span className="role-pill" key={r}>{r}</span>
          ))}
        </div>
      </section>

      <section className="landing-features">
        <div className="features-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <h2>Ready to see where you stand?</h2>
        <p>Your first mock interview takes less than 5 minutes.</p>
        <button className="hero-cta-primary" onClick={() => navigate("/register")}>
          Create Free Account →
        </button>
      </section>

      <footer className="landing-footer">
        <span>Built with React, Node.js, MongoDB & Gemini AI</span>
      </footer>
    </div>
  );
};

export default Landing;