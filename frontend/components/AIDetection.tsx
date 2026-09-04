"use client";

import { DetectionData, SensorReading } from "@/lib/api";

interface AIDetectionProps {
  detections: DetectionData | null;
  sensors: SensorReading | null;
  isBackendOnline: boolean;
  videoSource?: "night" | "original";
}

export default function AIDetection({
  detections,
  sensors,
  isBackendOnline,
  videoSource = "night",
}: AIDetectionProps) {
  // Scoped strictly to the currently selected video option (NIGHT AI vs RGB)
  const isNight = videoSource === "night";
  
  // Resolve detections object for the active mode
  const sourceData = isNight
    ? (detections?.night || (detections?.source === "night_video" ? detections : null))
    : (detections?.normal || (detections?.source === "normal" ? detections : null));

  const isMatchingSource = Boolean(sourceData);
  const peopleCount = sourceData?.people_detected ?? 0;
  const detectionList = sourceData?.detections ?? [];

  const topConfidence =
    detectionList.length > 0
      ? Math.round(
          Math.max(...detectionList.map((d) => d.confidence || 0)) * 100
        )
      : peopleCount > 0
      ? 85
      : 0;

  const flameStatus = sensors?.flame_detected ? "🔥 CRITICAL" : "CLEAR";

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <span className="label">
            {isNight ? "NIGHT VISION AI INFERENCE" : "RGB OPTICAL DETECTION"}
          </span>
          <h2>AI Human & Hazard Detection</h2>
        </div>

        <span className={isBackendOnline ? "ai-badge" : "alert-badge"}>
          {isNight ? "NIGHT MODEL (YOLO)" : "RGB MODEL (YOLO)"}
        </span>
      </div>

      <div className="confidence">
        <div>
          <span>Model Confidence ({isNight ? "Night AI Feed" : "RGB Feed"})</span>
          <strong>{isBackendOnline && isMatchingSource ? `${topConfidence}%` : "0%"}</strong>
        </div>

        <div className="progress">
          <div
            style={{
              width: `${isBackendOnline && isMatchingSource ? topConfidence : 0}%`,
              background: peopleCount > 0 ? "#d9ff4a" : "#4a70ff",
            }}
          />
        </div>
      </div>

      <div className="detection-grid">
        <div>
          <span>Humans in {isNight ? "Night Feed" : "RGB Feed"}</span>
          <strong style={{ color: peopleCount > 0 ? "#ff4a4a" : "#e8edf3" }}>
            {isBackendOnline ? `${peopleCount} DETECTED` : "--"}
          </strong>
        </div>

        <div>
          <span>Target Status</span>
          <strong>
            {isBackendOnline
              ? peopleCount > 0
                ? "CONFIRMED"
                : isMatchingSource
                ? "SCANNING"
                : "FEED STANDBY"
              : "--"}
          </strong>
        </div>

        <div>
          <span>Optical Flame</span>
          <strong style={{ color: sensors?.flame_detected ? "#ff4a4a" : "#d9ff4a" }}>
            {sensors ? flameStatus : "--"}
          </strong>
        </div>

        <div>
          <span>Active Feed</span>
          <strong style={{ color: "#d9ff4a" }}>
            {isNight ? "NIGHT VISION" : "RGB CAMERA"}
          </strong>
        </div>
      </div>

      <div className="engine">
        {isBackendOnline ? (
          <span>
            ● Active Target Stream:{" "}
            <strong>{isNight ? "NIGHT VISION (night vision 2.mp4)" : "RGB STREAM (ESP32-CAM)"}</strong>
          </span>
        ) : (
          <span style={{ color: "#ff7474" }}>● Inference Engine: <strong>OFFLINE</strong></span>
        )}
      </div>
    </div>
  );
}