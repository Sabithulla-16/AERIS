"use client";

interface BatteryPowerProps {
  isOnline?: boolean;
}

export default function BatteryPower({ isOnline = true }: BatteryPowerProps) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <span className="label">BATTERY / POWER (4S LiPo)</span>
          <h2>Power System</h2>
        </div>

        <span className={isOnline ? "good-badge" : "alert-badge"}>
          {isOnline ? "NORMAL" : "STANDBY"}
        </span>
      </div>

      <div className="battery-value">
        <strong>{isOnline ? "84%" : "--%"}</strong>
        <span>{isOnline ? "16.1V" : "--V"}</span>
      </div>

      <div className="progress">
        <div style={{ width: isOnline ? "84%" : "0%" }} />
      </div>

      <div className="battery-info">
        <span>Est. Mission Time</span>
        <strong>{isOnline ? "3h 15m" : "--"}</strong>
      </div>

      <div className="battery-info">
        <span>Current Draw</span>
        <strong>{isOnline ? "3.2A NOMINAL" : "OFFLINE"}</strong>
      </div>
    </div>
  );
}