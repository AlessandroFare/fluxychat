"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { gsap } from "gsap";

// ─── Data ────────────────────────────────────────────────────────────────────
// Assets in public/landing/flow/
const flowImage = (file: string) => `/landing/flow/${file}`;

export const MESSAGING_FLOW_ITEMS = [
  {
    link: "#",
    text: "Channels that scale",
    image: flowImage("channels.jpg"),
  },
  {
    link: "#",
    text: "Presence & typing",
    image: flowImage("presence.jpg"),
  },
  {
    link: "#",
    text: "Mentions & reactions",
    image: flowImage("mentions.jpg"),
  },
  {
    link: "#",
    text: "AI-ready rooms",
    image: flowImage("ai-ready-rooms.jpg"),
  },
  {
    link: "#",
    text: "Post-event webhooks",
    image: flowImage("webhooks.jpg"),
  },
  {
    link: "#",
    text: "Moderation & safety",
    image: flowImage("cybersecurity.jpg"),
  },
  {
    link: "#",
    text: "Searchable history",
    image: flowImage("analytics.jpg"),
  },
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────
interface FlowingMenuProps {
  items?: ReadonlyArray<{ readonly link: string; readonly text: string; readonly image: string }>;
  speed?: number;
  textColor?: string;
  bgColor?: string;
  marqueeBgColor?: string;
  marqueeTextColor?: string;
  borderColor?: string;
}

interface MenuItemProps {
  link: string;
  text: string;
  image: string;
  speed: number;
  textColor: string;
  marqueeBgColor: string;
  marqueeTextColor: string;
  borderColor: string;
}

// ─── MenuItem ────────────────────────────────────────────────────────────────
function MenuItem({
  link,
  text,
  image,
  speed,
  textColor,
  marqueeBgColor,
  marqueeTextColor,
  borderColor,
}: MenuItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const marqueeInnerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<gsap.core.Tween | null>(null);
  const [repetitions, setRepetitions] = useState(5);

  const animationDefaults = { duration: 0.6, ease: "expo.out" };

  const findClosestEdge = useCallback(
    (mouseX: number, mouseY: number, width: number, height: number): "top" | "bottom" => {
      const topDist = (mouseX - width / 2) ** 2 + mouseY ** 2;
      const botDist = (mouseX - width / 2) ** 2 + (mouseY - height) ** 2;
      return topDist < botDist ? "top" : "bottom";
    },
    [],
  );

  // Calculate how many marquee copies are needed
  useEffect(() => {
    const calc = () => {
      const content = marqueeInnerRef.current?.querySelector<HTMLElement>("[data-part]");
      if (!content) return;
      const cw = content.offsetWidth;
      if (cw === 0) return;
      setRepetitions(Math.max(5, Math.ceil(window.innerWidth / cw) + 2));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [text, image]);

  // Marquee animation
  useEffect(() => {
    const setup = () => {
      const inner = marqueeInnerRef.current;
      const content = inner?.querySelector<HTMLElement>("[data-part]");
      if (!inner || !content) return;
      const cw = content.offsetWidth;
      if (cw === 0) return;
      animationRef.current?.kill();
      animationRef.current = gsap.to(inner, {
        x: -cw,
        duration: speed,
        ease: "none",
        repeat: -1,
      });
    };
    const t = setTimeout(setup, 60);
    return () => {
      clearTimeout(t);
      animationRef.current?.kill();
    };
  }, [text, image, repetitions, speed]);

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const item = itemRef.current;
    const mq = marqueeRef.current;
    const mqi = marqueeInnerRef.current;
    if (!item || !mq || !mqi) return;
    const rect = item.getBoundingClientRect();
    const edge = findClosestEdge(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
    gsap
      .timeline({ defaults: animationDefaults })
      .set(mq, { y: edge === "top" ? "-101%" : "101%" }, 0)
      .set(mqi, { y: edge === "top" ? "101%" : "-101%" }, 0)
      .to([mq, mqi], { y: "0%" }, 0);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const item = itemRef.current;
    const mq = marqueeRef.current;
    const mqi = marqueeInnerRef.current;
    if (!item || !mq || !mqi) return;
    const rect = item.getBoundingClientRect();
    const edge = findClosestEdge(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
    gsap
      .timeline({ defaults: animationDefaults })
      .to(mq, { y: edge === "top" ? "-101%" : "101%" }, 0)
      .to(mqi, { y: edge === "top" ? "101%" : "-101%" }, 0);
  };

  return (
    <div
      ref={itemRef}
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        textAlign: "center",
        borderTop: `1px solid ${borderColor}`,
      }}
    >
      <a
        href={link}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          position: "relative",
          cursor: "pointer",
          textTransform: "uppercase",
          textDecoration: "none",
          whiteSpace: "nowrap",
          fontWeight: 600,
          fontSize: "clamp(14px, 2.8vh, 22px)",
          letterSpacing: "0.06em",
          color: textColor,
        }}
      >
        {text}
      </a>

      {/* Marquee overlay */}
      <div
        ref={marqueeRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          overflow: "hidden",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          transform: "translate3d(0, 101%, 0)",
          backgroundColor: marqueeBgColor,
        }}
      >
        <div style={{ height: "100%", width: "100%", overflow: "hidden" }}>
          <div
            ref={marqueeInnerRef}
            aria-hidden
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              width: "fit-content",
              willChange: "transform",
            }}
          >
            {Array.from({ length: repetitions }).map((_, idx) => (
              <div
                key={idx}
                data-part=""
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    whiteSpace: "nowrap",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    fontSize: "clamp(14px, 2.8vh, 22px)",
                    letterSpacing: "0.06em",
                    color: marqueeTextColor,
                    padding: "0 1.5vw",
                  }}
                >
                  {text}
                </span>
                <div
                  style={{
                    width: "clamp(120px, 14vw, 200px)",
                    height: "5vh",
                    margin: "0 1vw",
                    borderRadius: "50px",
                    backgroundImage: `url(${image})`,
                    backgroundSize: "cover",
                    backgroundPosition: "50% 50%",
                    flexShrink: 0,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FlowingMenu ─────────────────────────────────────────────────────────────
export function FlowingMenu({
  items = MESSAGING_FLOW_ITEMS,
  speed = 18,
  textColor = "#ffffff",
  bgColor = "#0e0e0e",
  marqueeBgColor = "#ff725e",
  marqueeTextColor = "#ffffff",
  borderColor = "rgba(255,255,255,0.08)",
}: FlowingMenuProps) {
  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", backgroundColor: bgColor }}>
      <nav style={{ display: "flex", flexDirection: "column", height: "100%", margin: 0, padding: 0 }}>
        {items.map((item, idx) => (
          <MenuItem
            key={idx}
            {...item}
            speed={speed}
            textColor={textColor}
            marqueeBgColor={marqueeBgColor}
            marqueeTextColor={marqueeTextColor}
            borderColor={idx === 0 ? "transparent" : borderColor}
          />
        ))}
      </nav>
    </div>
  );
}