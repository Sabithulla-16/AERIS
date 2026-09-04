"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getHealth,
  getLatestSensors,
  getSensorHistory,
  getLatestDetections,
  dropPayload,
  HealthStatus,
  SensorReading,
  DetectionData,
  PayloadDropResponse,
} from "@/lib/api";
import {
  THRESHOLDS,
  POLLING_INTERVALS,
  DEFAULT_DEVICE_ID,
  getSensorStreamUrl,
} from "@/lib/config";

export interface AerisAlert {
  id: string;
  type: "CRITICAL" | "WARNING" | "INFO";
  category: "FIRE" | "HUMAN" | "GAS" | "SYSTEM" | "GPS";
  title: string;
  message: string;
  detail?: string;
  timestamp: string;
}

export type SafetyStatus = "SAFE" | "WARNING" | "CRITICAL" | "EMERGENCY";

export function useAerisData(deviceId: string = DEFAULT_DEVICE_ID) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [sensors, setSensors] = useState<SensorReading | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [detections, setDetections] = useState<DetectionData | null>(null);

  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [isSensorsLoading, setIsSensorsLoading] = useState<boolean>(true);
  const [isHealthLoading, setIsHealthLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [dropState, setDropState] = useState<{
    isLoading: boolean;
    successMessage: string | null;
    errorMessage: string | null;
  }>({
    isLoading: false,
    successMessage: null,
    errorMessage: null,
  });

  // Fetch Health
  const fetchHealth = useCallback(async () => {
    try {
      const data = await getHealth();
      setHealth(data);
      setIsBackendOnline(data.backend === "online");
    } catch {
      setIsBackendOnline(false);
      setHealth(null);
    } finally {
      setIsHealthLoading(false);
    }
  }, []);

  // Fetch Latest Sensors (Initial fallback/bootstrap)
  const fetchSensors = useCallback(async () => {
    try {
      const data = await getLatestSensors(deviceId);
      setSensors(data);
      setLastUpdated(new Date());
    } catch {
      // keep sensors as is
    } finally {
      setIsSensorsLoading(false);
    }
  }, [deviceId]);

  // Fetch Sensor History
  const fetchHistory = useCallback(async () => {
    try {
      const data = await getSensorHistory(deviceId, 30);
      setHistory(data);
    } catch {
      // ignore
    }
  }, [deviceId]);

  // Fetch AI Detections
  const fetchDetections = useCallback(async () => {
    try {
      const data = await getLatestDetections();
      setDetections(data);
    } catch {
      // ignore
    }
  }, []);

  // Realtime SSE Sensor Stream Subscription (No continuous polling)
  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    let eventSource: EventSource | null = null;
    let isCancelled = false;

    const connectSSE = () => {
      try {
        const streamUrl = getSensorStreamUrl(deviceId);
        eventSource = new EventSource(streamUrl);

        eventSource.onmessage = (event) => {
          if (isCancelled) return;
          try {
            const data: SensorReading = JSON.parse(event.data);
            if (data && data.device_id) {
              setSensors(data);
              setLastUpdated(new Date());
              setIsSensorsLoading(false);
              setIsBackendOnline(true);
            }
          } catch {
            // ping comment or parse issue
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Retry connecting after 4 seconds
          if (!isCancelled) {
            setTimeout(connectSSE, 4000);
          }
        };
      } catch {
        if (!isCancelled) {
          setTimeout(connectSSE, 5000);
        }
      }
    };

    connectSSE();

    return () => {
      isCancelled = true;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [deviceId]);

  // Initial loads and background sync
  useEffect(() => {
    fetchHealth();
    fetchSensors();
    fetchHistory();
    fetchDetections();

    const healthTimer = setInterval(fetchHealth, POLLING_INTERVALS.HEALTH);
    const detectionsTimer = setInterval(fetchDetections, POLLING_INTERVALS.DETECTIONS);
    const historyTimer = setInterval(fetchHistory, POLLING_INTERVALS.HISTORY);

    return () => {
      clearInterval(healthTimer);
      clearInterval(detectionsTimer);
      clearInterval(historyTimer);
    };
  }, [fetchHealth, fetchSensors, fetchHistory, fetchDetections]);

  // Stale detection: if no sensor data received within last 15 seconds
  const isSensorStale = useMemo(() => {
    if (!sensors?.timestamp) return true;
    try {
      const sensorTime = new Date(sensors.timestamp).getTime();
      const now = new Date().getTime();
      return now - sensorTime > 30000; // >30s considered stale
    } catch {
      return true;
    }
  }, [sensors]);

  // Overall Safety Status Calculation
  const { overallSafetyStatus, safetyReasons, alerts } = useMemo(() => {
    const reasons: string[] = [];
    const activeAlerts: AerisAlert[] = [];
    const nowIso = new Date().toISOString();

    let flameDetected = Boolean(sensors?.flame_detected);
    let peopleCount = detections?.people_detected ?? 0;

    let hasCriticalGas = false;
    let hasWarningGas = false;

    if (sensors) {
      // Methane
      if (sensors.methane !== null && sensors.methane !== undefined) {
        if (sensors.methane > THRESHOLDS.methane.warningMax) {
          hasCriticalGas = true;
          reasons.push(`Critical Methane Level (${sensors.methane.toFixed(2)}%)`);
          activeAlerts.push({
            id: "gas-ch4-critical",
            type: "CRITICAL",
            category: "GAS",
            title: "CRITICAL METHANE LEVEL",
            message: `Methane detected at ${sensors.methane.toFixed(2)}% (Threshold: ${THRESHOLDS.methane.warningMax}%)`,
            timestamp: sensors.timestamp || nowIso,
          });
        } else if (sensors.methane > THRESHOLDS.methane.safeMax) {
          hasWarningGas = true;
          reasons.push(`Elevated Methane Level (${sensors.methane.toFixed(2)}%)`);
          activeAlerts.push({
            id: "gas-ch4-warn",
            type: "WARNING",
            category: "GAS",
            title: "ELEVATED METHANE",
            message: `Methane at ${sensors.methane.toFixed(2)}%`,
            timestamp: sensors.timestamp || nowIso,
          });
        }
      }

      // Carbon Monoxide
      if (sensors.carbon_monoxide !== null && sensors.carbon_monoxide !== undefined) {
        if (sensors.carbon_monoxide > THRESHOLDS.carbonMonoxide.warningMax) {
          hasCriticalGas = true;
          reasons.push(`Critical Carbon Monoxide (${sensors.carbon_monoxide} ppm)`);
          activeAlerts.push({
            id: "gas-co-critical",
            type: "CRITICAL",
            category: "GAS",
            title: "LETHAL CO LEVEL",
            message: `Carbon Monoxide at ${sensors.carbon_monoxide} ppm!`,
            timestamp: sensors.timestamp || nowIso,
          });
        } else if (sensors.carbon_monoxide > THRESHOLDS.carbonMonoxide.safeMax) {
          hasWarningGas = true;
          reasons.push(`Elevated Carbon Monoxide (${sensors.carbon_monoxide} ppm)`);
          activeAlerts.push({
            id: "gas-co-warn",
            type: "WARNING",
            category: "GAS",
            title: "ELEVATED CO",
            message: `Carbon Monoxide at ${sensors.carbon_monoxide} ppm`,
            timestamp: sensors.timestamp || nowIso,
          });
        }
      }

      // Smoke
      if (sensors.smoke !== null && sensors.smoke !== undefined) {
        if (sensors.smoke > THRESHOLDS.smoke.warningMax) {
          hasCriticalGas = true;
          reasons.push(`Dangerous Smoke Concentration (${sensors.smoke} ppm)`);
          activeAlerts.push({
            id: "smoke-critical",
            type: "CRITICAL",
            category: "GAS",
            title: "HEAVY SMOKE DETECTED",
            message: `Smoke density at ${sensors.smoke} ppm`,
            timestamp: sensors.timestamp || nowIso,
          });
        } else if (sensors.smoke > THRESHOLDS.smoke.safeMax) {
          hasWarningGas = true;
          reasons.push(`Elevated Smoke (${sensors.smoke} ppm)`);
        }
      }

      // Temperature
      if (sensors.temperature > THRESHOLDS.temperature.warningMax) {
        reasons.push(`Extreme Ambient Temperature (${sensors.temperature.toFixed(1)}°C)`);
        activeAlerts.push({
          id: "temp-critical",
          type: "CRITICAL",
          category: "FIRE",
          title: "HIGH THERMAL READING",
          message: `Temperature reached ${sensors.temperature.toFixed(1)}°C`,
          timestamp: sensors.timestamp || nowIso,
        });
      }
    }

    // Flame detection
    if (flameDetected) {
      reasons.push("FLAME / FIRE SOURCE DETECTED");
      activeAlerts.unshift({
        id: "flame-active",
        type: "CRITICAL",
        category: "FIRE",
        title: "ACTIVE FLAME DETECTED",
        message: "Optical flame sensor triggered in mine shaft",
        timestamp: sensors?.timestamp || nowIso,
      });
    }

    // AI Human detection
    if (peopleCount > 0) {
      const topConfidence = detections?.detections?.[0]?.confidence
        ? `${Math.round(detections.detections[0].confidence * 100)}%`
        : "AI Verified";
      reasons.push(`${peopleCount} Human(s) Detected in Sector`);
      activeAlerts.unshift({
        id: "human-detected",
        type: flameDetected || hasCriticalGas ? "CRITICAL" : "INFO",
        category: "HUMAN",
        title: "HUMAN PRESENCE DETECTED",
        message: `${peopleCount} person(s) identified in camera stream`,
        detail: `Confidence: ${topConfidence}`,
        timestamp: detections?.timestamp || nowIso,
      });
    }

    // Backend / Supabase check
    if (!isBackendOnline) {
      activeAlerts.unshift({
        id: "backend-offline",
        type: "CRITICAL",
        category: "SYSTEM",
        title: "BACKEND DISCONNECTED",
        message: "Cannot establish link to FastAPI backend server",
        timestamp: nowIso,
      });
    } else if (health?.supabase === "error") {
      activeAlerts.push({
        id: "supabase-error",
        type: "WARNING",
        category: "SYSTEM",
        title: "DATABASE LINK DEGRADED",
        message: "Supabase persistence link reported an error",
        timestamp: nowIso,
      });
    }

    let status: SafetyStatus = "SAFE";

    if (!isBackendOnline || (flameDetected && peopleCount > 0) || (hasCriticalGas && peopleCount > 0)) {
      status = "EMERGENCY";
    } else if (flameDetected || hasCriticalGas) {
      status = "CRITICAL";
    } else if (hasWarningGas || isSensorStale) {
      status = "WARNING";
    }

    return {
      overallSafetyStatus: status,
      safetyReasons: reasons,
      alerts: activeAlerts,
    };
  }, [sensors, detections, isBackendOnline, health, isSensorStale]);

  // Handle Payload Drop
  const executePayloadDrop = useCallback(async (): Promise<PayloadDropResponse> => {
    setDropState({
      isLoading: true,
      successMessage: null,
      errorMessage: null,
    });

    try {
      const res = await dropPayload();
      setDropState({
        isLoading: false,
        successMessage: res.message || "Rescue payload drop command executed successfully!",
        errorMessage: null,
      });
      return res;
    } catch (err: any) {
      const msg = err.message || "Payload drop command failed";
      setDropState({
        isLoading: false,
        successMessage: null,
        errorMessage: msg,
      });
      throw err;
    }
  }, []);

  const clearDropFeedback = useCallback(() => {
    setDropState((prev) => ({
      ...prev,
      successMessage: null,
      errorMessage: null,
    }));
  }, []);

  return {
    health,
    sensors,
    history,
    detections,
    isBackendOnline,
    isSensorsLoading,
    isHealthLoading,
    isSensorStale,
    lastUpdated,
    overallSafetyStatus,
    safetyReasons,
    alerts,
    dropState,
    executePayloadDrop,
    clearDropFeedback,
    refetchSensors: fetchSensors,
    refetchHistory: fetchHistory,
  };
}
