"use client";

import { useState, useEffect, useCallback } from "react";
import { FluxychatIcon, FluxychatMark } from "@/components/FluxychatLogo";

// Design tokens for the slide deck
const colors = {
  background: "#faf9f6",
  text: "#1a1a1a",
  textMuted: "#64748b",
  accent: "#0d9488", // teal-600
  accentLight: "#ccfbf1", // teal-100
  border: "#e2e8f0",
  codeBackground: "#f8fafc",
  orange: "#FF6A1A", // Cloudflare orange (used sparingly)
};

interface SlideProps {
  children: React.ReactNode;
  className?: string;
}

function Slide({ children, className = "" }: SlideProps) {
  return (
    <div
      className={`w-full h-full flex flex-col p-12 lg:p-16 ${className}`}
      style={{ backgroundColor: colors.background }}
    >
      {children}
    </div>
  );
}

function SlideNumber({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="absolute bottom-6 right-8 text-sm font-mono"
      style={{ color: colors.textMuted }}
    >
      {current} / {total}
    </div>
  );
}

function CodeBlock({ children, language = "tsx" }: { children: string; language?: string }) {
  return (
    <pre
      className="rounded-lg p-6 text-sm lg:text-base overflow-x-auto font-mono"
      style={{
        backgroundColor: colors.codeBackground,
        border: `1px solid ${colors.border}`,
        color: colors.text,
      }}
    >
      <code>{children}</code>
    </pre>
  );
}

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "orange" }) {
  const bg = variant === "orange" ? colors.orange : colors.accentLight;
  const fg = variant === "orange" ? "white" : colors.accent;
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: bg, color: fg }}
    >
      {children}
    </span>
  );
}

// Individual Slides
function TitleSlide() {
  return (
    <Slide className="justify-center items-center text-center">
      <div className="flex flex-col items-center gap-8">
        <FluxychatIcon size={80} />
        <h1
          className="text-6xl lg:text-7xl font-bold tracking-tight"
          style={{ color: colors.text, letterSpacing: "-0.03em" }}
        >
          Fluxychat
        </h1>
        <p
          className="text-2xl lg:text-3xl font-light"
          style={{ color: colors.textMuted }}
        >
          Realtime that feels like serverless
        </p>
        <div className="flex items-center gap-4 mt-8">
          <Badge>Open beta</Badge>
          <Badge>MIT</Badge>
        </div>
        <p
          className="text-lg font-mono mt-4"
          style={{ color: colors.accent }}
        >
          fluxychat.vercel.app
        </p>
      </div>
    </Slide>
  );
}

function ProblemSlide() {
  return (
    <Slide>
      <h2
        className="text-4xl lg:text-5xl font-bold tracking-tight mb-12"
        style={{ color: colors.text, letterSpacing: "-0.02em" }}
      >
        REST is trivial on serverless.
        <br />
        <span style={{ color: colors.textMuted }}>WebSockets aren{"'"}t.</span>
      </h2>

      <ul className="space-y-6 text-xl lg:text-2xl mb-12" style={{ color: colors.text }}>
        <li className="flex items-start gap-4">
          <span style={{ color: colors.accent }}>1.</span>
          <span>You need a second vendor for sockets</span>
        </li>
        <li className="flex items-start gap-4">
          <span style={{ color: colors.accent }}>2.</span>
          <span>A second ops stack to monitor</span>
        </li>
        <li className="flex items-start gap-4">
          <span style={{ color: colors.accent }}>3.</span>
          <span>Vercel doesn{"'"}t host your WebSockets</span>
        </li>
      </ul>

      <div
        className="flex items-center justify-center gap-4 p-8 rounded-xl mt-auto"
        style={{ backgroundColor: colors.codeBackground, border: `1px solid ${colors.border}` }}
      >
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-32 h-16 rounded-lg flex items-center justify-center text-sm font-medium"
            style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
          >
            Next.js on Vercel
          </div>
        </div>
        <span className="text-3xl" style={{ color: colors.textMuted }}>→</span>
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-24 h-16 rounded-lg flex items-center justify-center text-2xl font-bold"
            style={{ color: colors.accent }}
          >
            ???
          </div>
        </div>
        <span className="text-3xl" style={{ color: colors.textMuted }}>→</span>
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-32 h-16 rounded-lg flex items-center justify-center text-sm font-medium"
            style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
          >
            Pusher / Ably
          </div>
        </div>
      </div>
    </Slide>
  );
}

