"use client";

import { SensorReading } from "@/lib/api";
import { THRESHOLDS } from "@/lib/config";

interface GasSensorProps {
  sensors: SensorReading | null;
  isOnline: boolean;
}

export default function GasSensor({ sensors, isOnline }: GasSensorProps) {
  const ch4 = sensors?.methane;
  const co = sensors?.carbon_monoxide;
  const smoke = sensors?.smoke;

  const getStatus = (
    val: number | null | undefined,
    thresh: { safeMax: number; warningMax: number }
  ) => {
    if (val === null || val === undefined || !isOnline) return { text: "--", color: "#707985" };
    if (val > thresh.warningMax) return { text: "CRITICAL", color: "#ff4a4a" };
    if (val > thresh.safeMax) return { text: "WARNING", color: "#ffb35c" };
    return { text: "SAFE", color: "#d9ff4a" };
  };

  const ch4Status = getStatus(ch4, THRESHOLDS.methane);
  const coStatus = getStatus(co, THRESHOLDS.carbonMonoxide);
  const smokeStatus = getStatus(smoke, THRESHOLDS.smoke);

  const isAnyCritical =
    ch4Status.text === "CRITICAL" ||
    coStatus.text === "CRITICAL" ||
    smokeStatus.text === "CRITICAL";

  const isAnyWarning =
    ch4Status.text === "WARNING" ||
    coStatus.text === "WARNING" ||
    smokeStatus.text === "WARNING";

  const overallText = isAnyCritical ? "CRITICAL HAZARD" : isAnyWarning ? "ELEVATED" : isOnline && sensors ? "SAFE" : "OFFLINE";
  const overallBadgeClass = isAnyCritical ? "status-critical" : isAnyWarning ? "alert-badge" : isOnline && sensors ? "good-badge" : "alert-badge";

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <span className="label">MQ-2 SENSOR ARRAY</span>
          <h2>Mine Gas Monitoring</h2>
        </div>

        <span className={overallBadgeClass}>{overallText}</span>
      </div>

      <div className="gas-list">
        <div className="gas-item">
          <span>CO</span>
          <div>
            <small>Carbon Monoxide</small>
            <span style={{ color: coStatus.color, fontSize: "9px", display: "block" }}>
              {coStatus.text}
            </span>
          </div>
          <strong>{co !== null && co !== undefined && isOnline ? `${co.toFixed(1)} ppm` : "-- ppm"}</strong>
        </div>

        <div className="gas-item">
          <span>CH₄</span>
          <div>
            <small>Methane / Natural Gas</small>
            <span style={{ color: ch4Status.color, fontSize: "9px", display: "block" }}>
              {ch4Status.text}
            </span>
          </div>
          <strong>{ch4 !== null && ch4 !== undefined && isOnline ? `${ch4.toFixed(2)} %` : "-- %"}</strong>
        </div>

        <div className="gas-item">
          <span>SMK</span>
          <div>
            <small>Smoke & Combustibles</small>
            <span style={{ color: smokeStatus.color, fontSize: "9px", display: "block" }}>
              {smokeStatus.text}
            </span>
          </div>
          <strong>{smoke !== null && smoke !== undefined && isOnline ? `${smoke.toFixed(1)} ppm` : "-- ppm"}</strong>
        </div>
      </div>

      <div className="gas-status">
        <span>Overall Gas Atmosphere:</span>
        <strong style={{ color: isAnyCritical ? "#ff4a4a" : isAnyWarning ? "#ffb35c" : "#d9ff4a" }}>
          {overallText}
        </strong>
      </div>
    </div>
  );
}