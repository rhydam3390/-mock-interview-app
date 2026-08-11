import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Zap, LayoutDashboard, PlayCircle, History as HistoryIcon, FileText, LogOut } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Start Interview", path: "/interview/new", icon: PlayCircle },
  { label: "History", path: "/history", icon: HistoryIcon },
  { label: "Prep Report", path: "/prep-report", icon: FileText },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="app-sidebar">
      <div
        className="sidebar-logo"
        onClick={() => navigate("/dashboard")}
        style={{ cursor: "pointer" }}
      >
        <span className="logo-icon"><Zap size={20} strokeWidth={2.5} /></span>
        <span className="logo-text">InterviewAI</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              className={`sidebar-nav-item ${isActive ? "sidebar-nav-active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <Icon size={18} strokeWidth={2.15} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <ThemeToggle />
        <button className="sidebar-logout-btn" onClick={handleLogout} title="Logout">
          <LogOut size={17} strokeWidth={2.15} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;