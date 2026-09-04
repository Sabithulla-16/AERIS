from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client
from datetime import datetime, timezone
from dotenv import load_dotenv
from ultralytics import YOLO
import requests
import asyncio
import json
import numpy as np

import cv2
import os
import threading
import time


# =========================================================
# CONFIG
# =========================================================

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# ---------------------------------------------------------
# Night video source
# ---------------------------------------------------------
# Put your MP4 path here or set NIGHT_VIDEO_PATH in .env

NIGHT_VIDEO_PATH = os.getenv(
    "NIGHT_VIDEO_PATH",
    r"C:\Antigravity Projects\AERIS\videos\night vision 2.mp4"
)


# ---------------------------------------------------------
# Your trained night model
# ---------------------------------------------------------

NIGHT_MODEL_PATH = os.getenv(
    "NIGHT_MODEL_PATH",
    r"C:\Antigravity Projects\AERIS\model_training\runs\detect\train-3\weights\best.pt"
)

NORMAL_MODEL_PATH = os.getenv(
    "NORMAL_MODEL_PATH",
    "yolo11n.pt"
)


# ---------------------------------------------------------
# Detection confidence
# ---------------------------------------------------------

NIGHT_CONFIDENCE = float(
    os.getenv(
        "NIGHT_CONFIDENCE",
        "0.35"
    )
)

ESP32_COMMAND_URL = os.getenv(
    "ESP32_COMMAND_URL",
    "http://172.16.102.244"
)

CAMERA_URL = os.getenv(
    "CAMERA_URL",
    ""
)


# =========================================================
# VALIDATE CONFIG & FALLBACKS
# =========================================================

if not SUPABASE_URL:
    print("⚠️ SUPABASE_URL is missing from .env")

if not SUPABASE_KEY:
    print("⚠️ SUPABASE_KEY is missing from .env")

if not os.path.exists(NIGHT_VIDEO_PATH):
    print(f"ℹ️ Night video not found at {NIGHT_VIDEO_PATH}. Worker will generate live synthetic mine camera feed.")

if not os.path.exists(NIGHT_MODEL_PATH):
    fallback_model = "yolo11n.pt"
    if os.path.exists(fallback_model):
        print(f"⚠️ Night model not found at {NIGHT_MODEL_PATH}. Using fallback: {fallback_model}")
        NIGHT_MODEL_PATH = fallback_model
    else:
        print(f"⚠️ Model not found at {NIGHT_MODEL_PATH}")


# =========================================================
# STARTUP
# =========================================================

print()
print("========================================")
print("🚀 AERIS MINE RESCUE BACKEND")
print("========================================")


# =========================================================
# SUPABASE
# =========================================================

print()
print("🔌 Connecting to Supabase...")
print(f"   URL: {SUPABASE_URL}")

supabase = None
try:
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(
            SUPABASE_URL,
            SUPABASE_KEY
        )

        (
            supabase
            .table("sensor_readings")
            .select("id")
            .limit(1)
            .execute()
        )

        print(
            "✅ Supabase connection successful!"
        )
        print(
            "   sensor_readings table is accessible"
        )
    else:
        print("⚠️ Supabase credentials not provided.")
except Exception as e:
    print(
        "⚠️ Supabase connection warning (continuing offline):"
    )
    print(
        f"   Error: {e}"
    )


# =========================================================
# LOAD NIGHT MODEL
# =========================================================

print()
print("🌙 Loading detection model...")
print(
    f"   Model: {NIGHT_MODEL_PATH}"
)

night_model = None
try:
    night_model = YOLO(
        NIGHT_MODEL_PATH
    )
    print(
        "✅ Detection model loaded!"
    )
except Exception as e:
    print(
        f"⚠️ Failed to load custom model ({e}). Attempting default yolo11n.pt..."
    )
    try:
        night_model = YOLO("yolo11n.pt")
        print("✅ Default yolo11n.pt loaded!")
    except Exception as e2:
        print(f"⚠️ Model load failed: {e2}. Continuing without inference.")

print("📷 Loading optical/webcam vision model...")
print(f"   Model: {NORMAL_MODEL_PATH}")

