"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { SensorReading } from "@/lib/api";

interface MissionMapProps {
  sensors: SensorReading | null;
  isOnline: boolean;
  onDropPayload?: () => Promise<any>;
  lastDropTrigger?: number;
}

interface Point {
  x: number;
  y: number;
}

interface LidarPoint {
  x: number;
  y: number;
  intensity: number; // 0 to 1
  distRatio: number; // 0 (closest) to 1 (farthest)
  life: number;
  r: number;
  g: number;
  b: number;
}

export interface DroppedBeacon {
  id: number;
  x: number;
  y: number;
  sector: string;
  timestamp: string;
  pulseRadius: number;
}

interface FallingParcel {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  currentY: number;
  progress: number;
}

// LiDAR False-Color Heat-Map Palette (Spectral: Red -> Orange -> Yellow -> Green -> Cyan -> Blue)
function getLidarHeatColor(ratio: number): { r: number; g: number; b: number; hex: string } {
  // ratio: 0.0 (near/obstacle) -> 1.0 (far/open)
  if (ratio < 0.18) {
    return { r: 255, g: 30, b: 0, hex: "#ff1e00" }; // Deep Red / Obstacle
  } else if (ratio < 0.35) {
    return { r: 255, g: 120, b: 0, hex: "#ff7800" }; // Bright Orange
  } else if (ratio < 0.52) {
    return { r: 255, g: 230, b: 0, hex: "#ffe600" }; // Yellow
  } else if (ratio < 0.70) {
    return { r: 50, g: 255, b: 80, hex: "#32ff50" }; // Neon Green
  } else if (ratio < 0.88) {
    return { r: 0, g: 230, b: 255, hex: "#00e6ff" }; // Cyan
  } else {
    return { r: 0, g: 90, b: 255, hex: "#005aff" }; // Deep Blue
  }
}

