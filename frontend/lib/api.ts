import { API_BASE_URL, DEFAULT_DEVICE_ID } from "./config";

export interface HealthStatus {
  backend: string;
  supabase: string;
  database?: string;
  camera?: string;
  night_video?: string;
  night_model?: string;
  video_source?: string;
  error?: string;
}

export interface SensorReading {
  id?: number | string;
  device_id: string;
  temperature: number;
  humidity: number;
  methane?: number | null;
  carbon_monoxide?: number | null;
  smoke?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  satellites?: number | null;
  gps_valid: boolean;
  flame_detected: boolean;
  timestamp: string;
}

export interface DetectionItem {
  class: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface DetectionData {
  people_detected: number;
  detections: DetectionItem[];
  timestamp: string | null;
  source: string;
  normal?: {
    people_detected: number;
    detections: DetectionItem[];
  };
  night?: {
    people_detected: number;
    detections: DetectionItem[];
  };
}

export interface PayloadDropResponse {
  success: boolean;
  message: string;
  esp32_response?: any;
  error?: string;
}

/**
 * Fetch system health status
 */
export async function getHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE_URL}/api/health`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Health check failed with status: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch latest sensor reading for a specific device
 */
export async function getLatestSensors(
  deviceId: string = DEFAULT_DEVICE_ID
): Promise<SensorReading> {
  const res = await fetch(`${API_BASE_URL}/api/sensors/${encodeURIComponent(deviceId)}/latest`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch latest sensor reading (${res.status})`);
  }
  const json = await res.json();
  return json.data || json;
}

/**
 * Fetch sensor historical records for charts
 */
export async function getSensorHistory(
  deviceId: string = DEFAULT_DEVICE_ID,
  limit: number = 50
): Promise<SensorReading[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/sensors/${encodeURIComponent(deviceId)}/history?limit=${limit}`,
    {
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch sensor history (${res.status})`);
  }
  const json = await res.json();
  const data = json.data || [];
  // Backend returns newest first (desc); reverse so charts show chronologically
  return Array.isArray(data) ? [...data].reverse() : [];
}

/**
 * Fetch latest AI detection state
 */
export async function getLatestDetections(): Promise<DetectionData> {
  const res = await fetch(`${API_BASE_URL}/api/detections/latest`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch latest detections (${res.status})`);
  }
  const json = await res.json();
  return json.data || json;
}

/**
 * Trigger physical rescue payload release via FastAPI -> ESP32
 */
export async function dropPayload(): Promise<PayloadDropResponse> {
  const res = await fetch(`${API_BASE_URL}/api/relay/drop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const json = await res.json().catch(() => ({}));

  // Backend returns 200 even when ESP32 read-times out (servo actuated but no response body)
  // Treat any successful status as servo triggered; only real connection failures surface errors
  if (!res.ok && res.status !== 503) {
    throw new Error(json.detail || json.message || `Relay drop failed with status ${res.status}`);
  }

  // If 503 is returned with ESP32 unavailable detail, it's a real offline ESP32 - re-throw
  if (res.status === 503) {
    const detail: string = json.detail || "";
    if (detail.includes("ConnectTimeout") || detail.includes("ConnectionError") || detail.includes("connection")) {
      throw new Error(`ESP32 is offline: ${detail}`);
    }
    // Otherwise treat as success (servo fired, response timed out)
    return { success: true, message: "Relay drop executed", esp32_response: json };
  }

  return json;
}

/**
 * Enable laptop webcam on FastAPI backend for YOLO optical inference
 */
export async function enableWebcam(): Promise<{ success: boolean; webcam_enabled: boolean; message?: string }> {
  const res = await fetch(`${API_BASE_URL}/api/video/webcam/enable`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to enable webcam (${res.status})`);
  return res.json();
}

/**
 * Disable laptop webcam on FastAPI backend
 */
export async function disableWebcam(): Promise<{ success: boolean; webcam_enabled: boolean; message?: string }> {
  const res = await fetch(`${API_BASE_URL}/api/video/webcam/disable`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to disable webcam (${res.status})`);
  return res.json();
}

/**
 * Check laptop webcam status on backend
 */
export async function getWebcamStatus(): Promise<{ webcam_enabled: boolean; frame_ready: boolean }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/video/webcam/status`, {
      cache: "no-store",
    });
    if (!res.ok) return { webcam_enabled: false, frame_ready: false };
    return res.json();
  } catch {
    return { webcam_enabled: false, frame_ready: false };
  }
}
