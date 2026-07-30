"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Compass } from "lucide-react";

interface ARNavigationProps {
  vehicleHeading: number | null;
  destinationLat: number;
  destinationLng: number;
  vehicleLat: number;
  vehicleLng: number;
  destinationLabel?: string;
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function ARNavigation({ vehicleHeading, destinationLat, destinationLng, vehicleLat, vehicleLng, destinationLabel }: ARNavigationProps) {
  const [active, setActive] = useState(false);
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [permission, setPermission] = useState<"prompt" | "granted" | "denied">("prompt");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const targetBearing = bearing(vehicleLat, vehicleLng, destinationLat, destinationLng);
  const effectiveHeading = vehicleHeading ?? deviceHeading;
  const relativeAngle = ((targetBearing - effectiveHeading) + 540) % 360 - 180;

  useEffect(() => {
    if (!active) {
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setPermission("granted");
      })
      .catch(() => setPermission("denied"));

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha != null) setDeviceHeading(e.alpha);
    };
    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    };
  }, [active]);

  const drawCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = c.offsetWidth;
    c.height = c.offsetHeight;
    const cx = c.width / 2;
    const cy = c.height / 2;

    ctx.clearRect(0, 0, c.width, c.height);

    if (Math.abs(relativeAngle) > 10) {
      const dir = relativeAngle > 0 ? "RIGHT" : "LEFT";
      ctx.fillStyle = "rgba(59, 130, 246, 0.85)";
      ctx.beginPath();
      ctx.arc(cx, cy, 40, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(dir === "RIGHT" ? "→" : "←", cx, cy);

      const angleRad = (relativeAngle * Math.PI) / 180;
      const indicatorX = cx + Math.sin(angleRad) * 70;
      ctx.fillStyle = "rgba(59, 130, 246, 0.6)";
      ctx.beginPath();
      ctx.arc(indicatorX, cy, 12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(34, 197, 94, 0.85)";
      ctx.beginPath();
      ctx.arc(cx, cy, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("↑", cx, cy);

      ctx.fillStyle = "rgba(34, 197, 94, 0.7)";
      ctx.font = "12px sans-serif";
      ctx.fillText("ON COURSE", cx, cy + 55);
    }

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.round(Math.abs(relativeAngle))}° ${relativeAngle > 0 ? "right" : "left"}`, cx, cy - 55);

    requestAnimationFrame(drawCanvas);
  }, [relativeAngle]);

  useEffect(() => {
    if (active) { const raf = requestAnimationFrame(drawCanvas); return () => cancelAnimationFrame(raf); }
  }, [active, drawCanvas]);

  return (
    <div className="relative overflow-hidden rounded-lg">
      {!active ? (
        <button
          onClick={() => setActive(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground"
        >
          <Compass className="h-4 w-4" /> AR Navigation
        </button>
      ) : (
        <div className="relative h-48 w-full overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            <span className="rounded bg-black/50 px-2 py-0.5 text-[10px] text-white">{destinationLabel || "Destination"}</span>
            <button onClick={() => setActive(false)} className="rounded-full bg-black/50 p-1">
              <Minimize2 className="h-4 w-4 text-white" />
            </button>
          </div>

          {permission === "denied" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <p className="px-4 text-center text-xs text-white">Camera permission denied. AR navigation needs camera access.</p>
            </div>
          )}

          {typeof DeviceOrientationEvent !== "undefined" && typeof (DeviceOrientationEvent as any).requestPermission === "function" && permission === "prompt" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <button
                onClick={async () => {
                  const perm = await (DeviceOrientationEvent as any).requestPermission();
                  if (perm === "granted") setPermission("granted");
                }}
                className="rounded-lg bg-primary px-4 py-2 text-xs text-white"
              >
                Enable AR Navigation
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
