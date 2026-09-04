import os
import cv2
from ultralytics import YOLO

def main():
    # Load your trained weights from train-3
    model_path = "runs/detect/train-3/weights/best.pt"
    
    if not os.path.exists(model_path):
        print(f"Error: Could not find weights at {model_path}")
        return

    model = YOLO(model_path)
    print("YOLOv11 Thermal Human Detector Loaded Successfully.")

    while True:
        # Prompt user for input image path
        user_input = input("\nEnter thermal image path (or 'q' to quit): ").strip('"\' ')

        if user_input.lower() == 'q':
            print("Exiting inference script.")
            break

        if not os.path.exists(user_input):
            print(f"Error: File '{user_input}' does not exist. Please check the path.")
            continue

        # Run inference in memory
        results = model.predict(source=user_input, conf=0.35, save=False)
        result = results[0]
        boxes = result.boxes

        # Print detection metrics in the terminal
        print("-" * 50)
        print(f"Image Path: {user_input}")
        print(f"Total Humans Detected: {len(boxes)}")
        print("-" * 50)

        for idx, box in enumerate(boxes):
            confidence = float(box.conf[0])
            coords = [round(val, 1) for val in box.xyxy[0].tolist()]  # [x1, y1, x2, y2]
            print(f" Human #{idx + 1}: Confidence = {confidence:.2%}, Box = {coords}")

        # Render bounding boxes onto the image frame
        annotated_image = result.plot()

        # Display the visual result in a window
        cv2.imshow("Thermal Human Detection Result", annotated_image)
        
        print("\n--> Press ANY KEY on the image window to close it and continue...")
        cv2.waitKey(0)
        cv2.destroyAllWindows()

if __name__ == '__main__':
    main()