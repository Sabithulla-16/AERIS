import cv2
import time
import numpy as np
from ultralytics import YOLO


# =========================================================
# CONFIG
# =========================================================

CAMERA_INDEX = 0

# Normal/general person detection
NORMAL_MODEL_PATH = "yolo11n.pt"

# Your trained night-vision human model
NIGHT_MODEL_PATH = (
    r"C:\Antigravity Projects\AERIS\model_training"
    r"\runs\detect\train-3\weights\best.pt"
)

CONFIDENCE = 0.35


# =========================================================
# LOAD MODELS
# =========================================================

print("\n========================================")
print("🚀 AERIS NIGHT VISION AI DEMO")
print("========================================")


print("\n🤖 Loading normal YOLO model...")

normal_model = YOLO(
    NORMAL_MODEL_PATH
)

print("✅ Normal model loaded")


print("\n🌙 Loading custom night model...")

night_model = YOLO(
    NIGHT_MODEL_PATH
)

print("✅ Night model loaded")

print("   Model class: human")


# =========================================================
# CAMERA
# =========================================================

print("\n📷 Opening laptop camera...")

cap = cv2.VideoCapture(
    CAMERA_INDEX
)


if not cap.isOpened():

    print(
        "❌ Could not open laptop camera"
    )

    raise SystemExit


print("✅ Laptop camera connected")


# Camera resolution

cap.set(
    cv2.CAP_PROP_FRAME_WIDTH,
    640
)

cap.set(
    cv2.CAP_PROP_FRAME_HEIGHT,
    480
)


# =========================================================
# NIGHT VISION
# =========================================================

def create_night_vision(frame):

    # -----------------------------------------------------
    # 1. Convert to grayscale
    # -----------------------------------------------------

    gray = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2GRAY
    )


    # -----------------------------------------------------
    # 2. Remove sensor noise
    # -----------------------------------------------------

    gray = cv2.GaussianBlur(
        gray,
        (3, 3),
        0
    )


    # -----------------------------------------------------
    # 3. Improve local contrast
    # -----------------------------------------------------

    clahe = cv2.createCLAHE(
        clipLimit=3.0,
        tileGridSize=(8, 8)
    )

    enhanced = clahe.apply(
        gray
    )


    # -----------------------------------------------------
    # 4. Gamma correction
    #
    # Brightens dark areas without simply
    # increasing everything equally.
    # -----------------------------------------------------

    gamma = 0.65

    lookup_table = np.array(
        [
            (
                ((i / 255.0) ** gamma)
                * 255
            )
            for i in range(256)
        ],
        dtype=np.uint8
    )

    enhanced = cv2.LUT(
        enhanced,
        lookup_table
    )


    # -----------------------------------------------------
    # 5. Slight sharpening
    # -----------------------------------------------------

    blur = cv2.GaussianBlur(
        enhanced,
        (0, 0),
        1.0
    )

    enhanced = cv2.addWeighted(
        enhanced,
        1.4,
        blur,
        -0.4,
        0
    )


    # -----------------------------------------------------
    # 6. Create green phosphor night vision
    # -----------------------------------------------------

    night = np.zeros(
        (
            enhanced.shape[0],
            enhanced.shape[1],
            3
        ),
        dtype=np.uint8
    )


    # OpenCV uses BGR

    night[:, :, 0] = (
        enhanced * 0.20
    ).astype(np.uint8)

    night[:, :, 1] = enhanced

    night[:, :, 2] = (
        enhanced * 0.05
    ).astype(np.uint8)


    # -----------------------------------------------------
    # 7. Slight vignette
    # -----------------------------------------------------

    h, w = enhanced.shape

    kernel_x = cv2.getGaussianKernel(
        w,
        w / 2
    )

    kernel_y = cv2.getGaussianKernel(
        h,
        h / 2
    )

    vignette = (
        kernel_y @ kernel_x.T
    )


    vignette = vignette / vignette.max()


    # Keep the vignette subtle

    vignette = (
        0.55 +
        0.45 * vignette
    )


    night = (
        night.astype(np.float32)
        * vignette[:, :, None]
    )


    night = np.clip(
        night,
        0,
        255
    ).astype(np.uint8)


    return night


# =========================================================
# DETECTION
# =========================================================

