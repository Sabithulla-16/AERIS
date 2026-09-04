"use client";

import { SafetyStatus } from "@/hooks/useAerisData";

interface TopBarProps {
  isBackendOnline: boolean;
  safetyStatus: SafetyStatus;
  deviceId: string;
  lastUpdated: Date | null;
}

export default function TopBar({
  isBackendOnline,
  safetyStatus,
  deviceId,
  lastUpdated,
}: TopBarProps) {
  const getStatusBadge = () => {
    switch (safetyStatus) {
      case "EMERGENCY":
        return { className: "status-emergency", text: "🚨 EMERGENCY" };
      case "CRITICAL":
        return { className: "status-critical", text: "⚠️ CRITICAL HAZARD" };
      case "WARNING":
        return { className: "status-warning", text: "⚡ WARNING" };
      default:
        return { className: "status-safe", text: "● SYSTEM NOMINAL" };
    }
  };

  const badge = getStatusBadge();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="system-status">
          <span
            className="status-dot"
            style={{
              background: isBackendOnline ? "#d9ff4a" : "#ff4a4a",
              boxShadow: isBackendOnline ? "0 0 10px #d9ff4a" : "0 0 10px #ff4a4a",
            }}
          />
          {isBackendOnline ? "FASTAPI BACKEND ONLINE" : "BACKEND OFFLINE"}
        </span>

        <span className={`safety-badge ${badge.className}`}>
          {badge.text}
        </span>
      </div>

      <div className="top-actions">
        <span>DEVICE: {deviceId}</span>
        <span>
          LAST SYNC: {lastUpdated ? lastUpdated.toLocaleTimeString() : "--:--:--"}
        </span>
      </div>
    </header>
  );
}