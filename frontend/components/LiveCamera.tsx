"use client";

import { useState, useEffect, useCallback } from "react";
import { getVideoOriginalUrl, getVideoNightUrl } from "@/lib/config";
import { SensorReading, DetectionData, enableWebcam, disableWebcam, getWebcamStatus } from "@/lib/api";

interface LiveCameraProps {
  sensors: SensorReading | null;
  detections: DetectionData | null;
  isBackendOnline: boolean;
  streamType?: "original" | "night";
  onStreamTypeChange?: (type: "original" | "night") => void;
}

export default function LiveCamera({
  sensors,
  detections,
  isBackendOnline,
  streamType: controlledStreamType,
  onStreamTypeChange,
}: LiveCameraProps) {
  const [internalStreamType, setInternalStreamType] = useState<"original" | "night">("night");
  const streamType = controlledStreamType ?? internalStreamType;

  const setStreamType = (type: "original" | "night") => {
    if (onStreamTypeChange) {
      onStreamTypeChange(type);
    } else {
      setInternalStreamType(type);
    }
  };

  const [nightError, setNightError] = useState(false);
  const [rgbError, setRgbError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isActivatingWebcam, setIsActivatingWebcam] = useState(false);

  // Check initial webcam status on backend
  useEffect(() => {
    if (!isBackendOnline) return;
    getWebcamStatus().then((status) => {
      setIsWebcamActive(status.webcam_enabled);
    });
  }, [isBackendOnline]);

  // Pre-check if RGB is available on backend
  useEffect(() => {
    if (!isBackendOnline || isWebcamActive) return;
    const checkRgb = async () => {
      try {
        const res = await fetch(getVideoOriginalUrl(), { method: "HEAD" });
        if (!res.ok) setRgbError(true);
      } catch {
        setRgbError(true);
      }
    };
    checkRgb();
  }, [isBackendOnline, isWebcamActive, retryKey]);

  const handleRetry = useCallback(() => {
    setRetryKey((k) => k + 1);
    if (streamType === "night") setNightError(false);
    else setRgbError(false);
  }, [streamType]);

  // Enable laptop webcam from backend
  const handleEnableWebcam = async () => {
    setIsActivatingWebcam(true);
    try {
      await enableWebcam();
      setIsWebcamActive(true);
      setRgbError(false);
      setRetryKey((k) => k + 1);
    } catch (e) {
      console.error("Failed to enable laptop webcam:", e);
    } finally {
      setIsActivatingWebcam(false);
    }
  };

  // Disable laptop webcam
  const handleDisableWebcam = async () => {
    try {
      await disableWebcam();
      setIsWebcamActive(false);
      setRetryKey((k) => k + 1);
    } catch (e) {
      console.error("Failed to disable laptop webcam:", e);
    }
  };

  // Determine detection count scoped to the currently visible feed source
  const currentSource = streamType === "night" ? "night_video" : "normal";
  const isCurrentFeedSource = detections?.source === currentSource;

  // Show people count only when the detection source matches the active tab
  const peopleCount = isCurrentFeedSource ? (detections?.people_detected ?? 0) : 0;
  const currentDetections = isCurrentFeedSource ? (detections?.detections ?? []) : [];

  const isCurrentError = streamType === "night" ? nightError : (rgbError && !isWebcamActive);

  return (
    <div className="card camera-card">
      <div className="card-header">
        <div>
          <span className="label">LIVE VIDEO STREAM</span>
          <h2>
            {streamType === "night"
              ? "Night Vision AI"
              : isWebcamActive
              ? "Laptop Live WebCam (YOLO11 AI)"
              : "RGB Normal Vision"}
          </h2>
        </div>

        <div className="camera-header-actions">
          <button
            type="button"
            className={`cam-toggle-btn ${streamType === "night" ? "active" : ""}`}
            onClick={() => setStreamType("night")}
          >
            NIGHT AI
          </button>
          <button
            type="button"
            className={`cam-toggle-btn ${streamType === "original" ? "active" : ""}`}
            onClick={() => setStreamType("original")}
          >
            {isWebcamActive ? "💻 WEBCAM" : "RGB"}
          </button>

          <span className={isBackendOnline && !isCurrentError ? "live-badge" : "alert-badge"}>
            {isBackendOnline && !isCurrentError
              ? isWebcamActive && streamType === "original"
                ? "● WEBCAM LIVE"
                : "● LIVE STREAM"
              : "NO VIDEO"}
          </span>
        </div>
      </div>

      <div className="camera">
        {/* NIGHT VISION TAB */}
        {streamType === "night" && (
          isBackendOnline && !nightError ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={`night-${retryKey}`}
              src={getVideoNightUrl()}
              alt="AERIS Night Vision Feed"
              onError={() => setNightError(true)}
              onLoad={() => setNightError(false)}
            />
          ) : (
            <div className="camera-offline">
              <div className="camera-offline-icon">🎥</div>
              <p>{!isBackendOnline ? "Video Server Offline" : "Night Vision Source Unavailable"}</p>
              {isBackendOnline && (
                <button type="button" className="btn-retry" onClick={handleRetry}>
                  Retry Connection
                </button>
              )}
            </div>
          )
        )}

        {/* RGB TAB — ESP32-CAM or LAPTOP WEBCAM WITH YOLO AI */}
        {streamType === "original" && (
          isWebcamActive ? (
            /* Laptop WebCam is actively streaming with YOLO */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={`webcam-${retryKey}`}
              src={getVideoOriginalUrl()}
              alt="AERIS Laptop WebCam Feed"
              onError={() => setRgbError(true)}
              onLoad={() => setRgbError(false)}
            />
          ) : rgbError ? (
            <div className="camera-offline" style={{ padding: "20px 15px" }}>
              <div className="camera-offline-icon">📷</div>
              <p style={{ margin: "4px 0", fontWeight: "700", color: "#e8edf3" }}>
                ESP32-CAM Not Detected
              </p>
              <span style={{ fontSize: "11px", color: "#8594a6", marginBottom: "14px", display: "block" }}>
                ESP32-CAM is offline or unconfigured. You can retry connection or launch your laptop live webcam with AI detection.
              </span>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  type="button"
                  className="btn-retry"
                  onClick={() => {
                    setRgbError(false);
                    setRetryKey((k) => k + 1);
                  }}
                >
                  🔄 Retry ESP-CAM
                </button>
                <button
                  type="button"
                  className="btn-retry"
                  style={{
                    background: "linear-gradient(135deg, #2b3a1a 0%, #1c2612 100%)",
                    color: "#d9ff4a",
                    border: "1px solid #d9ff4a",
                    fontWeight: "600",
                  }}
                  onClick={handleEnableWebcam}
                  disabled={isActivatingWebcam}
                >
                  {isActivatingWebcam ? "⏳ Initializing WebCam..." : "💻 Use Laptop WebCam (AI)"}
                </button>
              </div>
            </div>
          ) : !isBackendOnline ? (
            <div className="camera-offline">
              <div className="camera-offline-icon">📷</div>
              <p>Video Server Offline</p>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={`rgb-${retryKey}`}
              src={getVideoOriginalUrl()}
              alt="AERIS RGB Feed"
              onError={() => setRgbError(true)}
              onLoad={() => setRgbError(false)}
            />
          )
        )}

        {/* HUD Overlay — detection count only from this feed's source */}
        <div className="camera-overlay">
          <span>
            {streamType === "night"
              ? "NIGHT AI FEED"
              : isWebcamActive
              ? "LAPTOP WEBCAM (YOLO11)"
              : "RGB FEED"}
          </span>
          <span style={{ color: peopleCount > 0 ? "#ff4a4a" : "#d9ff4a" }}>
            {peopleCount > 0
              ? `🚨 ${peopleCount} HUMAN${peopleCount > 1 ? "S" : ""} DETECTED`
              : isCurrentFeedSource
              ? "AI SCANNING"
              : "DETECTION: STANDBY"}
          </span>
        </div>

        {/* WebCam Control Switch Button if active */}
        {streamType === "original" && isWebcamActive && (
          <button
            type="button"
            onClick={handleDisableWebcam}
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              zIndex: 10,
              fontSize: "10px",
              padding: "4px 8px",
              background: "rgba(20, 25, 30, 0.85)",
              color: "#ff7474",
              border: "1px solid rgba(255, 100, 100, 0.4)",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            🛑 Stop WebCam
          </button>
        )}

        {/* Per-detection confidence list (only for active feed) */}
        {currentDetections.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: "28px",
              left: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "3px",
            }}
          >
            {currentDetections.slice(0, 4).map((d, i) => (
              <span
                key={i}
                style={{
                  fontSize: "9px",
                  background: isWebcamActive ? "rgba(217, 255, 74, 0.85)" : "rgba(255,74,74,0.75)",
                  color: isWebcamActive ? "#0c131a" : "#fff",
                  padding: "1px 6px",
                  borderRadius: "3px",
                  fontWeight: "700",
                }}
              >
                {d.class.toUpperCase()} {(d.confidence * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        )}

        <div className="camera-data">
          <span>ALT 18.5m</span>
          <span>SECTOR B-12</span>
          <span>{sensors?.flame_detected ? "🔥 FLAME ALERT" : "FLAME: SAFE"}</span>
        </div>
      </div>
    </div>
  );
}