export default function MissionMap({
  sensors,
  isOnline,
  onDropPayload,
  lastDropTrigger,
}: MissionMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dronePosRef = useRef<Point>({ x: 40, y: 170 });
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [pointCount, setPointCount] = useState<number>(0);
  const [beacons, setBeacons] = useState<DroppedBeacon[]>([]);
  const [isDropping, setIsDropping] = useState<boolean>(false);
  const [activeSector, setActiveSector] = useState<string>("PORTAL ALPHA ENTRY");
  const [colorMode, setColorMode] = useState<"HEATMAP" | "CYBER">("HEATMAP");

  const beaconsRef = useRef<DroppedBeacon[]>([]);
  beaconsRef.current = beacons;

  const fallingParcelsRef = useRef<FallingParcel[]>([]);
  const lastProcessedDropRef = useRef<number>(0);

  // Trigger Relay Drop at current drone position (safe against re-trigger loop)
  const triggerRelayDrop = useCallback(
    async (isDirectUserClick = false) => {
      if (isDropping) return;
      setIsDropping(true);

      const pos = { ...dronePosRef.current };
      const currentPct = Math.round(
        (dronePosRef.current.x / 580) * 100
      );

      let sectorName = "SECTOR 01 (MAIN ACCESS TUNNEL)";
      if (pos.x > 450) sectorName = "SECTOR 04 (SURVIVOR CAVERN)";
      else if (pos.x > 320) sectorName = "SECTOR 03 (EAST EXTRACTION SHAFT)";
      else if (pos.x > 180) sectorName = "SECTOR 02 (CENTRAL CROSSCUT)";

      // Add falling animation parcel
      fallingParcelsRef.current.push({
        startX: pos.x,
        startY: pos.y,
        targetX: pos.x,
        targetY: Math.min(pos.y + 20, 290),
        currentY: pos.y,
        progress: 0,
      });

      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0];

      const newBeacon: DroppedBeacon = {
        id: beaconsRef.current.length + 1,
        x: pos.x,
        y: Math.min(pos.y + 20, 290),
        sector: sectorName,
        timestamp: timeStr,
        pulseRadius: 0,
      };

      // Add to beacons list after drop animation
      setTimeout(() => {
        setBeacons((prev) => [...prev, newBeacon]);
      }, 350);

      // Only call hardware trigger if clicked directly from this map button
      if (isDirectUserClick && onDropPayload) {
        try {
          await onDropPayload();
        } catch {
          // feedback handled by parent
        }
      }

      setTimeout(() => {
        setIsDropping(false);
      }, 1000);
    },
    [isDropping, onDropPayload]
  );

  // Sync external drop trigger without continuous loop
  useEffect(() => {
    if (
      lastDropTrigger &&
      lastDropTrigger > 0 &&
      lastDropTrigger !== lastProcessedDropRef.current
    ) {
      lastProcessedDropRef.current = lastDropTrigger;
      triggerRelayDrop(false);
    }
  }, [lastDropTrigger, triggerRelayDrop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    // Load FloorPlan2 map image for offscreen raycast pixel sampling
    const mapImage = new Image();
    mapImage.src = "/FloorPlan2.png";
    let mapLoaded = false;

    // Offscreen canvas for fast pixel collision detection against FloorPlan2
    const offCanvas = document.createElement("canvas");
    const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });

    mapImage.onload = () => {
      mapLoaded = true;
      offCanvas.width = canvas.width;
      offCanvas.height = canvas.height;
      if (offCtx) {
        offCtx.drawImage(mapImage, 0, 0, offCanvas.width, offCanvas.height);
      }
    };

    // Scaled exploration path covering FloorPlan2 mine corridors
    // Dimensions relative to 580 x 300
    const waypoints: Point[] = [
      { x: 30, y: 135 },   // 1. Entry Portal (Left)
      { x: 130, y: 135 },  // 2. Main horizontal crosscut
      { x: 130, y: 75 },   // 3. North upper drift
      { x: 285, y: 75 },   // 4. North drift center
      { x: 285, y: 145 },  // 5. Center bypass
      { x: 410, y: 145 },  // 6. East central shaft
      { x: 410, y: 220 },  // 7. South extraction level
      { x: 490, y: 220 },  // 8. South-east drift
      { x: 490, y: 135 },  // 9. Approach to survivor chamber
      { x: 535, y: 135 },  // 10. Survivor Sector 04 Target (Right)
    ];

    let currentWaypointIdx = 0;
    let t = 0;
    let lidarAngle = 0;
    let accumulatedPoints: LidarPoint[] = [];
    let exploredPath: Point[] = [{ ...waypoints[0] }];

    // Raycast sampling function against FloorPlan2 map
    const raycast = (
      origin: Point,
      angle: number,
      maxDist: number = 85
    ): { hit: Point; dist: number; distRatio: number; hitFound: boolean } => {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const step = 2.5;
      let dist = 0;
      let hitX = origin.x + dx * maxDist;
      let hitY = origin.y + dy * maxDist;
      let hitFound = false;

      if (offCtx && mapLoaded) {
        const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
        const data = imgData.data;
        const w = offCanvas.width;
        const h = offCanvas.height;

        while (dist < maxDist) {
          dist += step;
          const sampleX = Math.round(origin.x + dx * dist);
          const sampleY = Math.round(origin.y + dy * dist);

          if (sampleX < 0 || sampleX >= w || sampleY < 0 || sampleY >= h) {
            hitX = sampleX;
            hitY = sampleY;
            hitFound = true;
            break;
          }

          const idx = (sampleY * w + sampleX) * 4;
          // In FloorPlan2, black pixels (r < 40, g < 40, b < 40) are solid rock walls
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          if (r < 45 && g < 45 && b < 45) {
            hitX = sampleX;
            hitY = sampleY;
            hitFound = true;
            break;
          }
        }
      } else {
        // Fallback boundary box if image loading
        dist = maxDist;
      }

      const distRatio = Math.min(1.0, Math.max(0.05, dist / maxDist));
      return {
        hit: { x: hitX, y: hitY },
        dist,
        distRatio,
        hitFound,
      };
    };

    const render = () => {
      // 1. Progress drone along waypoints
      if (isPlaying) {
        const step = 0.005 * speed;
        t += step;
        if (t >= 1) {
          t = 0;
          currentWaypointIdx++;
          if (currentWaypointIdx >= waypoints.length - 1) {
            currentWaypointIdx = 0;
            exploredPath = [{ ...waypoints[0] }];
            accumulatedPoints = [];
          }
        }
      }

      const pStart = waypoints[currentWaypointIdx];
      const pEnd =
        waypoints[Math.min(currentWaypointIdx + 1, waypoints.length - 1)];
      const dronePos: Point = {
        x: pStart.x + (pEnd.x - pStart.x) * t,
        y: pStart.y + (pEnd.y - pStart.y) * t,
      };
      dronePosRef.current = dronePos;

      // Add to growing explored path
      if (
        exploredPath.length === 0 ||
        Math.hypot(
          dronePos.x - exploredPath[exploredPath.length - 1].x,
          dronePos.y - exploredPath[exploredPath.length - 1].y
        ) > 2.5
      ) {
        exploredPath.push({ ...dronePos });
      }

      const totalDist = waypoints.length - 1;
      const currentDist = currentWaypointIdx + t;
      const pct = Math.round((currentDist / totalDist) * 100);
      setProgressPct(pct);

      if (pct > 80) setActiveSector("SURVIVOR SECTOR 04");
      else if (pct > 55) setActiveSector("EAST EXTRACTION SHAFT");
      else if (pct > 25) setActiveSector("CENTRAL CROSSCUT");
      else setActiveSector("PORTAL ALPHA ENTRY");

      // 2. Multi-ray 360° LiDAR Raycaster (48 high-density rays)
      lidarAngle += 0.08 * speed;
      const numRays = 48;
      for (let i = 0; i < numRays; i++) {
        const rayAngle = lidarAngle + (i / numRays) * Math.PI * 2;
        const result = raycast(dronePos, rayAngle, 90);

        if (result.hitFound) {
          const jitterX = (Math.random() - 0.5) * 2;
          const jitterY = (Math.random() - 0.5) * 2;
          const color = getLidarHeatColor(result.distRatio);

          accumulatedPoints.push({
            x: result.hit.x + jitterX,
            y: result.hit.y + jitterY,
            intensity: 1.0 - result.distRatio,
            distRatio: result.distRatio,
            life: 1.0,
            r: color.r,
            g: color.g,
            b: color.b,
          });
        }
      }

      // Point cloud size management
      if (accumulatedPoints.length > 2400) {
        accumulatedPoints.splice(0, accumulatedPoints.length - 2400);
      }
      setPointCount(accumulatedPoints.length);

      // CLEAR CANVAS
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#040608";
      ctx.fillRect(0, 0, w, h);

      // Draw FloorPlan2 background as a subtle dark rock blueprint
      if (mapLoaded) {
        ctx.globalAlpha = 0.22;
        ctx.drawImage(mapImage, 0, 0, w, h);
        ctx.globalAlpha = 1.0;
      }

      // Subtle Cyber Grid Lines
      ctx.strokeStyle = "rgba(20, 35, 45, 0.4)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // Range rings around drone
      ctx.strokeStyle = "rgba(40, 75, 65, 0.3)";
      ctx.lineWidth = 1;
      [30, 60, 90].forEach((r) => {
        ctx.beginPath();
        ctx.arc(dronePos.x, dronePos.y, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // 3. Growing Trajectory Trail
      if (exploredPath.length > 1) {
        ctx.strokeStyle = "rgba(217, 255, 74, 0.85)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(exploredPath[0].x, exploredPath[0].y);
        for (let i = 1; i < exploredPath.length; i++) {
          ctx.lineTo(exploredPath[i].x, exploredPath[i].y);
        }
        ctx.stroke();

        exploredPath.forEach((pt, idx) => {
          if (idx % 8 === 0) {
            ctx.fillStyle = "#d9ff4a";
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // Planned Future Route (dashed cyan)
      ctx.strokeStyle = "rgba(74, 229, 255, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(dronePos.x, dronePos.y);
      for (let i = currentWaypointIdx + 1; i < waypoints.length; i++) {
        ctx.lineTo(waypoints[i].x, waypoints[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 4. Dynamic 360° LiDAR Raycast Beams (False-color colored by distance)
      for (let i = 0; i < numRays; i++) {
        const rayAngle = lidarAngle + (i / numRays) * Math.PI * 2;
        const result = raycast(dronePos, rayAngle, 90);
        const color = getLidarHeatColor(result.distRatio);

        ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.22)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dronePos.x, dronePos.y);
        ctx.lineTo(result.hit.x, result.hit.y);
        ctx.stroke();
      }

      // 5. Real LiDAR False-Color Heat-Map Point Cloud
      accumulatedPoints.forEach((pt) => {
        if (colorMode === "HEATMAP") {
          ctx.fillStyle = `rgb(${pt.r}, ${pt.g}, ${pt.b})`;
        } else {
          ctx.fillStyle = pt.intensity > 0.6 ? "#4ae5ff" : "#d9ff4a";
        }
        ctx.fillRect(pt.x - 1, pt.y - 1, 2.2, 2.2);
      });

      // 6. Render Dropped Relay Beacon Markers & Radar Waves
      const currentBeacons = beaconsRef.current;
      currentBeacons.forEach((b) => {
        b.pulseRadius = (b.pulseRadius + 0.35) % 25;

        // Glowing Pulsing Radar Waves
        ctx.strokeStyle = `rgba(255, 90, 30, ${Math.max(0, 1 - b.pulseRadius / 25)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.pulseRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Beacon Core Marker Pin
        ctx.fillStyle = "#ff4a20";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4.5, 0, Math.PI * 2);
        ctx.stroke();

        // Label
        ctx.fillStyle = "#ff7800";
        ctx.font = "bold 8px Inter, sans-serif";
        ctx.fillText(`📦 BEACON #${b.id}`, b.x - 22, b.y - 8);
      });

      // 7. Render Falling Parachute / Payload Animations
      const activeParcels = fallingParcelsRef.current;
      for (let i = activeParcels.length - 1; i >= 0; i--) {
        const p = activeParcels[i];
        p.progress += 0.05;
        p.currentY =
          p.startY + (p.targetY - p.startY) * Math.min(p.progress, 1);

        // Supply Crate
        ctx.fillStyle = "#d9ff4a";
        ctx.fillRect(p.startX - 3, p.currentY - 3, 6, 6);

        // Parachute Canopy
        ctx.strokeStyle = "rgba(74, 229, 255, 0.9)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.startX, p.currentY - 7, 7, Math.PI, 0);
        ctx.stroke();

        if (p.progress >= 1) {
          activeParcels.splice(i, 1);
        }
      }

      // Start & Target Marker Labels
      ctx.fillStyle = "#d9ff4a";
      ctx.font = "9px Inter, sans-serif";
      ctx.fillText("ENTRY PORTAL", 15, 160);
      ctx.beginPath();
      ctx.arc(waypoints[0].x, waypoints[0].y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#d9ff4a";
      ctx.fill();

      const lastWp = waypoints[waypoints.length - 1];
      ctx.fillStyle = "#ff4a4a";
      ctx.fillText("SURVIVOR SECTOR 04", 430, 160);
      ctx.beginPath();
      ctx.arc(lastWp.x, lastWp.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // 8. ACTIVE DRONE (Small Animated Quadcopter Sprite)
      ctx.save();
      ctx.translate(dronePos.x, dronePos.y);
      const headingAngle = Math.atan2(pEnd.y - pStart.y, pEnd.x - pStart.x);
      ctx.rotate(headingAngle);

      // Searchlight / Forward Scanner Beam Cone
      const beamGrad = ctx.createRadialGradient(0, 0, 4, 32, 0, 38);
      beamGrad.addColorStop(0, "rgba(74, 229, 255, 0.55)");
      beamGrad.addColorStop(1, "rgba(74, 229, 255, 0)");
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(4, -3);
      ctx.lineTo(38, -14);
      ctx.lineTo(38, 14);
      ctx.lineTo(4, 3);
      ctx.closePath();
      ctx.fill();

      // Drone Body Glow
      const droneGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
      droneGlow.addColorStop(0, "rgba(217, 255, 74, 0.9)");
      droneGlow.addColorStop(1, "rgba(217, 255, 74, 0)");
      ctx.fillStyle = droneGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();

      // 4 Carbon-Fiber Diagonal Arms
      ctx.strokeStyle = "#8594a6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(8, 8);
      ctx.moveTo(-8, 8);
      ctx.lineTo(8, -8);
      ctx.stroke();

      // 4 Motors with Spinning Rotor Discs
      const rotorPositions = [
        { x: -8, y: -8, ccw: true },
        { x: 8, y: -8, ccw: false },
        { x: -8, y: 8, ccw: false },
        { x: 8, y: 8, ccw: true },
      ];

      const rotorSpin = Date.now() * 0.05;

      rotorPositions.forEach((rp, rIdx) => {
        ctx.fillStyle = "#1c2633";
        ctx.strokeStyle = "#4ae5ff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(rp.x, rp.y);
        ctx.rotate(rp.ccw ? rotorSpin : -rotorSpin);
        ctx.strokeStyle =
          rIdx < 2
            ? "rgba(217, 255, 74, 0.95)"
            : "rgba(74, 229, 255, 0.9)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 5.5, 1.8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });

      // Central Avionics Fuselage Pod
      ctx.fillStyle = "#0c131a";
      ctx.strokeStyle = "#d9ff4a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-5, -4, 10, 8, 3);
      ctx.fill();
      ctx.stroke();

      // Center LiDAR Sensor Core (flashing dot)
      ctx.fillStyle = "#4ae5ff";
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();

      // Forward Nose LED
      ctx.fillStyle = "#d9ff4a";
      ctx.beginPath();
      ctx.arc(5, 0, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, speed, colorMode]);

  return (
    <div className="card map-card">
      <div className="card-header">
        <div>
          <span className="label">3D SLAM & REAL LIDAR HEATMAP ENVIRONMENT</span>
          <h2>Mine Sector LiDAR SLAM Mapping</h2>
        </div>

        <div className="map-controls">
          <button
            type="button"
            className="tab-btn"
            style={{
              background: isDropping ? "#ff7b4a" : "#2a1810",
              color: isDropping ? "#000" : "#ff9d6b",
              border: "1px solid #ff7b4a",
              fontWeight: "700",
            }}
            onClick={() => triggerRelayDrop(true)}
            disabled={isDropping}
          >
            {isDropping ? "⚡ DROPPING RELAY..." : "⚡ DROP RELAY"}
          </button>
          <button
            type="button"
            className={`tab-btn ${colorMode === "HEATMAP" ? "active" : ""}`}
            onClick={() =>
              setColorMode((m) => (m === "HEATMAP" ? "CYBER" : "HEATMAP"))
            }
          >
            {colorMode === "HEATMAP" ? "🌈 HEATMAP" : "⚡ CYBER"}
          </button>
          <button
            type="button"
            className={`tab-btn ${isPlaying ? "active" : ""}`}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? "PAUSE" : "RESUME"}
          </button>
          <button
            type="button"
            className="tab-btn"
            onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
          >
            {speed}x
          </button>
          <span className="good-badge">SLAM ({progressPct}%)</span>
        </div>
      </div>

      <div
        className="map lidar-map-container"
        style={{ position: "relative", height: "300px" }}
      >
        <canvas
          ref={canvasRef}
          width={580}
          height={300}
          style={{ width: "100%", height: "100%", display: "block" }}
        />

        {/* HUD Scan Overlay */}
        <div className="lidar-hud-left">
          <span>
            PTS: <strong>{pointCount}</strong>
          </span>
          <span>
            FOV: <strong>360° (48 RAYS)</strong>
          </span>
          <span>
            PALETTE: <strong style={{ color: "#ff7b4a" }}>SPECTRAL HEATMAP</strong>
          </span>
          <span>
            BEACONS:{" "}
            <strong style={{ color: "#ff7b4a" }}>
              {beacons.length} DEPLOYED
            </strong>
          </span>
        </div>

        {/* Spectral Depth Legend */}
        <div
          style={{
            position: "absolute",
            bottom: "10px",
            left: "12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "9px",
            color: "#8594a6",
            background: "rgba(8, 12, 17, 0.75)",
            padding: "4px 8px",
            borderRadius: "4px",
            border: "1px solid rgba(35, 45, 55, 0.6)",
          }}
        >
          <span>NEAR</span>
          <div
            style={{
              width: "50px",
              height: "6px",
              borderRadius: "3px",
              background:
                "linear-gradient(to right, #ff1e00, #ff7800, #ffe600, #32ff50, #00e6ff, #005aff)",
            }}
          />
          <span>FAR</span>
        </div>

        <div className="coordinates">
          <span>
            ZONE: <strong>{activeSector}</strong> · TARGET:{" "}
            <strong>SECTOR 04</strong>
          </span>
        </div>
      </div>

      <div
        className="mission-area"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>ACTIVE EXPLORATION: FLOORPLAN 02 · SHAFT NETWORK</span>
        <div style={{ display: "flex", gap: "10px", fontSize: "10px" }}>
          {beacons.length > 0 ? (
            <span style={{ color: "#ff7b4a" }}>
              Latest Beacon #{beacons[beacons.length - 1].id} dropped at{" "}
              {beacons[beacons.length - 1].timestamp} (
              {beacons[beacons.length - 1].sector})
            </span>
          ) : (
            <span style={{ color: "#d9ff4a" }}>
              ID: {sensors?.device_id || "ESP32_MINE_01"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}