"use client";

// AERIS Command Center - Realtime Dashboard
import { useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import LiveCamera from "@/components/LiveCamera";
import FlightTelemetry from "@/components/FlightTelemetry";
import MissionMap from "@/components/MissionMap";
import AIDetection from "@/components/AIDetection";
import ThermalMonitor from "@/components/ThermalMonitor";
import GasSensor from "@/components/GasSensor";
import Environment from "@/components/Environment";
import BatteryPower from "@/components/BatteryPower";
import Communication from "@/components/Communication";
import MissionStatus from "@/components/MissionStatus";
import Alerts from "@/components/Alerts";
import RescueControl from "@/components/RescueControl";
import SensorHistoryChart from "@/components/SensorHistoryChart";
import { useAerisData } from "@/hooks/useAerisData";
import { API_BASE_URL, THRESHOLDS } from "@/lib/config";

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>("Dashboard");
  const [lastDropTrigger, setLastDropTrigger] = useState<number>(0);
  const [selectedVideoSource, setSelectedVideoSource] = useState<"night" | "original">("night");

  const {
    health,
    sensors,
    history,
    detections,
    isBackendOnline,
    isSensorStale,
    lastUpdated,
    overallSafetyStatus,
    alerts,
    dropState,
    executePayloadDrop,
    clearDropFeedback,
  } = useAerisData();

  const isSensorOnline = isBackendOnline && Boolean(sensors) && !isSensorStale;
  const deviceId = sensors?.device_id || "ESP32_MINE_01";

  // Wrap payload drop to coordinate with map beacon animation
  const handleDropPayloadWithMap = useCallback(async () => {
    setLastDropTrigger(Date.now());
    return await executePayloadDrop();
  }, [executePayloadDrop]);

  return (
    <div className="app">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isBackendOnline={isBackendOnline}
        alertCount={alerts.length}
      />

      <main className="main">
        <TopBar
          isBackendOnline={isBackendOnline}
          safetyStatus={overallSafetyStatus}
          deviceId={deviceId}
          lastUpdated={lastUpdated}
        />

        <section className="hero">
          <div>
            <p className="eyebrow">
              AERIS-X1 · Mine Safety & Autonomous Rescue Platform
            </p>

            <h1>
              {activeTab === "Dashboard"
                ? "Drone Command & Rescue Operations"
                : activeTab === "Mission Map"
                ? "Autonomous Mine LiDAR SLAM Mapping"
                : activeTab === "Live Camera"
                ? "Optical & Night Vision AI Surveillance"
                : activeTab === "Sensors"
                ? "Atmospheric & Environmental Telemetry"
                : activeTab === "Gas Monitoring"
                ? "MQ-2 Multi-Gas Sensor Diagnostics"
                : activeTab === "Alerts"
                ? "Hazard Management & Rescue Actuators"
                : "System Network & Sensor Configuration"}
            </h1>
          </div>

          <div className="hero-badges">
            <span className={isBackendOnline ? "live-badge" : "alert-badge"}>
              {isBackendOnline ? "● REALTIME SSE LINK ACTIVE" : "● BACKEND OFFLINE"}
            </span>
          </div>
        </section>

        {/* ===================== VIEW: DASHBOARD (ALL) ===================== */}
        {activeTab === "Dashboard" && (
          <>
            {/* Live Camera Feed & Telemetry */}
            <section className="camera-grid">
              <LiveCamera
                sensors={sensors}
                detections={detections}
                isBackendOnline={isBackendOnline}
                streamType={selectedVideoSource}
                onStreamTypeChange={setSelectedVideoSource}
              />
              <FlightTelemetry
                sensors={sensors}
                isOnline={isBackendOnline}
              />
            </section>

            {/* Rescue Control & Hazard Alerts */}
            <section className="two-column">
              <RescueControl
                onDropPayload={handleDropPayloadWithMap}
                isLoading={dropState.isLoading}
                successMessage={dropState.successMessage}
                errorMessage={dropState.errorMessage}
                onClearFeedback={clearDropFeedback}
                isBackendOnline={isBackendOnline}
              />
              <Alerts alerts={alerts} />
            </section>

            {/* Mine Sector LiDAR Map & AI Detection */}
            <section className="two-column">
              <MissionMap
                sensors={sensors}
                isOnline={isBackendOnline}
                onDropPayload={handleDropPayloadWithMap}
                lastDropTrigger={lastDropTrigger}
              />
              <AIDetection
                detections={detections}
                sensors={sensors}
                isBackendOnline={isBackendOnline}
                videoSource={selectedVideoSource}
              />
            </section>

            {/* Sector Climate & Gas Array */}
            <section className="two-column">
              <ThermalMonitor
                sensors={sensors}
                history={history}
                isBackendOnline={isBackendOnline}
              />
              <GasSensor
                sensors={sensors}
                isOnline={isBackendOnline}
              />
            </section>

            {/* Historical Telemetry Analytics Chart */}
            <section className="one-column">
              <SensorHistoryChart
                history={history}
                isOnline={isBackendOnline}
              />
            </section>

            {/* Atmospheric Environment & Power & Comms */}
            <section className="three-column">
              <Environment
                sensors={sensors}
                isOnline={isBackendOnline}
              />
              <BatteryPower isOnline={isBackendOnline} />
              <Communication
                health={health}
                isBackendOnline={isBackendOnline}
                isSensorOnline={isSensorOnline}
              />
            </section>

            {/* Mission Status Directive */}
            <section className="one-column">
              <MissionStatus
                safetyStatus={overallSafetyStatus}
                sensors={sensors}
                detections={detections}
                isBackendOnline={isBackendOnline}
              />
            </section>
          </>
        )}

        {/* ===================== VIEW: MISSION MAP ===================== */}
        {activeTab === "Mission Map" && (
          <>
            <section className="one-column">
              <MissionMap
                sensors={sensors}
                isOnline={isBackendOnline}
                onDropPayload={handleDropPayloadWithMap}
                lastDropTrigger={lastDropTrigger}
              />
            </section>

            <section className="two-column">
              <FlightTelemetry
                sensors={sensors}
                isOnline={isBackendOnline}
              />
              <RescueControl
                onDropPayload={handleDropPayloadWithMap}
                isLoading={dropState.isLoading}
                successMessage={dropState.successMessage}
                errorMessage={dropState.errorMessage}
                onClearFeedback={clearDropFeedback}
                isBackendOnline={isBackendOnline}
              />
            </section>
          </>
        )}

        {/* ===================== VIEW: LIVE CAMERA ===================== */}
        {activeTab === "Live Camera" && (
          <>
            <section className="two-column">
              <LiveCamera
                sensors={sensors}
                detections={detections}
                isBackendOnline={isBackendOnline}
                streamType={selectedVideoSource}
                onStreamTypeChange={setSelectedVideoSource}
              />
              <AIDetection
                detections={detections}
                sensors={sensors}
                isBackendOnline={isBackendOnline}
                videoSource={selectedVideoSource}
              />
            </section>
            <section className="one-column">
              <FlightTelemetry
                sensors={sensors}
                isOnline={isBackendOnline}
              />
            </section>
          </>
        )}

        {/* ===================== VIEW: SENSORS & CLIMATE ===================== */}
        {activeTab === "Sensors" && (
          <>
            <section className="two-column">
              <ThermalMonitor
                sensors={sensors}
                history={history}
                isBackendOnline={isBackendOnline}
              />
              <Environment
                sensors={sensors}
                isOnline={isBackendOnline}
              />
            </section>

            <section className="one-column">
              <SensorHistoryChart
                history={history}
                isOnline={isBackendOnline}
              />
            </section>
          </>
        )}

        {/* ===================== VIEW: GAS MONITORING ===================== */}
        {activeTab === "Gas Monitoring" && (
          <>
            <section className="two-column">
              <GasSensor
                sensors={sensors}
                isOnline={isBackendOnline}
              />
              <Alerts alerts={alerts} />
            </section>

            <section className="one-column">
              <SensorHistoryChart
                history={history}
                isOnline={isBackendOnline}
              />
            </section>
          </>
        )}

        {/* ===================== VIEW: ALERTS & RESCUE ===================== */}
        {activeTab === "Alerts" && (
          <>
            <section className="two-column">
              <Alerts alerts={alerts} />
              <RescueControl
                onDropPayload={handleDropPayloadWithMap}
                isLoading={dropState.isLoading}
                successMessage={dropState.successMessage}
                errorMessage={dropState.errorMessage}
                onClearFeedback={clearDropFeedback}
                isBackendOnline={isBackendOnline}
              />
            </section>

            <section className="one-column">
              <MissionStatus
                safetyStatus={overallSafetyStatus}
                sensors={sensors}
                detections={detections}
                isBackendOnline={isBackendOnline}
              />
            </section>
          </>
        )}

        {/* ===================== VIEW: SETTINGS ===================== */}
        {activeTab === "Settings" && (
          <section className="one-column">
            <div className="card">
              <div className="card-header">
                <div>
                  <span className="label">SYSTEM CONFIGURATION</span>
                  <h2>AERIS Gateway & Hardware Link</h2>
                </div>
                <span className={isBackendOnline ? "good-badge" : "alert-badge"}>
                  {isBackendOnline ? "GATEWAY CONNECTED" : "OFFLINE"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "16px 0" }}>
                <div style={{ background: "#0b1016", border: "1px solid #1c2633", borderRadius: "8px", padding: "16px" }}>
                  <h3 style={{ fontSize: "13px", color: "#d9ff4a", marginBottom: "8px" }}>Hardware Endpoints</h3>
                  <p style={{ fontSize: "11px", color: "#8594a6", marginBottom: "6px" }}>
                    Backend API: <strong>{API_BASE_URL}</strong>
                  </p>
                  <p style={{ fontSize: "11px", color: "#8594a6", marginBottom: "6px" }}>
                    ESP32 Servo Drop: <strong>http://172.16.102.244/api/servo/drop</strong>
                  </p>
                  <p style={{ fontSize: "11px", color: "#8594a6" }}>
                    Sensor Realtime SSE: <strong>{API_BASE_URL}/api/sensors/stream</strong>
                  </p>
                </div>

                <div style={{ background: "#0b1016", border: "1px solid #1c2633", borderRadius: "8px", padding: "16px" }}>
                  <h3 style={{ fontSize: "13px", color: "#4ae5ff", marginBottom: "8px" }}>Safety Thresholds</h3>
                  <p style={{ fontSize: "11px", color: "#8594a6", marginBottom: "6px" }}>
                    Methane (CH4) Warning: <strong>{THRESHOLDS.methane.safeMax} ppm</strong> (Critical: {THRESHOLDS.methane.warningMax} ppm)
                  </p>
                  <p style={{ fontSize: "11px", color: "#8594a6", marginBottom: "6px" }}>
                    Carbon Monoxide (CO) Warning: <strong>{THRESHOLDS.carbonMonoxide.safeMax} ppm</strong> (Critical: {THRESHOLDS.carbonMonoxide.warningMax} ppm)
                  </p>
                  <p style={{ fontSize: "11px", color: "#8594a6" }}>
                    Temperature Warning: <strong>{THRESHOLDS.temperature.safeMax}°C</strong>
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}