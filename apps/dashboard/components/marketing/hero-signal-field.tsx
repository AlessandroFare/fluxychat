"use client";

import { useEffect, useRef } from "react";
import { landingPointer } from "../../app/landing/landing-pointer";
import { cn } from "@/lib/utils";

interface NodePos {
  x: number;
  y: number;
  z: number;
}

const DARK_BG = 0x0b0b0c;
const LIGHT_BG = 0xf3efe8;

interface HeroSignalFieldProps {
  /** Page backdrop is always the dark constellation. Hero layer is cream, clipped to the hero box. */
  placement?: "page" | "hero";
  className?: string;
}

/**
 * Realtime constellation. Two instances: a fixed dark field for the page, and an
 * absolutely-positioned light field inside the hero (light theme only).
 */
export function HeroSignalField({ placement = "page", className }: HeroSignalFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = placement === "page";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let raf = 0;
    let renderer: import("three").WebGLRenderer | undefined;
    let nodeGeo: import("three").BufferGeometry | undefined;
    let lineGeo: import("three").BufferGeometry | undefined;
    let packetGeo: import("three").BufferGeometry | undefined;
    let nodeMat: import("three").PointsMaterial | undefined;
    let lineMat: import("three").LineBasicMaterial | undefined;
    let packetMat: import("three").PointsMaterial | undefined;
    let group: import("three").Group | undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    async function setup() {
      const THREE = await import("three");
      if (disposed || !canvas) return;

      const scene = new THREE.Scene();
      const bg = isDark ? DARK_BG : LIGHT_BG;
      scene.fog = new THREE.FogExp2(bg, isDark ? 0.045 : 0.032);

      const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 120);
      camera.position.set(0, 0, 11);

      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      renderer.setClearColor(bg, 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const nodes: NodePos[] = [{ x: 0, y: 0, z: 0 }];
      const count = 72;
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const a = t * Math.PI * 2 * 3.7;
        const r = 4.2 + (i % 8) * 0.95;
        nodes.push({
          x: Math.cos(a) * r * 1.85 + Math.sin(i * 1.71) * 0.55,
          y: (t - 0.5) * 6.4 + Math.cos(i * 0.93) * 0.7,
          z: Math.sin(a) * r * 1.15 + Math.cos(i * 1.27) * 0.5,
        });
      }

      const nodePositions = new Float32Array(nodes.length * 3);
      nodes.forEach((n, i) => {
        nodePositions[i * 3] = n.x;
        nodePositions[i * 3 + 1] = n.y;
        nodePositions[i * 3 + 2] = n.z;
      });

      const edges: [number, number][] = [];
      for (let i = 0; i < nodes.length; i++) {
        const dist: { j: number; d: number }[] = [];
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dz = nodes[i].z - nodes[j].z;
          dist.push({ j, d: dx * dx + dy * dy + dz * dz });
        }
        dist.sort((a, b) => a.d - b.d);
        const links = i === 0 ? 6 : 2;
        for (let k = 0; k < links; k++) {
          const j = dist[k].j;
          if (i < j) edges.push([i, j]);
        }
      }

      const linePositions = new Float32Array(edges.length * 6);
      edges.forEach(([a, b], i) => {
        const o = i * 6;
        linePositions[o] = nodes[a].x;
        linePositions[o + 1] = nodes[a].y;
        linePositions[o + 2] = nodes[a].z;
        linePositions[o + 3] = nodes[b].x;
        linePositions[o + 4] = nodes[b].y;
        linePositions[o + 5] = nodes[b].z;
      });

      nodeGeo = new THREE.BufferGeometry();
      nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodePositions, 3));
      nodeMat = new THREE.PointsMaterial({
        color: isDark ? 0xf7f4ee : 0x3f3f46,
        size: 0.12,
        transparent: true,
        opacity: isDark ? 0.92 : 0.72,
        sizeAttenuation: true,
      });

      lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
      lineMat = new THREE.LineBasicMaterial({
        color: isDark ? 0xe8e4dc : 0x9a3412,
        transparent: true,
        opacity: isDark ? 0.22 : 0.18,
      });

      const packetCount = reduced ? 0 : 28;
      const packetPos = new Float32Array(Math.max(packetCount, 1) * 3);
      packetGeo = new THREE.BufferGeometry();
      packetGeo.setAttribute("position", new THREE.BufferAttribute(packetPos, 3));
      packetMat = new THREE.PointsMaterial({
        color: isDark ? 0xff6a1a : 0xc2410c,
        size: 0.1,
        transparent: true,
        opacity: 0.98,
        sizeAttenuation: true,
      });

      const packets = Array.from({ length: packetCount }, (_, i) => ({
        edge: i % edges.length,
        t: (i * 0.37) % 1,
        speed: 0.18 + (i % 5) * 0.05,
      }));

      group = new THREE.Group();
      group.add(new THREE.LineSegments(lineGeo, lineMat));
      group.add(new THREE.Points(nodeGeo, nodeMat));
      group.add(new THREE.Points(packetGeo, packetMat));
      scene.add(group);

      function resize() {
        if (!renderer || !canvas) return;
        const parent = canvas.parentElement;
        const width = placement === "hero" ? (parent?.clientWidth ?? canvas.clientWidth) : window.innerWidth;
        const height = placement === "hero" ? (parent?.clientHeight ?? canvas.clientHeight) : window.innerHeight;
        if (width < 1 || height < 1) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      }

      resize();
      window.addEventListener("resize", resize);

      const clock = new THREE.Clock();
      let pageVisible = document.visibilityState === "visible";
      let inView = true;
      let baseY = 0;
      let viewIo: IntersectionObserver | undefined;
      function kick() {
        if (disposed || reduced) return;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      }
      function onVis() {
        pageVisible = document.visibilityState === "visible";
        if (pageVisible && inView) kick();
      }
      document.addEventListener("visibilitychange", onVis);

      if (typeof IntersectionObserver !== "undefined") {
        viewIo = new IntersectionObserver(
          ([entry]) => {
            inView = entry.isIntersecting;
            if (inView && pageVisible) kick();
          },
          { threshold: 0.02 },
        );
        viewIo.observe(canvas);
      }

      function frame() {
        if (disposed || !renderer || !group) return;
        const delta = clock.getDelta();
        if (pageVisible && inView && !reduced) {
          baseY += delta * 0.045;
          const wantY = baseY + (landingPointer.nx - 0.5) * 0.52;
          const wantX =
            Math.sin(clock.elapsedTime * 0.12) * 0.045 + (landingPointer.ny - 0.5) * 0.28;
          const ease = 1 - Math.exp(-delta * 4.2);
          group.rotation.y += (wantY - group.rotation.y) * ease;
          group.rotation.x += (wantX - group.rotation.x) * ease;
          const attr = packetGeo!.getAttribute("position") as import("three").BufferAttribute;
          for (let i = 0; i < packets.length; i++) {
            const p = packets[i];
            p.t += p.speed * delta;
            if (p.t > 1) {
              p.t -= 1;
              p.edge = (p.edge + 7) % edges.length;
            }
            const [ai, bi] = edges[p.edge];
            const a = nodes[ai];
            const b = nodes[bi];
            attr.setXYZ(
              i,
              a.x + (b.x - a.x) * p.t,
              a.y + (b.y - a.y) * p.t,
              a.z + (b.z - a.z) * p.t,
            );
          }
          attr.needsUpdate = true;
          renderer.render(scene, camera);
        }
        if (pageVisible && inView && !reduced) raf = requestAnimationFrame(frame);
      }

      renderer.render(scene, camera);
      if (!reduced) raf = requestAnimationFrame(frame);

      return () => {
        window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", onVis);
        viewIo?.disconnect();
      };
    }

    const cleanupPromise = setup();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      void cleanupPromise.then((extra) => extra?.());
      nodeGeo?.dispose();
      lineGeo?.dispose();
      packetGeo?.dispose();
      nodeMat?.dispose();
      lineMat?.dispose();
      packetMat?.dispose();
      renderer?.dispose();
    };
  }, [isDark, placement]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "pointer-events-none block max-w-none",
        placement === "page"
          ? "mkt-signal-zoom fixed left-0 top-0 z-0 h-dvh w-screen"
          : "absolute inset-0 z-0 h-full w-full",
        className,
      )}
      aria-hidden
    />
  );
}
