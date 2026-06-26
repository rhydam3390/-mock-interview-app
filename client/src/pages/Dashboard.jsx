import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="dashboard">
      <div className="dash-glow" />
      <nav className="dash-nav">
        <div className="auth-logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">InterviewAI</span>
        </div>
        <div className="nav-right">
          <button className="nav-link-btn" onClick={() => navigate("/history")}>History</button>
          <span className="nav-user">Hi, {user?.name?.split(" ")[0]} 👋</span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <main className="dash-main">
        <div className="dash-hero">
          <h1>Your Interview Dashboard</h1>
          <p>Ready to practice? Start a new mock interview below.</p>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-num">{user?.totalInterviews || 0}</span>
            <span className="stat-label">Interviews Done</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{user?.averageScore || "—"}</span>
            <span className="stat-label">Avg Score</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{user?.targetRole?.split(" ")[0] || "—"}</span>
            <span className="stat-label">Target Role</span>
          </div>
        </div>

        <div className="dash-actions-row">
          <button className="auth-btn" style={{ maxWidth: "280px" }} onClick={() => navigate("/interview/new")}>
            Start New Interview →
          </button>
          <button className="btn-outline" onClick={() => navigate("/history")}>
            View History
          </button>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;