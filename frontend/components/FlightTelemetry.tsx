"use client";

import { SensorReading } from "@/lib/api";

interface FlightTelemetryProps {
  sensors: SensorReading | null;
  isOnline: boolean;
}

export default function FlightTelemetry({
  sensors,
  isOnline,
}: FlightTelemetryProps) {
  const telemetry = [
    ["Tunnel Altitude", "18.5 m"],
    ["Ground Speed", "14 km/h (Simulated)"],
    ["Heading / Dir", "North-East 042°"],
    ["Vertical Speed", "0.2 m/s"],
    ["Flight Time", "24 min"],
    ["Pitch / Roll", "+1.2° / -0.4°"],
    ["Sector Coordinates", "12.9716, 77.5946"],
    ["ESP32 Telemetry", isOnline ? "98% (ESP-NOW)" : "0% (OFFLINE)"],
  ];

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <span className="label">FLIGHT TELEMETRY (SIMULATED DYNAMICS)</span>
          <h2>Drone Flight & Navigation</h2>
        </div>

        <span className={isOnline ? "good-badge" : "alert-badge"}>
          {isOnline ? "TELEMETRY LINK" : "DISCONNECTED"}
        </span>
      </div>

      <div className="telemetry-grid">
        {telemetry.map(([name, value]) => (
          <div className="metric" key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="unit">
        UNIT AERIS-X1 · VTOL Mine Recon Drone · ID: {sensors?.device_id || "ESP32_MINE_01"}
      </div>
    </div>
  );
}