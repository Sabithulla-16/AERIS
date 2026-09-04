"use client";

import { AerisAlert } from "@/hooks/useAerisData";

interface AlertsProps {
  alerts: AerisAlert[];
}

export default function Alerts({ alerts }: AlertsProps) {
  const activeCount = alerts.length;

  const getAlertStyle = (type: AerisAlert["type"]) => {
    switch (type) {
      case "CRITICAL":
        return {
          bg: "#240d0d",
          border: "#5c1b1b",
          iconBg: "#4a1212",
          iconColor: "#ff4a4a",
          badgeColor: "#ff4a4a",
        };
      case "WARNING":
        return {
          bg: "#1c140a",
          border: "#473016",
          iconBg: "#3d250d",
          iconColor: "#ffb35c",
          badgeColor: "#ffb35c",
        };
      default:
        return {
          bg: "#0d1a24",
          border: "#1b374c",
          iconBg: "#122a3d",
          iconColor: "#70a4ff",
          badgeColor: "#70a4ff",
        };
    }
  };

  return (
    <div className="card alerts-card">
      <div className="card-header">
        <div>
          <span className="label">RESCUE DISPATCH / ALERTS</span>
          <h2>Hazard & Event Feed</h2>
        </div>

        <span className={activeCount > 0 ? "alert-badge" : "good-badge"}>
          {activeCount > 0 ? `${activeCount} ACTIVE` : "0 HAZARDS"}
        </span>
      </div>

      <div className="alerts-scroll-container">
        {alerts.length === 0 ? (
          <div className="alert-empty-state">
            <span className="status-dot" style={{ background: "#d9ff4a" }} />
            <span>All monitored parameters normal · No active alerts</span>
          </div>
        ) : (
          alerts.map((alert) => {
            const style = getAlertStyle(alert.type);
            return (
              <div
                key={alert.id}
                className="alert-item"
                style={{
                  background: style.bg,
                  borderColor: style.border,
                  marginBottom: "8px",
                }}
              >
                <div
                  className="alert-icon"
                  style={{
                    background: style.iconBg,
                    color: style.iconColor,
                  }}
                >
                  {alert.category === "FIRE"
                    ? "🔥"
                    : alert.category === "HUMAN"
                    ? "👤"
                    : alert.category === "GAS"
                    ? "☣️"
                    : "!"}
                </div>

                <div className="alert-content">
                  <strong style={{ color: style.badgeColor }}>
                    {alert.title}
                  </strong>
                  <p>{alert.message}</p>
                  {alert.detail && <small>{alert.detail}</small>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}