"use client";

import { useMemo } from "react";
import { SensorReading } from "@/lib/api";

interface ThermalMonitorProps {
  sensors: SensorReading | null;
  history: SensorReading[];
  isBackendOnline: boolean;
}

export default function ThermalMonitor({
  sensors,
  history,
  isBackendOnline,
}: ThermalMonitorProps) {
  const currentTemp = sensors?.temperature;
  const currentHumidity = sensors?.humidity;
  const isFlame = Boolean(sensors?.flame_detected);

  const stats = useMemo(() => {
    const temps = history
      .map((h) => h.temperature)
      .filter((t): t is number => typeof t === "number" && !isNaN(t));

    if (temps.length === 0) {
      return {
        avg: currentTemp !== undefined ? currentTemp.toFixed(1) : "--",
        max: currentTemp !== undefined ? currentTemp.toFixed(1) : "--",
        min: currentTemp !== undefined ? currentTemp.toFixed(1) : "--",
      };
    }

    const sum = temps.reduce((a, b) => a + b, 0);
    const avg = (sum / temps.length).toFixed(1);
    const max = Math.max(...temps).toFixed(1);
    const min = Math.min(...temps).toFixed(1);

    return { avg, max, min };
  }, [history, currentTemp]);

  const isHighTemp = currentTemp !== undefined && currentTemp > 45;

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <span className="label">SECTOR CLIMATE TELEMETRY</span>
          <h2>Temperature & Climate Analysis</h2>
        </div>

        <span className={isFlame ? "status-critical" : isHighTemp ? "alert-badge" : "good-badge"}>
          {isFlame ? "🔥 FLAME DETECTED" : isHighTemp ? "ELEVATED TEMP" : "SAFE ZONE"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "16px 0" }}>
        <div style={{ background: "#0b1016", border: "1px solid #1c2633", borderRadius: "8px", padding: "14px" }}>
          <span style={{ fontSize: "10px", color: "#6a7b8c", letterSpacing: "1px", textTransform: "uppercase" }}>
            Ambient Heat
          </span>
          <div style={{ fontSize: "28px", fontWeight: "700", color: isHighTemp ? "#ff7b4a" : "#d9ff4a", marginTop: "4px" }}>
            {currentTemp !== undefined ? `${currentTemp.toFixed(1)}°C` : "--°C"}
          </div>
          <div style={{ fontSize: "10px", color: "#8594a6", marginTop: "4px" }}>
            Status: {isHighTemp ? "Warning (>45°C)" : "Nominal"}
          </div>
        </div>

        <div style={{ background: "#0b1016", border: "1px solid #1c2633", borderRadius: "8px", padding: "14px" }}>
          <span style={{ fontSize: "10px", color: "#6a7b8c", letterSpacing: "1px", textTransform: "uppercase" }}>
            Relative Humidity
          </span>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "#4ae5ff", marginTop: "4px" }}>
            {currentHumidity !== undefined ? `${currentHumidity.toFixed(1)}%` : "--%"}
          </div>
          <div style={{ fontSize: "10px", color: "#8594a6", marginTop: "4px" }}>
            Moisture: {currentHumidity !== undefined && currentHumidity > 70 ? "Humid" : "Normal"}
          </div>
        </div>
      </div>

      <div className="thermal-stats">
        <div>
          <span>Current</span>
          <strong>{currentTemp !== undefined ? `${currentTemp.toFixed(1)}°C` : "--"}</strong>
        </div>

        <div>
          <span>Average</span>
          <strong>{stats.avg !== "--" ? `${stats.avg}°C` : "--"}</strong>
        </div>

        <div>
          <span>Peak Max</span>
          <strong style={{ color: Number(stats.max) > 45 ? "#ff4a4a" : undefined }}>
            {stats.max !== "--" ? `${stats.max}°C` : "--"}
          </strong>
        </div>

        <div>
          <span>Low Min</span>
          <strong>{stats.min !== "--" ? `${stats.min}°C` : "--"}</strong>
        </div>
      </div>
    </div>
  );
}