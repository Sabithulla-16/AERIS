# 🛰️ AERIS — Autonomous Exploration, Reconnaissance & Intelligence System

AERIS is an advanced, full-stack aerial reconnaissance and defense surveillance platform featuring real-time AI object detection, thermal/night vision analysis, live simulated LiDAR mapping, telemetry tracking, and hardware control integration.

---

## 🌟 Key Features

- **Real-Time Video Feeds & AI Inference:**
  - Standard RGB and Thermal/Night-Vision video pipeline powered by Ultralytics YOLO.
  - Custom trained lightweight YOLO model (model_training/weights/best.pt) optimized for low-light / thermal human & vehicle detection.
  - Fallback and daylight support with YOLO11 (yolo11n.pt).
- **SimuLIDAR:**
  - Real-time simulated 2D/3D point-cloud LiDAR generator with dynamic obstacle plotting and directional raycasting.
- **Drone Telemetry & Defense Dashboard:**
  - Tactical HUD with pitch/roll artificial horizon, altitude, speed, GPS coordinates, compass heading, signal status, and battery health.
- **Tactical Controls:**
  - Waypoint mission planner, hardware control triggers (ESP32-CAM / Drone motor commands), night-vision mode toggling, and snapshot capture.
- **Modern Tactical Interface:**
  - High-performance glassmorphism UI built with Next.js 14, TailwindCSS, Lucide icons, and Canvas/WebGL rendering.

---

## 📁 Repository Structure

`
AERIS/
├── backend/                 # FastAPI backend server
│   ├── main.py              # Video streaming, YOLO inference, and API endpoints
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Backend environment configuration template
├── frontend/                # Next.js 14 Web Application
│   ├── app/                 # Next.js App Router pages and layout
│   ├── components/          # Telemetry, HUD, Camera Feeds, LiDAR viewer
│   ├── package.json         # Node.js dependencies
│   └── .env.example         # Frontend environment template
├── SimuLIDAR/               # Dedicated LiDAR simulation module & point cloud generator
├── model_training/          # ML training pipelines and model artifacts
│   └── weights/
│       └── best.pt          # Pre-trained thermal/night vision YOLO detection model
└── videos/                  # Sample surveillance demo videos (night vision)
`

---

## 🚀 Quick Start (Clone & Run)

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** and **npm**
- (Optional) NVIDIA GPU with CUDA for faster YOLO inference.

---

### 2. Backend Setup

1. Open a terminal and navigate to ackend/:
   `ash
   cd backend
   `
2. Create and activate a virtual environment:
   `ash
   # Windows PowerShell
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   `
3. Install dependencies:
   `ash
   pip install -r requirements.txt
   `
4. (Optional) Configure environment variables:
   `ash
   cp .env.example .env
   `
   *Note: Default paths are already configured to resolve model_training/weights/best.pt and ideos/night vision 2.mp4 automatically.*
5. Start the backend server:
   `ash
   uvicorn main:app --reload --host 127.0.0.1 --port 8000
   `
   API Docs will be accessible at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

### 3. Frontend Setup

1. Open a second terminal and navigate to rontend/:
   `ash
   cd frontend
   `
2. Install dependencies:
   `ash
   npm install
   `
3. (Optional) Set up .env.local:
   `ash
   cp .env.example .env.local
   `
4. Start the development server:
   `ash
   npm run dev
   `
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### 4. SimuLIDAR (Optional Standalone)

To run or explore the standalone LiDAR simulation scripts:
`ash
cd SimuLIDAR
# Run any standalone LiDAR generators or point-cloud visualizers
`

---

## 🤖 Pre-Trained Models

- The custom fine-tuned thermal/night-vision detection model is included in the repository at:
  `
  model_training/weights/best.pt
  `
- Daylight detection models (yolo11n.pt) will download automatically from Ultralytics on first run.

---

## 🛡️ License & Contributing

Developed for advanced aerial defense and reconnaissance research. Pull requests and issues are welcome!
