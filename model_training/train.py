from ultralytics import YOLO

def main():
    # Load pre-trained YOLOv11 model
    model = YOLO("yolo11n.pt")

    # Fine-tune model on thermal dataset
    results = model.train(
        data="data.yaml",
        epochs=50,
        imgsz=640,
        batch=16,
        workers=4,  # Recommended setting for laptop GPUs to prevent memory overhead
        device=0
    )

if __name__ == '__main__':
    main()