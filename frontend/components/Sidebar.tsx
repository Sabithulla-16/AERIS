"use client";

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  isBackendOnline?: boolean;
  alertCount?: number;
}

const menuItems: Array<{ id: string; label: string; icon: string }> = [
  { id: "Dashboard", label: "Dashboard", icon: "📊" },
  { id: "Mission Map", label: "Mine LiDAR Map", icon: "🗺️" },
  { id: "Live Camera", label: "Live Camera", icon: "📹" },
  { id: "Sensors", label: "Sensors & Climate", icon: "🌡️" },
  { id: "Gas Monitoring", label: "Gas Detection", icon: "💨" },
  { id: "Alerts", label: "Rescue & Alerts", icon: "🚨" },
  { id: "Settings", label: "System Config", icon: "⚙️" },
];

export default function Sidebar({
  activeTab,
  onSelectTab,
  isBackendOnline = true,
  alertCount = 0,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="logo" onClick={() => onSelectTab("Dashboard")} style={{ cursor: "pointer" }}>
        <div className="logo-mark">A</div>
        <div>
          <strong>AERIS</strong>
          <span>Mine Rescue Command</span>
        </div>
      </div>

      <nav>
        {menuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            className={activeTab === item.id ? "nav-item active" : "nav-item"}
          >
            <span style={{ marginRight: "8px", fontSize: "13px" }}>{item.icon}</span>
            <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
            {item.id === "Alerts" && alertCount > 0 && (
              <span
                style={{
                  background: "#ff4a4a",
                  color: "#fff",
                  fontSize: "10px",
                  fontWeight: "bold",
                  padding: "1px 6px",
                  borderRadius: "10px",
                }}
              >
                {alertCount}
              </span>
            )}
            {item.id === "Mission Map" && (
              <span
                style={{
                  background: "#1c2e22",
                  color: "#d9ff4a",
                  fontSize: "9px",
                  padding: "1px 4px",
                  borderRadius: "4px",
                  border: "1px solid #2e4d38",
                }}
              >
                SLAM
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <span
          className="status-dot"
          style={{
            background: isBackendOnline ? "#d9ff4a" : "#ff4a4a",
            boxShadow: isBackendOnline ? "0 0 10px #d9ff4a" : "0 0 10px #ff4a4a",
          }}
        />
        <div>
          <strong>{isBackendOnline ? "AERIS Gateway" : "Backend Disconnected"}</strong>
          <small>{isBackendOnline ? "FastAPI v4.0.0 Online" : "Check Port 8000"}</small>
        </div>
      </div>
    </aside>
  );
}