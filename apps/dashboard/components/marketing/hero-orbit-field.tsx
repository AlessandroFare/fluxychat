"use client";

import { useEffect, useRef } from "react";

/**
 * Subtle orange wireframe field for the marketing hero.
 * Pauses off-screen, one static frame when reduced-motion, disposes GPU resources.
 */
export function HeroOrbitField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let raf = 0;
    let visible = true;
    let renderer: import("three").WebGLRenderer | undefined;
    let geometry: import("three").IcosahedronGeometry | undefined;
    let centerGeometry: import("three").IcosahedronGeometry | undefined;
    let material: import("three").MeshBasicMaterial | undefined;
    let centerMaterial: import("three").MeshBasicMaterial | undefined;
    let group: import("three").Group | undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    async function setup() {
      const THREE = await import("three");
      if (disposed || !canvas) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.z = 8;

      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      geometry = new THREE.IcosahedronGeometry(0.28, 0);
      material = new THREE.MeshBasicMaterial({
        color: 0xff6a1a,
        wireframe: true,
        transparent: true,
        opacity: 0.38,
      });
      group = new THREE.Group();
      scene.add(group);

      const count = 18;
      for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(geometry, material);
        const angle = (i / count) * Math.PI * 2;
        const radius = 2.4 + (i % 3) * 0.55;
        mesh.position.set(
          Math.cos(angle) * radius,
          Math.sin(angle * 1.7) * 1.4,
          Math.sin(angle) * radius * 0.35,
        );
        mesh.rotation.set(angle, angle * 0.4, 0);
        group.add(mesh);
      }

      centerGeometry = new THREE.IcosahedronGeometry(0.9, 0);
      centerMaterial = new THREE.MeshBasicMaterial({
        color: 0xff8a47,
        wireframe: true,
        transparent: true,
        opacity: 0.22,
      });
      group.add(new THREE.Mesh(centerGeometry, centerMaterial));

      function resize() {
        if (!renderer || !canvas) return;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (width < 1 || height < 1) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      }

      resize();
      window.addEventListener("resize", resize);

      const clock = new THREE.Clock();
      function frame() {
        if (disposed || !renderer || !group) return;
        const delta = clock.getDelta();
        if (visible && !reduced) {
          group.rotation.y += delta * 0.12;
          group.rotation.x = Math.sin(clock.elapsedTime * 0.18) * 0.08;
          renderer.render(scene, camera);
        }
        if (!reduced) raf = requestAnimationFrame(frame);
      }

      renderer.render(scene, camera);
      if (!reduced) raf = requestAnimationFrame(frame);

      const io = new IntersectionObserver(
        ([entry]) => {
          visible = Boolean(entry?.isIntersecting);
        },
        { threshold: 0.08 },
      );
      io.observe(canvas);

      return () => {
        window.removeEventListener("resize", resize);
        io.disconnect();
      };
    }

    const cleanupPromise = setup();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      void cleanupPromise.then((extra) => extra?.());
      geometry?.dispose();
      centerGeometry?.dispose();
      material?.dispose();
      centerMaterial?.dispose();
      renderer?.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-10 size-full opacity-70"
      aria-hidden
    />
  );
}
