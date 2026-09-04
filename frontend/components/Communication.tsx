"use client";

import { HealthStatus } from "@/lib/api";

interface CommunicationProps {
  health: HealthStatus | null;
  isBackendOnline: boolean;
  isSensorOnline: boolean;
}

export default function Communication({
  health,
  isBackendOnline,
  isSensorOnline,
}: CommunicationProps) {
  const supabaseStatus = health?.supabase === "connected" ? "CONNECTED" : health?.supabase === "error" ? "ERROR" : isBackendOnline ? "CONNECTING" : "OFFLINE";
  const supabaseColor = health?.supabase === "connected" ? "#d9ff4a" : "#ff4a4a";

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <span className="label">TELEMETRY & COMMS</span>
          <h2>Network & Cloud Link</h2>
        </div>

        <span className={isBackendOnline ? "good-badge" : "alert-badge"}>
          {isBackendOnline ? "LINK STABLE" : "OFFLINE"}
        </span>
      </div>

      <div className="communication">
        <div>
          <span>FastAPI Gateway</span>
          <strong style={{ color: isBackendOnline ? "#d9ff4a" : "#ff4a4a" }}>
            {isBackendOnline ? "ONLINE (PORT 8000)" : "OFFLINE"}
          </strong>
        </div>

        <div>
          <span>Supabase Cloud DB</span>
          <strong style={{ color: supabaseColor }}>
            {supabaseStatus}
          </strong>
        </div>

        <div>
          <span>ESP32 Telemetry Link</span>
          <strong style={{ color: isSensorOnline ? "#d9ff4a" : "#ffb35c" }}>
            {isSensorOnline ? "STREAMING (2.4GHz)" : "AWAITING TELEMETRY"}
          </strong>
        </div>
      </div>
    </div>
  );
}