function SolutionSlide() {
  return (
    <Slide>
      <h2
        className="text-4xl lg:text-5xl font-bold tracking-tight mb-4"
        style={{ color: colors.text, letterSpacing: "-0.02em" }}
      >
        Chat on your Cloudflare edge
      </h2>
      <p className="text-xl mb-12" style={{ color: colors.textMuted }}>
        One stack. Your infrastructure. Zero cold starts.
      </p>

      <div
        className="flex-1 flex items-center justify-center p-8 rounded-xl"
        style={{ backgroundColor: colors.codeBackground, border: `1px solid ${colors.border}` }}
      >
        <div className="flex items-center gap-6 flex-wrap justify-center">
          {/* Next.js App */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-36 h-20 rounded-lg flex items-center justify-center text-sm font-medium"
              style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
            >
              Next.js App
            </div>
            <span className="text-xs" style={{ color: colors.textMuted }}>Your frontend</span>
          </div>

          <span className="text-2xl" style={{ color: colors.textMuted }}>→</span>

          {/* SDK */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-36 h-20 rounded-lg flex items-center justify-center text-sm font-mono font-medium"
              style={{ backgroundColor: colors.accentLight, border: `1px solid ${colors.accent}`, color: colors.accent }}
            >
              @fluxy-chat/sdk
            </div>
            <span className="text-xs" style={{ color: colors.textMuted }}>React hooks</span>
          </div>

          <span className="text-2xl" style={{ color: colors.textMuted }}>→</span>

          {/* Cloudflare Stack */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-28 h-14 rounded-lg flex items-center justify-center text-xs font-medium"
                style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
              >
                Worker
              </div>
              <Badge variant="orange">CF</Badge>
            </div>
            <div className="flex gap-2">
              <div
                className="w-20 h-12 rounded flex items-center justify-center text-xs"
                style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
              >
                DO
              </div>
              <div
                className="w-20 h-12 rounded flex items-center justify-center text-xs"
                style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
              >
                D1
              </div>
            </div>
            <span className="text-xs text-center" style={{ color: colors.textMuted }}>
              Durable Objects + SQLite
            </span>
          </div>
        </div>
      </div>
    </Slide>
  );
}

function AudienceSlide() {
  return (
    <Slide>
      <h2
        className="text-4xl lg:text-5xl font-bold tracking-tight mb-12"
        style={{ color: colors.text, letterSpacing: "-0.02em" }}
      >
        Who it{"'"}s for
      </h2>

      <div className="grid grid-cols-2 gap-8 flex-1">
        <div
          className="p-8 rounded-xl"
          style={{ backgroundColor: colors.accentLight, border: `1px solid ${colors.accent}` }}
        >
          <h3
            className="text-2xl font-semibold mb-6"
            style={{ color: colors.accent }}
          >
            For you if...
          </h3>
          <ul className="space-y-4 text-lg" style={{ color: colors.text }}>
            <li className="flex items-start gap-3">
              <span style={{ color: colors.accent }}>+</span>
              Building edge-first apps
            </li>
            <li className="flex items-start gap-3">
              <span style={{ color: colors.accent }}>+</span>
              Want MIT license / self-host option
            </li>
            <li className="flex items-start gap-3">
              <span style={{ color: colors.accent }}>+</span>
              Prefer building your own UI
            </li>
            <li className="flex items-start gap-3">
              <span style={{ color: colors.accent }}>+</span>
              Value infrastructure ownership
            </li>
          </ul>
        </div>

        <div
          className="p-8 rounded-xl"
          style={{ backgroundColor: colors.codeBackground, border: `1px solid ${colors.border}` }}
        >
          <h3
            className="text-2xl font-semibold mb-6"
            style={{ color: colors.textMuted }}
          >
            Not for you if...
          </h3>
          <ul className="space-y-4 text-lg" style={{ color: colors.textMuted }}>
            <li className="flex items-start gap-3">
              <span>-</span>
              Need TalkJS-style widget on day 1
            </li>
            <li className="flex items-start gap-3">
              <span>-</span>
              Require enterprise SLA today
            </li>
            <li className="flex items-start gap-3">
              <span>-</span>
              Don{"'"}t want to touch infrastructure
            </li>
          </ul>
        </div>
      </div>
    </Slide>
  );
}

function SDKSlide() {
  const codeExample = `import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/sdk";

function App() {
  return (
    <FluxyRealtimeProvider
      workerUrl="https://your-worker.workers.dev"
      projectId="proj_xxx"
    >
      <ChatRoom roomId="general" />
    </FluxyRealtimeProvider>
  );
}

function ChatRoom({ roomId }: { roomId: string }) {
  const { messages, send, isConnected } = useChat({ roomId });

  return (
    <div>
      {messages.map((m) => <Message key={m.id} {...m} />)}
      <input onKeyDown={(e) => e.key === "Enter" && send(e.target.value)} />
    </div>
  );
}`;

  return (
    <Slide>
      <div className="flex items-center justify-between mb-8">
        <h2
          className="text-4xl lg:text-5xl font-bold tracking-tight font-mono"
          style={{ color: colors.text, letterSpacing: "-0.02em" }}
        >
          useChat(roomId)
        </h2>
        <Badge>@fluxy-chat/sdk</Badge>
      </div>

      <div className="flex-1 overflow-hidden">
        <CodeBlock>{codeExample}</CodeBlock>
      </div>

      <div className="flex gap-4 mt-6">
        <span className="text-sm font-mono" style={{ color: colors.textMuted }}>
          npm install @fluxy-chat/sdk
        </span>
      </div>
    </Slide>
  );
}

function ConsoleSlide() {
  return (
    <Slide>
      <h2
        className="text-4xl lg:text-5xl font-bold tracking-tight mb-4"
        style={{ color: colors.text, letterSpacing: "-0.02em" }}
      >
        Ship faster with the console
      </h2>
      <p className="text-xl mb-8" style={{ color: colors.textMuted }}>
        Everything you need to manage realtime chat at scale.
      </p>

      <div
        className="flex-1 rounded-xl p-8"
        style={{ backgroundColor: colors.codeBackground, border: `1px solid ${colors.border}` }}
      >
        {/* Wireframe UI */}
        <div className="grid grid-cols-12 gap-4 h-full">
          {/* Sidebar */}
          <div
            className="col-span-3 rounded-lg p-4"
            style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
          >
            <div className="space-y-3">
              <div className="h-8 rounded" style={{ backgroundColor: colors.accentLight }} />
              <div className="h-6 rounded w-3/4" style={{ backgroundColor: colors.border }} />
              <div className="h-6 rounded w-2/3" style={{ backgroundColor: colors.border }} />
              <div className="h-6 rounded w-4/5" style={{ backgroundColor: colors.border }} />
              <div className="h-6 rounded w-1/2" style={{ backgroundColor: colors.border }} />
            </div>
          </div>

          {/* Main content */}
          <div className="col-span-9 space-y-4">
            <div
              className="rounded-lg p-4 h-1/2"
              style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
            >
              <div className="h-6 rounded w-1/4 mb-4" style={{ backgroundColor: colors.border }} />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-20 rounded" style={{ backgroundColor: colors.accentLight }} />
                <div className="h-20 rounded" style={{ backgroundColor: colors.codeBackground }} />
                <div className="h-20 rounded" style={{ backgroundColor: colors.codeBackground }} />
              </div>
            </div>
            <div
              className="rounded-lg p-4 flex-1"
              style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
            >
              <div className="h-4 rounded w-1/3 mb-3" style={{ backgroundColor: colors.border }} />
              <div className="h-4 rounded w-full mb-2" style={{ backgroundColor: colors.codeBackground }} />
              <div className="h-4 rounded w-5/6" style={{ backgroundColor: colors.codeBackground }} />
            </div>
          </div>
        </div>
      </div>

      <ul className="flex gap-8 mt-6 text-base" style={{ color: colors.text }}>
        <li>Onboarding wizard</li>
        <li>Room management</li>
        <li>AI agents</li>
        <li>Webhooks</li>
        <li>GDPR export</li>
      </ul>
    </Slide>
  );
}

function HostingSlide() {
  return (
    <Slide>
      <h2
        className="text-4xl lg:text-5xl font-bold tracking-tight mb-12"
        style={{ color: colors.text, letterSpacing: "-0.02em" }}
      >
        Hosted vs Self-host
      </h2>

      <div className="grid grid-cols-2 gap-8 flex-1">
        <div
          className="p-8 rounded-xl flex flex-col"
          style={{ backgroundColor: colors.accentLight, border: `1px solid ${colors.accent}` }}
        >
          <h3
            className="text-2xl font-semibold mb-2"
            style={{ color: colors.accent }}
          >
            Hosted Cloud
          </h3>
          <p className="text-lg mb-6" style={{ color: colors.text }}>
            Sign up and start in minutes
          </p>
          <ul className="space-y-3 text-base flex-1" style={{ color: colors.text }}>
            <li className="flex items-start gap-2">
              <span style={{ color: colors.accent }}>+</span>
              Zero infrastructure setup
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: colors.accent }}>+</span>
              Managed updates and scaling
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: colors.accent }}>+</span>
              Free tier available
            </li>
          </ul>
          <div
            className="mt-6 px-4 py-2 rounded-lg text-center font-mono text-sm"
            style={{ backgroundColor: "white" }}
          >
            fluxychat.vercel.app/get-started
          </div>
        </div>

        <div
          className="p-8 rounded-xl flex flex-col"
          style={{ backgroundColor: colors.codeBackground, border: `1px solid ${colors.border}` }}
        >
          <h3
            className="text-2xl font-semibold mb-2"
            style={{ color: colors.text }}
          >
            Self-host
          </h3>
          <p className="text-lg mb-6" style={{ color: colors.textMuted }}>
            Clone the MIT repo, your CF account
          </p>
          <ul className="space-y-3 text-base flex-1" style={{ color: colors.text }}>
            <li className="flex items-start gap-2">
              <span>+</span>
              Full infrastructure control
            </li>
            <li className="flex items-start gap-2">
              <span>+</span>
              Data stays on your account
            </li>
            <li className="flex items-start gap-2">
              <span>+</span>
              Customize everything
            </li>
          </ul>
          <div
            className="mt-6 px-4 py-2 rounded-lg text-center font-mono text-sm"
            style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
          >
            github.com/fluxychat/fluxychat
          </div>
        </div>
      </div>

      <p
        className="text-center mt-8 text-lg font-medium"
        style={{ color: colors.accent }}
      >
        Same codebase. Same features. Your choice.
      </p>
    </Slide>
  );
}

