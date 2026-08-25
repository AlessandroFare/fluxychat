"use client";

import React, { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";

interface MagnetProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: number;
  disabled?: boolean;
  magnetStrength?: number;
  activeTransition?: string;
  inactiveTransition?: string;
  wrapperClassName?: string;
  innerClassName?: string;
}

function Magnet({
  children,
  padding = 100,
  disabled = false,
  magnetStrength = 2,
  activeTransition = "transform 0.3s ease-out",
  inactiveTransition = "transform 0.5s ease-in-out",
  wrapperClassName = "",
  innerClassName = "",
  ...props
}: MagnetProps) {
  const magnetRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapEl = magnetRef.current;
    const innerEl = innerRef.current;
    if (!wrapEl || !innerEl) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (disabled || reduce) {
      innerEl.style.transform = "translate3d(0, 0, 0)";
      return;
    }

    let active = false;

    function handleMouseMove(e: MouseEvent) {
      const wrap = magnetRef.current;
      const inner = innerRef.current;
      if (!wrap || !inner) return;
      const { left, top, width, height } = wrap.getBoundingClientRect();
      const centerX = left + width / 2;
      const centerY = top + height / 2;
      const distX = Math.abs(centerX - e.clientX);
      const distY = Math.abs(centerY - e.clientY);

      if (distX < width / 2 + padding && distY < height / 2 + padding) {
        if (!active) {
          active = true;
          inner.style.transition = activeTransition;
        }
        const offsetX = (e.clientX - centerX) / magnetStrength;
        const offsetY = (e.clientY - centerY) / magnetStrength;
        inner.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
      } else if (active) {
        active = false;
        inner.style.transition = inactiveTransition;
        inner.style.transform = "translate3d(0, 0, 0)";
      }
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [padding, disabled, magnetStrength, activeTransition, inactiveTransition]);

  return (
    <div
      ref={magnetRef}
      className={wrapperClassName}
      style={{ position: "relative", display: "inline-block" }}
      {...props}
    >
      <div ref={innerRef} className={innerClassName} style={{ willChange: "transform" }}>
        {children}
      </div>
    </div>
  );
}

export default Magnet;
