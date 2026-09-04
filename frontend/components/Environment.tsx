"use client";

import { SensorReading } from "@/lib/api";

interface EnvironmentProps {
  sensors: SensorReading | null;
  isOnline: boolean;
}

export default function Environment({ sensors, isOnline }: EnvironmentProps) {
  const temp = sensors?.temperature;
  const humidity = sensors?.humidity;
  const flame = sensors?.flame_detected;

  const isHighTemp = temp !== undefined && temp > 50;
  const isFlame = Boolean(flame);

  const statusText = isFlame
    ? "FLAME DETECTED"
    : isHighTemp
    ? "HIGH HEAT"
    : isOnline && sensors
    ? "NORMAL"
    : "OFFLINE";

  const badgeClass = isFlame
    ? "status-critical"
    : isHighTemp
    ? "alert-badge"
    : isOnline && sensors
    ? "good-badge"
    : "alert-badge";

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <span className="label">DHT11 & FLAME SENSORS</span>
          <h2>Atmospheric Environment</h2>
        </div>

        <span className={badgeClass}>{statusText}</span>
      </div>

      <div className="environment-grid">
        <div>
          <span>Flame Status</span>
          <strong style={{ color: isFlame ? "#ff4a4a" : "#d9ff4a" }}>
            {isOnline && sensors ? (isFlame ? "🔥 FLAME DETECTED" : "NO FLAME (SAFE)") : "--"}
          </strong>
        </div>

        <div>
          <span>Ambient Temperature</span>
          <strong>{isOnline && temp !== undefined ? `${temp.toFixed(1)}°C` : "--°C"}</strong>
        </div>

        <div>
          <span>Relative Humidity</span>
          <strong>{isOnline && humidity !== undefined ? `${humidity.toFixed(1)}%` : "--%"}</strong>
        </div>
      </div>

      <div className="environment-status">
        <span>Thermal/Fire Status:</span>
        <strong style={{ color: isFlame ? "#ff4a4a" : "#d9ff4a" }}>
          {isFlame ? "CRITICAL HAZARD" : "STABLE"}
        </strong>
      </div>
    </div>
  );
}