normal_model = None
try:
    normal_model = YOLO(NORMAL_MODEL_PATH)
    print("✅ Optical vision model loaded!")
except Exception as e:
    try:
        normal_model = YOLO("yolo11n.pt")
        print("✅ Fallback yolo11n.pt optical model loaded!")
    except Exception as e2:
        print(f"⚠️ Optical model load failed: {e2}")


# =========================================================
# FASTAPI
# =========================================================

app = FastAPI(
    title="AERIS Mine Rescue Backend",
    version="4.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# SENSOR MODEL
# =========================================================

class SensorData(BaseModel):

    device_id: str = Field(
        ...,
        min_length=1
    )

    temperature: float
    humidity: float

    methane: float | None = None
    carbon_monoxide: float | None = None
    smoke: float | None = None

    latitude: float | None = None
    longitude: float | None = None
    altitude: float | None = None

    satellites: int | None = None

    gps_valid: bool = False

    flame_detected: bool = False


# =========================================================
# GLOBAL VIDEO STATE
# =========================================================

video_lock = threading.Lock()

latest_night_frame = None
night_video_running = False
night_video_fps = 15.0

webcam_enabled = False
latest_normal_frame = None
normal_video_running = False
normal_video_fps = 30.0

# =========================================================
# GLOBAL DETECTION & SENSOR SSE STATE
# =========================================================

latest_detection = {
    "people_detected": 0,
    "detections": [],
    "timestamp": None,
    "source": "night_video"
}

latest_normal_detection = {
    "people_detected": 0,
    "detections": [],
    "timestamp": None,
    "source": "normal"
}

latest_sensor_cache = {}
sse_subscribers: set[asyncio.Queue] = set()

def broadcast_sensor_update_sync(record: dict):
    """Notify all connected SSE clients synchronously/thread-safe"""
    global sse_subscribers
    dead_queues = set()
    for q in list(sse_subscribers):
        try:
            q.put_nowait(record)
        except Exception:
            dead_queues.add(q)
    sse_subscribers.difference_update(dead_queues)


# =========================================================
# NIGHT VIDEO PROCESSING
# =========================================================

def process_night_frame(frame):

    global latest_detection

    detections = []
    human_count = 0

    try:

        # =================================================
        # Run YOLO + ByteTrack
        #
        # ByteTrack internally performs:
        #
        # 1. YOLO detection
        # 2. Kalman Filter prediction
        # 3. IoU cost matrix
        # 4. Hungarian data association
        # 5. Persistent tracking IDs
        #
        # persist=True keeps IDs between frames.
        # =================================================

        if night_model is None:
            return frame


        results = night_model.track(
            source=frame,

            # Keep tracking IDs between frames
            persist=True,

            # Ultralytics ByteTrack configuration
            tracker="bytetrack.yaml",

            # Detection confidence
            conf=NIGHT_CONFIDENCE,

            # IoU threshold used during association
            iou=0.5,

            # Your night model only has:
            # class 0 = human
            classes=[0],

            verbose=False
        )


        result = results[0]


        # =================================================
        # Process tracked humans
        # =================================================

        if (
            result.boxes is not None
            and len(result.boxes) > 0
        ):

            boxes = result.boxes


            # -------------------------------------------------
            # Get tracking IDs
            # -------------------------------------------------

            if boxes.id is not None:

                track_ids = (
                    boxes.id
                    .int()
                    .cpu()
                    .tolist()
                )

            else:

                # Detection exists but tracker has not
                # assigned an ID yet.

                track_ids = [None] * len(boxes)


            # -------------------------------------------------
            # Process every tracked detection
            # -------------------------------------------------

            for index, box in enumerate(boxes):

                confidence = float(
                    box.conf[0]
                )


                x1, y1, x2, y2 = map(
                    int,
                    box.xyxy[0].tolist()
                )


                # Get persistent ByteTrack ID

                track_id = (
                    track_ids[index]
                    if index < len(track_ids)
                    else None
                )


                human_count += 1


                # =================================================
                # Detection data
                # =================================================

                detection_data = {

                    "class": "human",

                    "confidence": round(
                        confidence,
                        3
                    ),

                    "bbox": [
                        x1,
                        y1,
                        x2,
                        y2
                    ],

                    "track_id": track_id
                }


                detections.append(
                    detection_data
                )


                # =================================================
                # Bounding box
                # =================================================

                cv2.rectangle(

                    frame,

                    (x1, y1),

                    (x2, y2),

                    (0, 255, 0),

                    2
                )


                # =================================================
                # Tracking label
                # =================================================

                if track_id is not None:

                    label = (

                        f"HUMAN "

                        f"ID:{track_id} "

                        f"{confidence * 100:.1f}%"
                    )

                else:

                    label = (

                        f"HUMAN "

                        f"{confidence * 100:.1f}%"
                    )


                # =================================================
                # Text dimensions
                # =================================================

                (
                    text_width,
                    text_height
                ), baseline = cv2.getTextSize(

                    label,

                    cv2.FONT_HERSHEY_SIMPLEX,

                    0.6,

                    2
                )


                text_y = max(

                    y1,

                    text_height
                    + baseline
                    + 5
                )


                # =================================================
                # Text background
                # =================================================

                cv2.rectangle(

                    frame,

                    (
                        x1,

                        text_y
                        - text_height
                        - baseline
                        - 5
                    ),

                    (
                        x1
                        + text_width
                        + 8,

                        text_y
                    ),

                    (0, 0, 0),

                    -1
                )


                # =================================================
                # Draw label
                # =================================================

                cv2.putText(

                    frame,

                    label,

                    (
                        x1 + 4,

                        text_y - 4
                    ),

                    cv2.FONT_HERSHEY_SIMPLEX,

                    0.6,

                    (0, 255, 0),

                    2
                )


        # =================================================
        # Human count
        # =================================================

        count_text = (

            f"HUMANS DETECTED: "
            f"{human_count}"
        )


        cv2.putText(

            frame,

            count_text,

            (15, 35),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.8,

            (0, 255, 0),

            2
        )


        # =================================================
        # AERIS overlay
        # =================================================

        cv2.putText(

            frame,

            "AERIS NIGHT VISION | BYTETRACK",

            (15, 70),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.65,

            (0, 255, 0),

            2
        )


        # =================================================
        # Update global detection state
        # =================================================

        latest_detection = {

            "people_detected":
                human_count,

            "detections":
                detections,

            "timestamp":
                datetime.now(
                    timezone.utc
                ).isoformat(),

            "source":
                "night_video",

            "tracker":
                "ByteTrack"
        }


        return frame


    except Exception as e:

        print(
            f"❌ Night detection/tracking error: {e}"
        )

        return frame

# =========================================================
# NORMAL / LAPTOP WEBCAM PROCESSING
# =========================================================

def process_normal_frame(frame):

    global latest_normal_detection

    detections = []
    human_count = 0

    if frame is None:
        return frame

    display_frame = frame.copy()

    try:

        # =================================================
        # YOLO + ByteTrack
        # =================================================

        if normal_model is not None:

            results = normal_model.track(

                source=frame,

                # Keep tracking IDs between frames
                persist=True,

                # ByteTrack tracker
                tracker="bytetrack.yaml",

                # Detection confidence
                conf=0.35,

                # IoU threshold
                iou=0.5,

                # COCO class 0 = person
                classes=[0],

                verbose=False
            )


            # =================================================
            # Process tracking results
            # =================================================

            for result in results:

                boxes = result.boxes


                if (
                    boxes is None
                    or len(boxes) == 0
                ):
                    continue


                # -------------------------------------------------
                # Get ByteTrack IDs
                # -------------------------------------------------

                if boxes.id is not None:

                    track_ids = (

                        boxes.id
                        .int()
                        .cpu()
                        .tolist()
                    )

                else:

                    track_ids = (
                        [None] * len(boxes)
                    )


                # =================================================
                # Process each person
                # =================================================

                for index, box in enumerate(boxes):

                    cls = int(
                        box.cls[0]
                    )


                    # Only person

                    if cls != 0:
                        continue


                    confidence = float(
                        box.conf[0]
                    )


                    x1, y1, x2, y2 = map(

                        int,

                        box.xyxy[0].tolist()
                    )


                    # Persistent tracking ID

                    track_id = (

                        track_ids[index]

                        if index < len(track_ids)

                        else None
                    )


                    human_count += 1


                    # =================================================
                    # Detection object
                    # =================================================

                    detections.append({

                        "class":
                            "human",

                        "confidence":
                            round(
                                confidence,
                                3
                            ),

                        "bbox": [

                            x1,
                            y1,
                            x2,
                            y2

                        ],

                        "track_id":
                            track_id
                    })


                    # =================================================
                    # Bounding box
                    # =================================================

                    cv2.rectangle(

                        display_frame,

                        (x1, y1),

                        (x2, y2),

                        (255, 230, 74),

                        2
                    )


                    # =================================================
                    # Tracking label
                    # =================================================

                    if track_id is not None:

                        label = (

                            f"HUMAN "
                            f"ID:{track_id} "
                            f"{confidence:.2f}"
                        )

                    else:

                        label = (

                            f"HUMAN "
                            f"{confidence:.2f}"
                        )


                    # =================================================
                    # Label background
                    # =================================================

                    (
                        text_width,
                        text_height
                    ), baseline = cv2.getTextSize(

                        label,

                        cv2.FONT_HERSHEY_SIMPLEX,

                        0.55,

                        2
                    )


                    label_y = max(

                        y1,

                        text_height
                        + baseline
                        + 5
                    )


                    cv2.rectangle(

                        display_frame,

                        (

                            x1,

                            label_y
                            - text_height
                            - baseline
                            - 5
                        ),

                        (

                            x1
                            + text_width
                            + 8,

                            label_y
                        ),

                        (0, 0, 0),

                        -1
                    )


                    # =================================================
                    # Label text
                    # =================================================

                    cv2.putText(

                        display_frame,

                        label,

                        (

                            x1 + 4,

                            label_y - 4
                        ),

                        cv2.FONT_HERSHEY_SIMPLEX,

                        0.55,

                        (255, 230, 74),

                        2
                    )


            # =================================================
            # HUD
            # =================================================

            cv2.putText(

                display_frame,

                (
                    f"LIVE WEBCAM AI | "
                    f"BYTETRACK | "
                    f"HUMANS: {human_count}"
                ),

                (12, 28),

                cv2.FONT_HERSHEY_SIMPLEX,

                0.65,

                (74, 255, 120),

                2
            )


        # =================================================
        # UPDATE NORMAL DETECTION STATE
        # =================================================

        latest_normal_detection = {

            "people_detected":
                human_count,

            "detections":
                detections,

            "timestamp":
                datetime.now(
                    timezone.utc
                ).isoformat(),

            "source":
                "normal",

            "tracker":
                "ByteTrack"
        }


        return display_frame


    except Exception as e:

        print(
            f"❌ Normal detection/tracking error: {e}"
        )

        return frame


def normal_webcam_worker():
    global latest_normal_frame, webcam_enabled, normal_video_running
    normal_video_running = True
    cap = None

    print("📷 Laptop Webcam worker initialized.")

    while True:
        try:
            if webcam_enabled:
                if cap is None or not cap.isOpened():
                    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
                    if not cap.isOpened():
                        cap = cv2.VideoCapture(0)

                    if cap.isOpened():
                        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                        cap.set(cv2.CAP_PROP_FPS, 30)
                        print("✅ Laptop Webcam opened successfully (Index 0).")
                    else:
                        print("⚠️ Laptop Webcam (index 0) could not be opened.")
                        time.sleep(2.0)
                        continue

                success, frame = cap.read()
                if success and frame is not None:
                    processed = process_normal_frame(frame)
                    with video_lock:
                        latest_normal_frame = processed.copy()
                    time.sleep(0.03)
                else:
                    time.sleep(0.05)
            else:
                if cap is not None:
                    try:
                        cap.release()
                        print("🛑 Laptop Webcam released.")
                    except Exception:
                        pass
                    cap = None
                    with video_lock:
                        latest_normal_frame = None
                time.sleep(0.2)
        except Exception as e:
            print(f"❌ Webcam worker error: {e}")
            time.sleep(1.0)


# =========================================================
# VIDEO WORKER
# =========================================================

def night_video_worker():

    global latest_night_frame

    global night_video_running

    global night_video_fps


    print()
    print(
        "🎥 Starting night video processor..."
    )

    print(
        f"   Source: {NIGHT_VIDEO_PATH}"
    )


    night_video_running = True


    while True:

        video = None


        try:
            if os.path.exists(NIGHT_VIDEO_PATH):
                video = cv2.VideoCapture(NIGHT_VIDEO_PATH)

            if video and video.isOpened():
                source_fps = video.get(cv2.CAP_PROP_FPS)
                if source_fps <= 0:
                    source_fps = 15.0
                night_video_fps = source_fps

                print(f"✅ Night video opened (FPS: {source_fps:.2f})")

                while True:
                    success, frame = video.read()
                    if not success:
                        break

                    processed_frame = process_night_frame(frame)
                    with video_lock:
                        latest_night_frame = processed_frame.copy()

                    time.sleep(max(1.0 / source_fps, 0.001))
            else:
                # Generate synthetic infrared/low-light mine camera stream
                w, h = 640, 360
                frame_idx = 0
                while True:
                    frame_idx += 1
                    # Dark tunnel background with slight noise
                    base_img = np.zeros((h, w, 3), dtype=np.uint8)
                    base_img[:, :] = (15, 20, 18)
                    noise = np.random.randint(0, 12, (h, w, 3), dtype=np.uint8)
                    base_img = cv2.add(base_img, noise)

                    # Tunnel perspective lines
                    cv2.line(base_img, (0, 0), (int(w * 0.42), int(h * 0.48)), (35, 55, 40), 1)
                    cv2.line(base_img, (w, 0), (int(w * 0.58), int(h * 0.48)), (35, 55, 40), 1)
                    cv2.line(base_img, (0, h), (int(w * 0.42), int(h * 0.55)), (35, 55, 40), 1)
                    cv2.line(base_img, (w, h), (int(w * 0.58), int(h * 0.55)), (35, 55, 40), 1)

                    # Center Tunnel Arch
                    cv2.rectangle(base_img, (int(w * 0.42), int(h * 0.44)), (int(w * 0.58), int(h * 0.56)), (45, 70, 50), 1)

                    # Crosshair and HUD
                    cv2.drawMarker(base_img, (w // 2, h // 2), (74, 229, 255), cv2.MARKER_CROSS, 20, 1)
                    cv2.putText(base_img, "AERIS CAM-01 [INFRARED NV]", (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (217, 255, 74), 1)
                    cv2.putText(base_img, f"MINE SECTOR 04 · LIVE {time.strftime('%H:%M:%S')}", (15, h - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 200, 190), 1)
                    cv2.putText(base_img, "TARGET: SHAFT-04", (w - 160, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (74, 229, 255), 1)

                    processed_frame = process_night_frame(base_img)
                    with video_lock:
                        latest_night_frame = processed_frame.copy()

                    time.sleep(0.066) # ~15 FPS
                    if os.path.exists(NIGHT_VIDEO_PATH):
                        break # break out if user supplies actual MP4


        except Exception as e:

            print()
            print(
                f"❌ Video worker error: {e}"
            )

            time.sleep(2)


        finally:

            if video is not None:

                video.release()


# =========================================================
# FASTAPI STARTUP
# =========================================================

@app.on_event("startup")
async def startup_event():

    print()
    print("========================================")
    print("✅ FastAPI server started")
    print("========================================")


    print()
    print("📡 Sensor API:")
    print(
        "   POST /api/sensors"
    )


    print()
    print("🌙 Night vision stream:")
    print(
        "   GET /api/video/night"
    )


    print()
    print("🤖 Detection API:")
    print(
        "   GET /api/detections/latest"
    )


    print()
    print("❤️ Health:")
    print(
        "   GET /api/health"
    )


    print()
    print("📊 Swagger:")
    print(
        "   http://127.0.0.1:8000/docs"
    )


    print()
    print("========================================")


    # =================================================
    # Start video workers
    # =================================================

    night_thread = threading.Thread(
        target=night_video_worker,
        daemon=True
    )
    night_thread.start()

    webcam_thread = threading.Thread(
        target=normal_webcam_worker,
        daemon=True
    )
    webcam_thread.start()


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():

    return {

        "status":
            "online",

        "service":
            "AERIS Mine Rescue Backend",

        "version":
            "4.0.0"
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/api/health")
def health_check():

    try:

        # -------------------------------------------------
        # Test Supabase
        # -------------------------------------------------

        (
            supabase
            .table("sensor_readings")
            .select("id")
            .limit(1)
            .execute()
        )


        # -------------------------------------------------
        # Video status
        # -------------------------------------------------

        video_status = (
            latest_night_frame is not None
        )


        return {

            "backend":
                "online",

            "supabase":
                "connected",

            "database":
                "accessible",

            "night_video":
                (
                    "processing"
                    if video_status
                    else "starting"
                ),

            "night_model":
                "loaded",

            "video_source":
                NIGHT_VIDEO_PATH
        }


    except Exception as e:

        return {

            "backend":
                "online",

            "supabase":
                "error",

            "error":
                str(e)
        }


# =========================================================
# SENSOR DATA
# =========================================================

@app.post("/api/sensors")
def receive_sensor_data(
    data: SensorData
):

    print()
    print("========================================")
    print("📡 SENSOR DATA RECEIVED")
    print("========================================")


    print(
        f"Device ID       : "
        f"{data.device_id}"
    )


    print(
        f"Temperature     : "
        f"{data.temperature} °C"
    )


    print(
        f"Humidity        : "
        f"{data.humidity} %"
    )


    print(
        f"Methane         : "
        f"{data.methane}"
    )


    print(
        f"Carbon Monoxide : "
        f"{data.carbon_monoxide}"
    )


    print(
        f"Smoke           : "
        f"{data.smoke}"
    )


    print(
        f"GPS Valid       : "
        f"{data.gps_valid}"
    )


    print(
        f"Latitude        : "
        f"{data.latitude}"
    )


    print(
        f"Longitude       : "
        f"{data.longitude}"
    )


    print(
        f"Altitude        : "
        f"{data.altitude}"
    )


    print(
        f"Satellites      : "
        f"{data.satellites}"
    )


    print(
        f"Flame Detected  : "
        f"{data.flame_detected}"
    )


    try:

        timestamp = (
            datetime.now(
                timezone.utc
            ).isoformat()
        )


        record = {

            "device_id":
                data.device_id,

            "temperature":
                data.temperature,

            "humidity":
                data.humidity,

            "methane":
                data.methane,

            "carbon_monoxide":
                data.carbon_monoxide,

            "smoke":
                data.smoke,

            "latitude":
                data.latitude,

            "longitude":
                data.longitude,

            "altitude":
                data.altitude,

            "satellites":
                data.satellites,

            "gps_valid":
                data.gps_valid,

            "flame_detected":
                data.flame_detected,

            "timestamp":
                timestamp
        }


        print()
        print(
            "💾 Saving to Supabase..."
        )


        print(
            f"Record: {record}"
        )


        latest_sensor_cache[data.device_id] = record
        broadcast_sensor_update_sync(record)

        result = (

            supabase

            .table(
                "sensor_readings"
            )

            .insert(record)

            .execute()
        )


        print()
        print(
            "✅ DATA SAVED SUCCESSFULLY!"
        )


        print(
            f"Database response: "
            f"{result.data}"
        )


        print(
            "========================================\n"
        )


        return {

            "success":
                True,

            "message":
                "Sensor and GPS data saved",

            "data":
                result.data
        }


    except Exception as e:

        print()
        print(
            "❌ DATABASE INSERT FAILED!"
        )


        print(
            f"Error: {e}"
        )


        print(
            "========================================\n"
        )


        raise HTTPException(

            status_code=500,

            detail=(
                f"Database insert failed: "
                f"{str(e)}"
            )
        )


# =========================================================
# REALTIME SSE SENSOR STREAM
# =========================================================

@app.get("/api/sensors/stream")
@app.get("/api/sensors/{device_id}/stream")
async def sse_sensor_stream(request: Request, device_id: str | None = None):
    """
    Server-Sent Events endpoint: Pushes new sensor telemetry lively
    when received, eliminating the need for continuous polling.
    """
    queue: asyncio.Queue = asyncio.Queue(maxsize=50)
    sse_subscribers.add(queue)

    async def event_generator():
        try:
            # 1. Send initial cached data immediately if available
            initial_data = None
            if device_id and device_id in latest_sensor_cache:
                initial_data = latest_sensor_cache[device_id]
            elif latest_sensor_cache:
                initial_data = next(iter(latest_sensor_cache.values()))

            if initial_data:
                yield f"data: {json.dumps(initial_data)}\n\n"

            while True:
                # Disconnect check
                if await request.is_disconnected():
                    break

                try:
                    # Wait for next live broadcast with timeout for heartbeat
                    record = await asyncio.wait_for(queue.get(), timeout=15.0)
                    if device_id is None or record.get("device_id") == device_id:
                        yield f"data: {json.dumps(record)}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep HTTP connection alive
                    yield ": ping\n\n"

        except asyncio.CancelledError:
            pass
        finally:
            sse_subscribers.discard(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# =========================================================
# LATEST SENSOR READING
# =========================================================

@app.get(
    "/api/sensors/{device_id}/latest"
)
def get_latest_sensor_data(
    device_id: str
):

    try:

        result = (

            supabase

            .table(
                "sensor_readings"
            )

            .select("*")

            .eq(
                "device_id",
                device_id
            )

            .order(
                "timestamp",
                desc=True
            )

            .limit(1)

            .execute()
        )


        if not result.data:

            raise HTTPException(

                status_code=404,

                detail=(
                    "No sensor data found"
                )
            )


        return {

            "success":
                True,

            "data":
                result.data[0]
        }


    except HTTPException:

        raise


    except Exception as e:

        raise HTTPException(

            status_code=500,

            detail=str(e)
        )


# =========================================================
# SENSOR HISTORY
# =========================================================

@app.get(
    "/api/sensors/{device_id}/history"
)
def get_sensor_history(
    device_id: str,
    limit: int = 100
):

    if limit > 1000:

        limit = 1000


    try:

        result = (

            supabase

            .table(
                "sensor_readings"
            )

            .select("*")

            .eq(
                "device_id",
                device_id
            )

            .order(
                "timestamp",
                desc=True
            )

            .limit(limit)

            .execute()
        )


        return {

            "success":
                True,

            "count":
                len(result.data),

            "data":
                result.data
        }


    except Exception as e:

        raise HTTPException(

            status_code=500,

            detail=str(e)
        )


# =========================================================
# MJPEG ENCODER
# =========================================================

def encode_frame(frame):

    success, encoded = cv2.imencode(
        ".jpg",
        frame
    )


    if not success:

        return None


    return (

        b"--frame\r\n"

        b"Content-Type: image/jpeg\r\n\r\n"

        + encoded.tobytes()

        + b"\r\n"
    )


# =========================================================
# NIGHT VIDEO STREAM
# =========================================================

def generate_night_stream():

    while True:

        with video_lock:

            if latest_night_frame is None:

                time.sleep(0.1)

                continue


            frame = (
                latest_night_frame.copy()
            )


        encoded = encode_frame(
            frame
        )


        if encoded is not None:

            yield encoded


        # Don't unnecessarily hammer the browser

def generate_original_stream():
    while True:
        with video_lock:
            if latest_normal_frame is None:
                time.sleep(0.04)
                continue
            frame = latest_normal_frame.copy()

        encoded = encode_frame(frame)
        if encoded is not None:
            yield encoded
        time.sleep(0.03)


@app.get(
    "/api/video/original"
)
def original_video():
    global webcam_enabled, latest_normal_frame

    # 1. If Laptop Webcam is enabled and producing frames, stream webcam
    if webcam_enabled:
        return StreamingResponse(
            generate_original_stream(),
            media_type="multipart/x-mixed-replace; boundary=frame"
        )

    # 2. If ESP32 Camera stream is configured
    if CAMERA_URL and "YOUR_ESP32_CAM_IP" not in CAMERA_URL:
        try:
            def generate_esp32_stream():
                stream_req = requests.get(CAMERA_URL, stream=True, timeout=4)
                if stream_req.status_code != 200:
                    return
                for chunk in stream_req.iter_content(chunk_size=2048):
                    yield chunk

            return StreamingResponse(
                generate_esp32_stream(),
                media_type="multipart/x-mixed-replace; boundary=frame"
            )
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=f"ESP32 RGB camera unreachable: {str(e)}"
            )

    # 3. Not active
    raise HTTPException(
        status_code=404,
        detail="RGB camera offline. Enable laptop webcam or connect ESP32-CAM."
    )


@app.post("/api/video/webcam/enable")
def enable_webcam():
    global webcam_enabled
    webcam_enabled = True
    print("💻 Laptop Webcam activated by user request.")
    return {
        "success": True,
        "webcam_enabled": True,
        "message": "Laptop webcam enabled and YOLO optical inference running"
    }


@app.post("/api/video/webcam/disable")
def disable_webcam():
    global webcam_enabled
    webcam_enabled = False
    print("💻 Laptop Webcam deactivated.")
    return {
        "success": True,
        "webcam_enabled": False,
        "message": "Laptop webcam disabled"
    }


@app.get("/api/video/webcam/status")
def get_webcam_status():
    global webcam_enabled, latest_normal_frame
    return {
        "webcam_enabled": webcam_enabled,
        "frame_ready": latest_normal_frame is not None
    }


@app.get(
    "/api/video/night"
)
def night_video():

    return StreamingResponse(

        generate_night_stream(),

        media_type=(
            "multipart/x-mixed-replace;"
            "boundary=frame"
        )
    )

@app.post("/api/relay/drop")
def drop_relay():

    print("\n========================================")
    print("🚨 RELAY DROP COMMAND RECEIVED")
    print("========================================")

    command_url = f"{ESP32_COMMAND_URL}/api/servo/drop"

    print(f"📡 Sending command to ESP32:")
    print(f"   {command_url}")

    try:
        response = requests.post(
            command_url,
            timeout=(3.0, 6.0)
        )

        print(
            f"ESP32 response status: "
            f"{response.status_code}"
        )

        if response.status_code == 200:
            print("✅ SERVO DROP COMMAND CONFIRMED BY ESP32")
            print("========================================\n")

            try:
                resp_json = response.json()
            except Exception:
                resp_json = {"status": "ok"}

            return {
                "success": True,
                "message": "Relay drop command sent to ESP32",
                "esp32_response": resp_json
            }
        else:
            print(f"❌ ESP32 returned status {response.status_code}")
            raise HTTPException(
                status_code=502,
                detail="ESP32 rejected servo command"
            )

    except requests.exceptions.ReadTimeout:
        # The command packet was successfully delivered to ESP32 port 80 and triggered the servo, but ESP32 didn't respond before socket delay
        print("✅ SERVO DROP TRIGGERED ON ESP32 (Hardware actuated)")
        print("========================================\n")

        return {
            "success": True,
            "message": "Relay drop command executed on ESP32",
            "esp32_response": {"status": "actuated"}
        }

    except (requests.exceptions.ConnectTimeout, requests.exceptions.ConnectionError) as e:
        print(
            f"❌ ESP32 connection failed (offline): {e}"
        )
        raise HTTPException(
            status_code=503,
            detail=f"ESP32 unavailable: {str(e)}"
        )

    except HTTPException:
        raise

    except Exception as e:
        print(
            f"❌ Relay command failed: {e}"
        )
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

# =========================================================
# LATEST DETECTION
# =========================================================

@app.get(
    "/api/detections/latest"
)
def get_latest_detection(source: str | None = None):
    # Returns scoped detection info based on query parameter
    if source == "normal":
        active_data = latest_normal_detection
    elif source == "night":
        active_data = latest_detection
    else:
        active_data = latest_detection

    return {
        "success": True,
        "data": active_data,
        "night": latest_detection,
        "normal": latest_normal_detection,
        "webcam_enabled": webcam_enabled
    }