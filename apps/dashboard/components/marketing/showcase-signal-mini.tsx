"use client";

import { useEffect, useRef } from "react";

/** Compact Three.js packet field for showcase panes. */
export function ShowcaseSignalMini() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let raf = 0;
    let renderer: import("three").WebGLRenderer | undefined;
    let geo: import("three").BufferGeometry | undefined;
    let lineGeo: import("three").BufferGeometry | undefined;
    let pointsMat: import("three").PointsMaterial | undefined;
    let lineMat: import("three").LineBasicMaterial | undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    async function setup() {
      const THREE = await import("three");
      if (disposed || !canvas) return;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 40);
      camera.position.z = 6;
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const count = 22;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        pos[i * 3] = Math.cos(a) * 1.8;
        pos[i * 3 + 1] = Math.sin(a * 1.4) * 1.1;
        pos[i * 3 + 2] = Math.sin(a) * 0.8;
      }
      geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      pointsMat = new THREE.PointsMaterial({ color: 0xff8a47, size: 0.08, transparent: true, opacity: 0.9 });

      const lines = new Float32Array(count * 6);
      for (let i = 0; i < count; i++) {
        const n = (i + 1) % count;
        lines.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], pos[n * 3], pos[n * 3 + 1], pos[n * 3 + 2]], i * 6);
      }
      lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.BufferAttribute(lines, 3));
      lineMat = new THREE.LineBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.35 });

      const group = new THREE.Group();
      group.add(new THREE.LineSegments(lineGeo, lineMat));
      group.add(new THREE.Points(geo, pointsMat));
      scene.add(group);

      function resize() {
        if (!renderer || !canvas) return;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (w < 1 || h < 1) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
      resize();
      const io = new IntersectionObserver(([e]) => {
        visible = Boolean(e?.isIntersecting);
      });
      io.observe(canvas);
      let visible = true;
      const clock = new THREE.Clock();
      function frame() {
        if (disposed || !renderer) return;
        if (visible && !reduced) {
          group.rotation.y += clock.getDelta() * 0.35;
          renderer.render(scene, camera);
        }
        if (!reduced) raf = requestAnimationFrame(frame);
      }
      renderer.render(scene, camera);
      if (!reduced) raf = requestAnimationFrame(frame);
      window.addEventListener("resize", resize);
      return () => {
        window.removeEventListener("resize", resize);
        io.disconnect();
      };
    }

    const extra = setup();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      void extra.then((fn) => fn?.());
      geo?.dispose();
      lineGeo?.dispose();
      pointsMat?.dispose();
      lineMat?.dispose();
      renderer?.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full opacity-40" aria-hidden />;
}
