from ultralytics import YOLO

def run_evaluation_and_inference():
    # Load your trained weights from train-3
    model_path = "runs/detect/train-3/weights/best.pt"
    model = YOLO(model_path)
    
    print("=" * 50)
    print(" 1. EVALUATING ACCURACY & MODEL PARAMETERS")
    print("=" * 50)
    
    # Calculate performance metrics on validation/test set
    metrics = model.val(data="data.yaml", split="val")
    
    print("\n--- Model Accuracy Metrics ---")
    print(f"Precision (P):      {metrics.box.mp:.4f} (Correctness of human predictions)")
    print(f"Recall (R):         {metrics.box.mr:.4f} (Percentage of actual humans detected)")
    print(f"mAP@50:             {metrics.box.map50:.4f} (Accuracy at 50% overlap threshold)")
    print(f"mAP@50-95:          {metrics.box.map:.4f} (Strict overall mAP score)")
    
    print("\n--- Speed & Performance Parameters ---")
    print(f"Pre-process Speed:  {metrics.speed['preprocess']:.2f} ms / image")
    print(f"Inference Speed:    {metrics.speed['inference']:.2f} ms / image")
    print(f"Post-process Speed: {metrics.speed['postprocess']:.2f} ms / image")

    print("\n" + "=" * 50)
    print(" 2. RUNNING IN-MEMORY HUMAN DETECTION")
    print("=" * 50)
    
    # Run predictions in memory without saving images or labels to disk
    results = model.predict(
        source="thermal_dataset/dataset/test/images",
        conf=0.35,      # Confidence threshold
        save=False,     # Disable saving output images
        save_txt=False  # Disable saving text coordinate files
    )
    
    print("\n--- Detection Summary ---")
    for idx, result in enumerate(results[:10]):  # Summary for first 10 test images
        image_name = result.path.rsplit('\\', 1)[-1].rsplit('/', 1)[-1]
        human_count = len(result.boxes)
        print(f"Image [{idx + 1}]: {image_name} -> {human_count} human(s) detected")

if __name__ == '__main__':
    run_evaluation_and_inference()