function DemoSlide() {
  const steps = [
    { num: 1, label: "Sign up", desc: "Create account" },
    { num: 2, label: "Quickstart", desc: "Follow wizard" },
    { num: 3, label: "Create room", desc: "First chat room" },
    { num: 4, label: "Send message", desc: "Test realtime" },
    { num: 5, label: "Add agent", desc: "(Optional) AI" },
  ];

  return (
    <Slide>
      <h2
        className="text-4xl lg:text-5xl font-bold tracking-tight mb-12"
        style={{ color: colors.text, letterSpacing: "-0.02em" }}
      >
        Live demo flow
      </h2>

      <div className="flex-1 flex items-center">
        <div className="w-full flex items-center justify-between gap-4">
          {steps.map((step, i) => (
            <div key={step.num} className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
                  style={{
                    backgroundColor: i === 0 ? colors.accent : colors.codeBackground,
                    color: i === 0 ? "white" : colors.text,
                    border: `2px solid ${i === 0 ? colors.accent : colors.border}`,
                  }}
                >
                  {step.num}
                </div>
                <div className="text-center">
                  <p className="font-semibold" style={{ color: colors.text }}>{step.label}</p>
                  <p className="text-sm" style={{ color: colors.textMuted }}>{step.desc}</p>
                </div>
                <div
                  className="w-32 h-24 rounded-lg flex items-center justify-center text-xs"
                  style={{ backgroundColor: colors.codeBackground, border: `1px solid ${colors.border}`, color: colors.textMuted }}
                >
                  screenshot
                </div>
              </div>
              {i < steps.length - 1 && (
                <span className="text-2xl" style={{ color: colors.border }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

function TradeoffsSlide() {
  return (
    <Slide>
      <h2
        className="text-4xl lg:text-5xl font-bold tracking-tight mb-8"
        style={{ color: colors.text, letterSpacing: "-0.02em" }}
      >
        Honest tradeoffs
      </h2>

      <div
        className="flex-1 rounded-xl overflow-hidden"
        style={{ border: `1px solid ${colors.border}` }}
      >
        <table className="w-full h-full">
          <thead>
            <tr style={{ backgroundColor: colors.codeBackground }}>
              <th className="p-4 text-left text-lg font-semibold" style={{ color: colors.text, borderBottom: `1px solid ${colors.border}` }}>
                Aspect
              </th>
              <th className="p-4 text-left text-lg font-semibold" style={{ color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>
                Stream / TalkJS
              </th>
              <th className="p-4 text-left text-lg font-semibold" style={{ color: colors.accent, borderBottom: `1px solid ${colors.border}` }}>
                Fluxychat
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ backgroundColor: "white" }}>
              <td className="p-4 font-medium" style={{ color: colors.text, borderBottom: `1px solid ${colors.border}` }}>Time to polished UI</td>
              <td className="p-4" style={{ color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>Minutes (pre-built)</td>
              <td className="p-4" style={{ color: colors.text, borderBottom: `1px solid ${colors.border}` }}>Hours (build yours)</td>
            </tr>
            <tr style={{ backgroundColor: colors.codeBackground }}>
              <td className="p-4 font-medium" style={{ color: colors.text, borderBottom: `1px solid ${colors.border}` }}>Infrastructure control</td>
              <td className="p-4" style={{ color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>Their servers</td>
              <td className="p-4" style={{ color: colors.accent, borderBottom: `1px solid ${colors.border}` }}>Your Worker</td>
            </tr>
            <tr style={{ backgroundColor: "white" }}>
              <td className="p-4 font-medium" style={{ color: colors.text, borderBottom: `1px solid ${colors.border}` }}>Customization</td>
              <td className="p-4" style={{ color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>Theme tokens</td>
              <td className="p-4" style={{ color: colors.accent, borderBottom: `1px solid ${colors.border}` }}>Full source code</td>
            </tr>
            <tr style={{ backgroundColor: colors.codeBackground }}>
              <td className="p-4 font-medium" style={{ color: colors.text, borderBottom: `1px solid ${colors.border}` }}>Pricing model</td>
              <td className="p-4" style={{ color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>Per MAU</td>
              <td className="p-4" style={{ color: colors.accent, borderBottom: `1px solid ${colors.border}` }}>CF usage-based</td>
            </tr>
            <tr style={{ backgroundColor: "white" }}>
              <td className="p-4 font-medium" style={{ color: colors.text }}>Maturity</td>
              <td className="p-4" style={{ color: colors.textMuted }}>Production-proven</td>
              <td className="p-4" style={{ color: colors.text }}>Beta</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p
        className="text-center mt-6 text-base"
        style={{ color: colors.textMuted }}
      >
        Fluxychat is in open beta. Expect rough edges. We{"'"}re shipping fast.
      </p>
    </Slide>
  );
}

function CTASlide() {
  return (
    <Slide className="justify-center items-center text-center">
      <FluxychatIcon size={64} />

      <h2
        className="text-4xl lg:text-5xl font-bold tracking-tight mt-8 mb-12"
        style={{ color: colors.text, letterSpacing: "-0.02em" }}
      >
        Get started
      </h2>

      <div className="grid grid-cols-2 gap-x-16 gap-y-4 text-left text-lg mb-12">
        <div>
          <span className="font-medium" style={{ color: colors.text }}>Landing</span>
          <p className="font-mono" style={{ color: colors.accent }}>fluxychat.vercel.app/landing</p>
        </div>
        <div>
          <span className="font-medium" style={{ color: colors.text }}>Why Fluxychat</span>
          <p className="font-mono" style={{ color: colors.accent }}>fluxychat.vercel.app/why</p>
        </div>
        <div>
          <span className="font-medium" style={{ color: colors.text }}>GitHub</span>
          <p className="font-mono" style={{ color: colors.accent }}>github.com/fluxychat/fluxychat</p>
        </div>
        <div>
          <span className="font-medium" style={{ color: colors.text }}>npm</span>
          <p className="font-mono" style={{ color: colors.accent }}>npmjs.com/package/@fluxy-chat/sdk</p>
        </div>
      </div>

      <div
        className="w-48 h-48 rounded-xl flex items-center justify-center mb-6"
        style={{ backgroundColor: colors.codeBackground, border: `1px solid ${colors.border}` }}
      >
        <span className="text-sm" style={{ color: colors.textMuted }}>QR Code</span>
      </div>

      <p className="font-mono text-lg" style={{ color: colors.textMuted }}>
        fluxychat@outlook.com
      </p>
    </Slide>
  );
}

const slides = [
  TitleSlide,
  ProblemSlide,
  SolutionSlide,
  AudienceSlide,
  SDKSlide,
  ConsoleSlide,
  HostingSlide,
  DemoSlide,
  TradeoffsSlide,
  CTASlide,
];

export default function SlidesPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentSlide(index);
    }
  }, []);

  const nextSlide = useCallback(() => {
    goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        prevSlide();
      } else if (e.key === "Home") {
        e.preventDefault();
        goToSlide(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goToSlide(slides.length - 1);
      } else if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        goToSlide(parseInt(e.key) - 1);
      } else if (e.key === "0") {
        e.preventDefault();
        goToSlide(9);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide, goToSlide]);

  const CurrentSlideComponent = slides[currentSlide];

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{ backgroundColor: colors.background }}
    >
      {/* 16:9 aspect ratio container */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full h-full max-w-[1920px] max-h-[1080px] relative"
          style={{
            aspectRatio: "16/9",
            maxHeight: "min(100%, calc((100vw - 2rem) * 9 / 16))",
            maxWidth: "min(100%, calc((100vh - 2rem) * 16 / 9))",
          }}
        >
          <CurrentSlideComponent />
          <SlideNumber current={currentSlide + 1} total={slides.length} />
        </div>
      </div>

      {/* Navigation hints */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs font-mono"
        style={{ color: colors.textMuted }}
      >
        <span>← →</span>
        <span>or click</span>
      </div>

      {/* Click zones for navigation */}
      <button
        onClick={prevSlide}
        className="absolute left-0 top-0 w-1/3 h-full cursor-w-resize opacity-0"
        aria-label="Previous slide"
      />
      <button
        onClick={nextSlide}
        className="absolute right-0 top-0 w-2/3 h-full cursor-e-resize opacity-0"
        aria-label="Next slide"
      />

      {/* Slide dots */}
      <div className="absolute bottom-4 left-4 flex gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goToSlide(i)}
            className="w-2 h-2 rounded-full transition-all"
            style={{
              backgroundColor: i === currentSlide ? colors.accent : colors.border,
            }}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
