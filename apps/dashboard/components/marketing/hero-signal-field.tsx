"use client";

import { useEffect, useRef } from "react";

interface NodePos {
  x: number;
  y: number;
  z: number;
}

/**
 * Full-viewport realtime constellation: nodes, edges, and packets hopping branches.
 * Zoom is CSS scroll-timeline on the canvas (transform only). rAF pauses off-tab.
 */
export function HeroSignalField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      scene.fog = new THREE.FogExp2(0x0b0b0c, 0.045);

      const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 120);
      camera.position.set(0, 0, 11);

      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setClearColor(0x0b0b0c, 0.55);
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
        color: 0xf7f4ee,
        size: 0.12,
        transparent: true,
        opacity: 0.92,
        sizeAttenuation: true,
      });

      lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
      lineMat = new THREE.LineBasicMaterial({
        color: 0xe8e4dc,
        transparent: true,
        opacity: 0.22,
      });

      const packetCount = reduced ? 0 : 28;
      const packetPos = new Float32Array(Math.max(packetCount, 1) * 3);
      packetGeo = new THREE.BufferGeometry();
      packetGeo.setAttribute("position", new THREE.BufferAttribute(packetPos, 3));
      packetMat = new THREE.PointsMaterial({
        color: 0xffffff,
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
      const packetPoints = new THREE.Points(packetGeo, packetMat);
      group.add(packetPoints);
      scene.add(group);

      function resize() {
        if (!renderer) return;
        const width = window.innerWidth;
        const height = window.innerHeight;
        if (width < 1 || height < 1) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      }

      resize();
      window.addEventListener("resize", resize);

      const clock = new THREE.Clock();
      let pageVisible = document.visibilityState === "visible";
      function onVis() {
        pageVisible = document.visibilityState === "visible";
      }
      document.addEventListener("visibilitychange", onVis);

      function frame() {
        if (disposed || !renderer || !group) return;
        const delta = clock.getDelta();
        if (pageVisible && !reduced) {
          group.rotation.y += delta * 0.045;
          group.rotation.x = Math.sin(clock.elapsedTime * 0.12) * 0.06;
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
        if (!reduced) raf = requestAnimationFrame(frame);
      }

      renderer.render(scene, camera);
      if (!reduced) raf = requestAnimationFrame(frame);

      return () => {
        window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", onVis);
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
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="mkt-signal-zoom pointer-events-none fixed left-0 top-0 z-0 block h-dvh w-screen max-w-none"
      aria-hidden
    />
  );
}
