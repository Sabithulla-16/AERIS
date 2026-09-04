export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "http://127.0.0.1:8000";

export const DEFAULT_DEVICE_ID =
  process.env.NEXT_PUBLIC_DEFAULT_DEVICE_ID || "ESP32_MINE_01";

// Centralized Safety Thresholds
export const THRESHOLDS = {
  carbonMonoxide: {
    safeMax: 25, // ppm
    warningMax: 50,
  },
  methane: {
    safeMax: 1.0, // %
    warningMax: 2.0, // %
  },
  smoke: {
    safeMax: 100, // ppm
    warningMax: 300,
  },
  temperature: {
    safeMax: 45, // °C
    warningMax: 55,
  },
  humidity: {
    min: 20, // %
    max: 85,
  },
};

// Polling intervals in milliseconds
export const POLLING_INTERVALS = {
  SENSORS: 2000,
  DETECTIONS: 2000,
  HEALTH: 5000,
  HISTORY: 10000,
};

// Video Stream Endpoints
export const getVideoOriginalUrl = (): string => `${API_BASE_URL}/api/video/original`;
export const getVideoNightUrl = (): string => `${API_BASE_URL}/api/video/night`;
export const getSensorStreamUrl = (deviceId?: string): string =>
  deviceId
    ? `${API_BASE_URL}/api/sensors/${deviceId}/stream`
    : `${API_BASE_URL}/api/sensors/stream`;
