"use client";

import { SafetyStatus } from "@/hooks/useAerisData";
import { SensorReading, DetectionData } from "@/lib/api";

interface MissionStatusProps {
  safetyStatus: SafetyStatus;
  sensors: SensorReading | null;
  detections: DetectionData | null;
  isBackendOnline: boolean;
}

export default function MissionStatus({
  safetyStatus,
  sensors,
  detections,
  isBackendOnline,
}: MissionStatusProps) {
  const peopleCount = detections?.people_detected ?? 0;
  const isFlame = Boolean(sensors?.flame_detected);

  const missionPhase = !isBackendOnline
    ? "SYSTEM OFFLINE"
    : isFlame && peopleCount > 0
    ? "CRITICAL RESCUE DISPATCH"
    : peopleCount > 0
    ? "SURVIVOR LOCATED"
    : isFlame
    ? "FIRE CONTAINMENT ASSESSMENT"
    : "AUTONOMOUS MINE SURVEY";

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <span className="label">MISSION DIRECTIVE</span>
          <h2>Mine Rescue Status</h2>
        </div>

        <span
          className={
            safetyStatus === "EMERGENCY"
              ? "status-emergency"
              : safetyStatus === "CRITICAL"
              ? "status-critical"
              : "live-badge"
          }
        >
          {missionPhase}
        </span>
      </div>

      <div className="mission-progress">
        <div className="progress">
          <div
            style={{
              width: isBackendOnline ? "84%" : "0%",
              background:
                safetyStatus === "EMERGENCY"
                  ? "#ff4a4a"
                  : safetyStatus === "CRITICAL"
                  ? "#ffb35c"
                  : "#d9ff4a",
            }}
          />
        </div>

        <strong>{isBackendOnline ? "ACTIVE" : "STANDBY"}</strong>
      </div>

      <div className="mission-details">
        <div>
          <span>Target Sector</span>
          <strong>Mine Shaft 04 - Level B</strong>
        </div>

        <div>
          <span>Assigned Device</span>
          <strong>{sensors?.device_id || "ESP32_MINE_01"}</strong>
        </div>

        <div>
          <span>Survivors Detected</span>
          <strong style={{ color: peopleCount > 0 ? "#ff4a4a" : "#e8edf3" }}>
            {isBackendOnline ? `${peopleCount} Confirmed` : "--"}
          </strong>
        </div>
      </div>
    </div>
  );
}