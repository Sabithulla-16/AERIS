import cv2
import os
from ultralytics import YOLO

def main():
    # Load your fine-tuned thermal model weights
    model_path = "runs/detect/train-3/weights/best.pt"
    
    if not os.path.exists(model_path):
        print(f"Error: Could not find model weights at {model_path}")
        return

    model = YOLO(model_path)
    print("YOLOv11 + ByteTrack Tracker Loaded Successfully.")

    # Video source: Replace with your video file path (e.g., "thermal_video.mp4") 
    # or camera index (0 for standard USB/Thermal camera)
    video_source = "night vision 2.mp4" 

    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        print(f"Error: Could not open video source {video_source}")
        return

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            print("End of video stream or failed to read frame.")
            break

        # Run ByteTrack data association using the Hungarian algorithm
        results = model.track(
            source=frame,
            persist=True,               # Retains tracking IDs across sequential frames
            tracker="bytetrack.yaml",   # Invokes ByteTrack (Kalman Filter + Hungarian Matching)
            conf=0.35,                  # High-confidence detection threshold
            iou=0.5,                    # IoU threshold for Hungarian matching cost matrix
            verbose=False
        )

        result = results[0]
        
        # Display tracking IDs in the terminal
        if result.boxes is not None and result.boxes.id is not None:
            track_ids = result.boxes.id.int().cpu().tolist()
            print(f"Active Humans Tracked (IDs): {track_ids}")

        # Render bounding boxes and persistent tracking IDs on the frame
        annotated_frame = result.plot()

        # Display output window
        cv2.imshow("YOLOv11 + ByteTrack Thermal Human Tracking", annotated_frame)

        # Press 'q' to stop video tracking
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()