def detect_humans(
    frame,
    model,
    label_name
):

    people_count = 0

    detections = []


    results = model(
        frame,
        verbose=False,
        classes=[0],
        conf=CONFIDENCE
    )


    for result in results:

        if result.boxes is None:

            continue


        for box in result.boxes:

            confidence = float(
                box.conf[0]
            )


            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0].tolist()
            )


            people_count += 1


            detections.append({

                "class":
                    label_name,

                "confidence":
                    confidence,

                "bbox": [
                    x1,
                    y1,
                    x2,
                    y2
                ]
            })


            # -----------------------------------------
            # Bounding box
            # -----------------------------------------

            cv2.rectangle(

                frame,

                (x1, y1),

                (x2, y2),

                (0, 255, 0),

                2
            )


            # -----------------------------------------
            # Label
            # -----------------------------------------

            label = (
                f"{label_name} "
                f"{confidence * 100:.1f}%"
            )


            # Black background behind text

            (tw, th), _ = cv2.getTextSize(

                label,

                cv2.FONT_HERSHEY_SIMPLEX,

                0.6,

                2
            )


            cv2.rectangle(

                frame,

                (
                    x1,
                    max(y1 - th - 12, 0)
                ),

                (
                    x1 + tw + 8,
                    y1
                ),

                (0, 0, 0),

                -1
            )


            cv2.putText(

                frame,

                label,

                (
                    x1 + 4,
                    max(y1 - 6, 15)
                ),

                cv2.FONT_HERSHEY_SIMPLEX,

                0.6,

                (0, 255, 0),

                2
            )


    # =====================================================
    # Detection counter
    # =====================================================

    cv2.putText(

        frame,

        f"HUMANS: {people_count}",

        (15, 32),

        cv2.FONT_HERSHEY_SIMPLEX,

        0.8,

        (0, 255, 0),

        2
    )


    return (
        frame,
        people_count,
        detections
    )


# =========================================================
# MAIN LOOP
# =========================================================

print("\n========================================")
print("🎥 LIVE AI PROCESSING")
print("========================================")

print()
print("LEFT  : Normal RGB + person model")
print("RIGHT : Green night vision + human model")
print()
print("Press Q to quit")
print("========================================")


previous_time = time.time()


while True:

    # =====================================================
    # CAPTURE FRAME
    # =====================================================

    success, frame = cap.read()


    if not success:

        print(
            "\n❌ Failed to read camera"
        )

        break


    # =====================================================
    # NORMAL PROCESSING
    # =====================================================

    normal_frame = frame.copy()


    (
        normal_frame,
        normal_count,
        normal_detections
    ) = detect_humans(

        normal_frame,

        normal_model,

        "PERSON"
    )


    # =====================================================
    # NIGHT VISION PROCESSING
    # =====================================================

    night_frame = create_night_vision(
        frame
    )


    (
        night_frame,
        night_count,
        night_detections
    ) = detect_humans(

        night_frame,

        night_model,

        "HUMAN"
    )


    # =====================================================
    # FPS
    # =====================================================

    current_time = time.time()


    fps = 1.0 / max(
        current_time - previous_time,
        0.001
    )


    previous_time = current_time


    # =====================================================
    # NIGHT VISION HEADER
    # =====================================================

    cv2.putText(

        night_frame,

        "NIGHT VISION",

        (15, 85),

        cv2.FONT_HERSHEY_SIMPLEX,

        0.7,

        (0, 255, 0),

        2
    )


    # =====================================================
    # NORMAL HEADER
    # =====================================================

    cv2.putText(

        normal_frame,

        "NORMAL CAMERA",

        (15, 85),

        cv2.FONT_HERSHEY_SIMPLEX,

        0.7,

        (255, 255, 255),

        2
    )


    # =====================================================
    # FPS
    # =====================================================

    cv2.putText(

        normal_frame,

        f"FPS: {fps:.1f}",

        (15, 115),

        cv2.FONT_HERSHEY_SIMPLEX,

        0.65,

        (255, 255, 255),

        2
    )


    cv2.putText(

        night_frame,

        f"FPS: {fps:.1f}",

        (15, 115),

        cv2.FONT_HERSHEY_SIMPLEX,

        0.65,

        (0, 255, 0),

        2
    )


    # =====================================================
    # DISPLAY
    # =====================================================

    cv2.imshow(

        "AERIS - Normal Person Detection",

        normal_frame
    )


    cv2.imshow(

        "AERIS - Night Vision Human Detection",

        night_frame
    )


    # =====================================================
    # TERMINAL
    # =====================================================

    print(

        f"\r"
        f"Normal Humans: {normal_count} | "
        f"Night Humans: {night_count} | "
        f"FPS: {fps:.1f}",

        end="",

        flush=True
    )


    # =====================================================
    # EXIT
    # =====================================================

    key = cv2.waitKey(1) & 0xFF


    if key == ord("q"):

        print(
            "\n\n🛑 Stopping..."
        )

        break


# =========================================================
# CLEANUP
# =========================================================

cap.release()

cv2.destroyAllWindows()


print(
    "✅ Camera stopped"
)

print(
    "========================================"
)