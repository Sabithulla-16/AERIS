"use client";

import { useState, useMemo } from "react";
import { SensorReading } from "@/lib/api";

interface SensorHistoryChartProps {
  history: SensorReading[];
  isOnline: boolean;
}

type MetricKey = "gases" | "temperature" | "humidity";

export default function SensorHistoryChart({
  history,
  isOnline,
}: SensorHistoryChartProps) {
  const [selectedTab, setSelectedTab] = useState<MetricKey>("gases");

  const validData = useMemo(() => {
    return history.filter((d) => d && d.timestamp);
  }, [history]);

  // Compute SVG polyline points
  const chartData = useMemo(() => {
    if (validData.length < 2) return null;

    const width = 500;
    const height = 140;
    const padding = 20;

    const computePoints = (getter: (d: SensorReading) => number) => {
      const values = validData.map(getter);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min === 0 ? 1 : max - min;

      const points = values.map((v, i) => {
        const x = padding + (i / (values.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((v - min) / range) * (height - 2 * padding);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });

      return {
        pointsStr: points.join(" "),
        latest: values[values.length - 1],
        min,
        max,
      };
    };

    return {
      width,
      height,
      methane: computePoints((d) => d.methane ?? 0),
      co: computePoints((d) => d.carbon_monoxide ?? 0),
      smoke: computePoints((d) => d.smoke ?? 0),
      temperature: computePoints((d) => d.temperature ?? 0),
      humidity: computePoints((d) => d.humidity ?? 0),
    };
  }, [validData]);

  return (
    <div className="card history-card">
      <div className="card-header">
        <div>
          <span className="label">TELEMETRY ANALYTICS</span>
          <h2>Sensor History & Trends</h2>
        </div>

        <div className="chart-tabs">
          <button
            type="button"
            className={selectedTab === "gases" ? "tab-btn active" : "tab-btn"}
            onClick={() => setSelectedTab("gases")}
          >
            GASES (CH4/CO/SMOKE)
          </button>
          <button
            type="button"
            className={selectedTab === "temperature" ? "tab-btn active" : "tab-btn"}
            onClick={() => setSelectedTab("temperature")}
          >
            TEMP
          </button>
          <button
            type="button"
            className={selectedTab === "humidity" ? "tab-btn active" : "tab-btn"}
            onClick={() => setSelectedTab("humidity")}
          >
            HUMIDITY
          </button>
        </div>
      </div>

      <div className="history-chart-wrapper">
        {validData.length < 2 ? (
          <div className="chart-empty-state">
            <span>{isOnline ? "Awaiting telemetry samples from Supabase..." : "Offline - No history available"}</span>
          </div>
        ) : (
          chartData && (
            <svg
              viewBox={`0 0 ${chartData.width} ${chartData.height}`}
              className="trend-svg"
            >
              {/* Background Grid Lines */}
              <line x1="20" y1="20" x2="480" y2="20" stroke="#1c2229" strokeDasharray="3,3" />
              <line x1="20" y1="70" x2="480" y2="70" stroke="#1c2229" strokeDasharray="3,3" />
              <line x1="20" y1="120" x2="480" y2="120" stroke="#1c2229" />

              {selectedTab === "gases" && (
                <>
                  {/* Methane (Cyan) */}
                  <polyline
                    fill="none"
                    stroke="#4ae5ff"
                    strokeWidth="2"
                    points={chartData.methane.pointsStr}
                  />
                  {/* Carbon Monoxide (Amber) */}
                  <polyline
                    fill="none"
                    stroke="#ffb35c"
                    strokeWidth="2"
                    points={chartData.co.pointsStr}
                  />
                  {/* Smoke (Red-Orange) */}
                  <polyline
                    fill="none"
                    stroke="#ff4a4a"
                    strokeWidth="2"
                    points={chartData.smoke.pointsStr}
                  />
                </>
              )}

              {selectedTab === "temperature" && (
                <polyline
                  fill="none"
                  stroke="#d9ff4a"
                  strokeWidth="2.5"
                  points={chartData.temperature.pointsStr}
                />
              )}

              {selectedTab === "humidity" && (
                <polyline
                  fill="none"
                  stroke="#70a4ff"
                  strokeWidth="2.5"
                  points={chartData.humidity.pointsStr}
                />
              )}
            </svg>
          )
        )}
      </div>

      {/* Legend & Stats */}
      {selectedTab === "gases" && (
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "#4ae5ff" }} />
            <span>CH₄ Methane: <strong>{chartData ? chartData.methane.latest.toFixed(1) : "--"} ppm</strong></span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "#ffb35c" }} />
            <span>CO: <strong>{chartData ? chartData.co.latest.toFixed(1) : "--"} ppm</strong></span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "#ff4a4a" }} />
            <span>Smoke: <strong>{chartData ? chartData.smoke.latest.toFixed(1) : "--"} ppm</strong></span>
          </div>
        </div>
      )}

      {selectedTab === "temperature" && (
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "#d9ff4a" }} />
            <span>Current: <strong>{chartData ? chartData.temperature.latest.toFixed(1) : "--"} °C</strong></span>
          </div>
          <div className="legend-item">
            <span>Min: <strong>{chartData ? chartData.temperature.min.toFixed(1) : "--"} °C</strong></span>
          </div>
          <div className="legend-item">
            <span>Max: <strong>{chartData ? chartData.temperature.max.toFixed(1) : "--"} °C</strong></span>
          </div>
        </div>
      )}

      {selectedTab === "humidity" && (
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "#70a4ff" }} />
            <span>Current: <strong>{chartData ? chartData.humidity.latest.toFixed(1) : "--"} %</strong></span>
          </div>
          <div className="legend-item">
            <span>Min: <strong>{chartData ? chartData.humidity.min.toFixed(1) : "--"} %</strong></span>
          </div>
          <div className="legend-item">
            <span>Max: <strong>{chartData ? chartData.humidity.max.toFixed(1) : "--"} %</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
