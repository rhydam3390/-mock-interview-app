import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Sidebar from "../components/Sidebar";
import "../styles/sidebar.css";
import "../styles/dashboard.css";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <div className="app-topbar">
          <span className="app-topbar-user">Hi, {user?.name?.split(" ")[0]} 👋</span>
        </div>
        <main className="app-content-main dash-main">
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
            <button className="auth-btn" style={{ maxWidth: "280px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: ".4rem" }} onClick={() => navigate("/interview/new")}>
              Start New Interview <ArrowRight size={16} strokeWidth={2.25} />
            </button>
            <button className="btn-outline" onClick={() => navigate("/history")}>
              View History
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;