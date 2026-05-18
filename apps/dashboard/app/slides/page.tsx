"use client";

import { FluxychatIcon } from "@/components/FluxychatLogo";

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
  slideNumber: number;
  totalSlides: number;
}

function Slide({ children, className = "", slideNumber, totalSlides }: SlideProps) {
  return (
    <div
      className={`slide-page w-full flex flex-col p-10 relative ${className}`}
      style={{
        backgroundColor: colors.background,
        aspectRatio: "16/9",
        pageBreakAfter: "always",
        pageBreakInside: "avoid",
      }}
    >
      {children}
      <div
        className="absolute bottom-4 right-6 text-xs font-mono"
        style={{ color: colors.textMuted }}
      >
        {slideNumber} / {totalSlides}
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      className="rounded-lg p-4 text-xs overflow-x-auto font-mono leading-relaxed"
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
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ backgroundColor: bg, color: fg }}
    >
      {children}
    </span>
  );
}

// Slide 1: Title
function TitleSlide({ slideNumber, totalSlides }: { slideNumber: number; totalSlides: number }) {
  return (
    <Slide slideNumber={slideNumber} totalSlides={totalSlides} className="justify-center items-center text-center">
      <div className="flex flex-col items-center gap-5">
        <FluxychatIcon size={56} />
        <h1
          className="text-5xl font-bold tracking-tight"
          style={{ color: colors.text, letterSpacing: "-0.03em" }}
        >
          Fluxychat
        </h1>
        <p
          className="text-xl font-light"
          style={{ color: colors.textMuted }}
        >
          Realtime that feels like serverless
        </p>
        <div className="flex items-center gap-3 mt-4">
          <Badge>Open beta</Badge>
          <Badge>MIT</Badge>
        </div>
        <p
          className="text-sm font-mono mt-2"
          style={{ color: colors.accent }}
        >
          fluxychat.vercel.app
        </p>
      </div>
    </Slide>
  );
}

// Slide 2: Problem
function ProblemSlide({ slideNumber, totalSlides }: { slideNumber: number; totalSlides: number }) {
  return (
    <Slide slideNumber={slideNumber} totalSlides={totalSlides}>
      <h2
        className="text-3xl font-bold tracking-tight mb-6"
        style={{ color: colors.text, letterSpacing: "-0.02em" }}
      >
        REST is trivial on serverless.
        <br />
        <span style={{ color: colors.textMuted }}>WebSockets aren{"'"}t.</span>
      </h2>

      <ul className="space-y-3 text-base mb-6" style={{ color: colors.text }}>
        <li className="flex items-start gap-3">
          <span style={{ color: colors.accent }}>1.</span>
          <span>You need a second vendor for sockets</span>
        </li>
        <li className="flex items-start gap-3">
          <span style={{ color: colors.accent }}>2.</span>
          <span>A second ops stack to monitor</span>
        </li>
        <li className="flex items-start gap-3">
          <span style={{ color: colors.accent }}>3.</span>
          <span>Vercel doesn{"'"}t host your WebSockets</span>
        </li>
      </ul>

      <div
        className="flex items-center justify-center gap-4 p-5 rounded-xl mt-auto"
        style={{ backgroundColor: colors.codeBackground, border: `1px solid ${colors.border}` }}
      >
        <div className="flex flex-col items-center gap-1">
          <div
            className="w-28 h-12 rounded-lg flex items-center justify-center text-xs font-medium"
            style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
          >
            Next.js on Vercel
          </div>
        </div>
        <span className="text-xl" style={{ color: colors.textMuted }}>→</span>
        <div className="flex flex-col items-center gap-1">
          <div
            className="w-16 h-12 rounded-lg flex items-center justify-center text-xl font-bold"
            style={{ color: colors.accent }}
          >
            ???
          </div>
        </div>
        <span className="text-xl" style={{ color: colors.textMuted }}>→</span>
        <div className="flex flex-col items-center gap-1">
          <div
            className="w-28 h-12 rounded-lg flex items-center justify-center text-xs font-medium"
            style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
          >
            Pusher / Ably
          </div>
        </div>
      </div>
    </Slide>
  );
}

// Slide 3: Solution
function SolutionSlide({ slideNumber, totalSlides }: { slideNumber: number; totalSlides: number }) {
  return (
    <Slide slideNumber={slideNumber} totalSlides={totalSlides}>
      <h2
        className="text-3xl font-bold tracking-tight mb-2"
        style={{ color: colors.text, letterSpacing: "-0.02em" }}
      >
        Chat on your Cloudflare edge
      </h2>
      <p className="text-base mb-6" style={{ color: colors.textMuted }}>
        One stack. Your infrastructure. Zero cold starts.
      </p>

      <div
        className="flex-1 flex items-center justify-center p-5 rounded-xl"
        style={{ backgroundColor: colors.codeBackground, border: `1px solid ${colors.border}` }}
      >
        <div className="flex items-center gap-5 flex-wrap justify-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-28 h-14 rounded-lg flex items-center justify-center text-xs font-medium"
              style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
            >
              Next.js App
            </div>
            <span className="text-[10px]" style={{ color: colors.textMuted }}>Your frontend</span>
          </div>

          <span className="text-lg" style={{ color: colors.textMuted }}>→</span>

          <div className="flex flex-col items-center gap-1">
            <div
              className="w-28 h-14 rounded-lg flex items-center justify-center text-[10px] font-mono font-medium"
              style={{ backgroundColor: colors.accentLight, border: `1px solid ${colors.accent}`, color: colors.accent }}
            >
              @fluxy-chat/sdk
            </div>
            <span className="text-[10px]" style={{ color: colors.textMuted }}>React hooks</span>
          </div>

          <span className="text-lg" style={{ color: colors.textMuted }}>→</span>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className="w-20 h-10 rounded-lg flex items-center justify-center text-[10px] font-medium"
                style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
              >
                Worker
              </div>
              <Badge variant="orange">CF</Badge>
            </div>
            <div className="flex gap-2">
              <div
                className="w-14 h-8 rounded flex items-center justify-center text-[10px]"
                style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
              >
                DO
              </div>
              <div
                className="w-14 h-8 rounded flex items-center justify-center text-[10px]"
                style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
              >
                D1
              </div>
            </div>
            <span className="text-[10px] text-center" style={{ color: colors.textMuted }}>
              Durable Objects + SQLite
            </span>
          </div>
        </div>
      </div>
    </Slide>
  );
}

// Slide 4: Audience
function AudienceSlide({ slideNumber, totalSlides }: { slideNumber: number; totalSlides: number }) {
  return (
    <Slide slideNumber={slideNumber} totalSlides={totalSlides}>
      <h2
        className="text-3xl font-bold tracking-tight mb-6"
        style={{ color: colors.text, letterSpacing: "-0.02em" }}
      >
        Who it{"'"}s for
      </h2>

      <div className="grid grid-cols-2 gap-5 flex-1">
        <div
          className="p-5 rounded-xl"
          style={{ backgroundColor: colors.accentLight, border: `1px solid ${colors.accent}` }}
        >
          <h3
            className="text-lg font-semibold mb-4"
            style={{ color: colors.accent }}
          >
            For you if...
          </h3>
          <ul className="space-y-2 text-sm" style={{ color: colors.text }}>
            <li className="flex items-start gap-2">
              <span style={{ color: colors.accent }}>+</span>
              Building edge-first apps
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: colors.accent }}>+</span>
              Want MIT license / self-host option
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: colors.accent }}>+</span>
              Prefer building your own UI
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: colors.accent }}>+</span>
              Value infrastructure ownership
            </li>
          </ul>
        </div>

        <div
          className="p-5 rounded-xl"
          style={{ backgroundColor: colors.codeBackground, border: `1px solid ${colors.border}` }}
        >
          <h3
            className="text-lg font-semibold mb-4"
            style={{ color: colors.textMuted }}
          >
            Not for you if...
          </h3>
          <ul className="space-y-2 text-sm" style={{ color: colors.textMuted }}>
            <li className="flex items-start gap-2">
              <span>-</span>
              Need TalkJS-style widget on day 1
            </li>
            <li className="flex items-start gap-2">
              <span>-</span>
              Require enterprise SLA today
            </li>
            <li className="flex items-start gap-2">
              <span>-</span>
              Don{"'"}t want to touch infrastructure
            </li>
          </ul>
        </div>
      </div>
    </Slide>
  );
}

// Slide 5: SDK
function SDKSlide({ slideNumber, totalSlides }: { slideNumber: number; totalSlides: number }) {
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
    <Slide slideNumber={slideNumber} totalSlides={totalSlides}>
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-3xl font-bold tracking-tight font-mono"
          style={{ color: colors.text, letterSpacing: "-0.02em" }}
        >
          useChat(roomId)
        </h2>
        <Badge>@fluxy-chat/sdk</Badge>
      </div>

      <div className="flex-1 overflow-hidden">
        <CodeBlock>{codeExample}</CodeBlock>
      </div>

      <div className="flex gap-4 mt-4">
        <span className="text-xs font-mono" style={{ color: colors.textMuted }}>
          npm install @fluxy-chat/sdk
        </span>
      </div>
    </Slide>
  );
}

// Slide 6: Console
function ConsoleSlide({ slideNumber, totalSlides }: { slideNumber: number; totalSlides: number }) {
  return (
    <Slide slideNumber={slideNumber} totalSlides={totalSlides}>
      <h2
        className="text-3xl font-bold tracking-tight mb-2"
        style={{ color: colors.text, letterSpacing: "-0.02em" }}
      >
        Ship faster with the console
      </h2>
      <p className="text-base mb-5" style={{ color: colors.textMuted }}>
        Everything you need to manage realtime chat at scale.
      </p>

      <div
        className="flex-1 rounded-xl p-5"
        style={{ backgroundColor: colors.codeBackground, border: `1px solid ${colors.border}` }}
      >
        <div className="grid grid-cols-12 gap-3 h-full">
          <div
            className="col-span-3 rounded-lg p-3"
            style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
          >
            <div className="space-y-2">
              <div className="h-5 rounded" style={{ backgroundColor: colors.accentLight }} />
              <div className="h-4 rounded w-3/4" style={{ backgroundColor: colors.border }} />
              <div className="h-4 rounded w-2/3" style={{ backgroundColor: colors.border }} />
              <div className="h-4 rounded w-4/5" style={{ backgroundColor: colors.border }} />
            </div>
          </div>

          <div className="col-span-9 space-y-3">
            <div
              className="rounded-lg p-3 h-1/2"
              style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
            >
              <div className="h-4 rounded w-1/4 mb-3" style={{ backgroundColor: colors.border }} />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-12 rounded" style={{ backgroundColor: colors.accentLight }} />
                <div className="h-12 rounded" style={{ backgroundColor: colors.codeBackground }} />
                <div className="h-12 rounded" style={{ backgroundColor: colors.codeBackground }} />
              </div>
            </div>
            <div
              className="rounded-lg p-3"
              style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
            >
              <div className="h-3 rounded w-1/3 mb-2" style={{ backgroundColor: colors.border }} />
              <div className="h-3 rounded w-full mb-1" style={{ backgroundColor: colors.codeBackground }} />
              <div className="h-3 rounded w-5/6" style={{ backgroundColor: colors.codeBackground }} />
            </div>
          </div>
        </div>
      </div>

      <ul className="flex gap-6 mt-4 text-xs" style={{ color: colors.text }}>
        <li>Onboarding wizard</li>
        <li>Room management</li>
        <li>AI agents</li>
        <li>Webhooks</li>
        <li>GDPR export</li>
      </ul>
    </Slide>
  );
}

// Slide 7: Hosting
function HostingSlide({ slideNumber, totalSlides }: { slideNumber: number; totalSlides: number }) {
  return (
    <Slide slideNumber={slideNumber} totalSlides={totalSlides}>
      <h2
        className="text-3xl font-bold tracking-tight mb-6"
        style={{ color: colors.text, letterSpacing: "-0.02em" }}
      >
        Hosted vs Self-host
      </h2>

      <div className="grid grid-cols-2 gap-5 flex-1">
        <div
          className="p-5 rounded-xl flex flex-col"
          style={{ backgroundColor: colors.accentLight, border: `1px solid ${colors.accent}` }}
        >
          <h3
            className="text-lg font-semibold mb-1"
            style={{ color: colors.accent }}
          >
            Hosted Cloud
          </h3>
          <p className="text-sm mb-4" style={{ color: colors.text }}>
            Sign up and start in minutes
          </p>
          <ul className="space-y-2 text-xs flex-1" style={{ color: colors.text }}>
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
            className="mt-4 px-3 py-1.5 rounded-lg text-center font-mono text-[10px]"
            style={{ backgroundColor: "white" }}
          >
            fluxychat.vercel.app/get-started
          </div>
        </div>

        <div
          className="p-5 rounded-xl flex flex-col"
          style={{ backgroundColor: colors.codeBackground, border: `1px solid ${colors.border}` }}
        >
          <h3
            className="text-lg font-semibold mb-1"
            style={{ color: colors.text }}
          >
            Self-host
          </h3>
          <p className="text-sm mb-4" style={{ color: colors.textMuted }}>
            Clone the MIT repo, your CF account
          </p>
          <ul className="space-y-2 text-xs flex-1" style={{ color: colors.text }}>
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
            className="mt-4 px-3 py-1.5 rounded-lg text-center font-mono text-[10px]"
            style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
          >
            github.com/fluxychat/fluxychat
          </div>
        </div>
      </div>

      <p
        className="text-center mt-4 text-sm font-medium"
        style={{ color: colors.accent }}
      >
        Same codebase. Same features. Your choice.
      </p>
    </Slide>
  );
}

// Slide 8: Demo
function DemoSlide({ slideNumber, totalSlides }: { slideNumber: number; totalSlides: number }) {
  const steps = [
    { num: 1, label: "Sign up", desc: "Create account" },
    { num: 2, label: "Quickstart", desc: "Follow wizard" },
    { num: 3, label: "Create room", desc: "First chat room" },
    { num: 4, label: "Send message", desc: "Test realtime" },
    { num: 5, label: "Add agent", desc: "(Optional) AI" },
  ];

  return (
    <Slide slideNumber={slideNumber} totalSlides={totalSlides}>
      <h2
        className="text-3xl font-bold tracking-tight mb-6"
        style={{ color: colors.text, letterSpacing: "-0.02em" }}
      >
        Live demo flow
      </h2>

      <div className="flex-1 flex items-center">
        <div className="w-full flex items-center justify-between gap-2">
          {steps.map((step, i) => (
            <div key={step.num} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold"
                  style={{
                    backgroundColor: i === 0 ? colors.accent : colors.codeBackground,
                    color: i === 0 ? "white" : colors.text,
                    border: `2px solid ${i === 0 ? colors.accent : colors.border}`,
                  }}
                >
                  {step.num}
                </div>
                <div className="text-center">
                  <p className="font-semibold text-xs" style={{ color: colors.text }}>{step.label}</p>
                  <p className="text-[10px]" style={{ color: colors.textMuted }}>{step.desc}</p>
                </div>
              </div>
              {i < steps.length - 1 && (
                <span className="text-base" style={{ color: colors.border }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

// Slide 9: Tradeoffs
function TradeoffsSlide({ slideNumber, totalSlides }: { slideNumber: number; totalSlides: number }) {
  return (
    <Slide slideNumber={slideNumber} totalSlides={totalSlides}>
      <h2
        className="text-3xl font-bold tracking-tight mb-5"
        style={{ color: colors.text, letterSpacing: "-0.02em" }}
      >
        Honest tradeoffs
      </h2>

      <div
        className="flex-1 rounded-xl overflow-hidden"
        style={{ border: `1px solid ${colors.border}` }}
      >
        <table className="w-full text-xs">
          <thead>
            <tr style={{ backgroundColor: colors.codeBackground }}>
              <th className="p-3 text-left font-semibold" style={{ color: colors.text, borderBottom: `1px solid ${colors.border}` }}>
                Aspect
              </th>
              <th className="p-3 text-left font-semibold" style={{ color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>
                Stream / TalkJS
              </th>
              <th className="p-3 text-left font-semibold" style={{ color: colors.accent, borderBottom: `1px solid ${colors.border}` }}>
                Fluxychat
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ backgroundColor: "white" }}>
              <td className="p-3 font-medium" style={{ color: colors.text, borderBottom: `1px solid ${colors.border}` }}>Time to polished UI</td>
              <td className="p-3" style={{ color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>Minutes (pre-built)</td>
              <td className="p-3" style={{ color: colors.text, borderBottom: `1px solid ${colors.border}` }}>Hours (build yours)</td>
            </tr>
            <tr style={{ backgroundColor: colors.codeBackground }}>
              <td className="p-3 font-medium" style={{ color: colors.text, borderBottom: `1px solid ${colors.border}` }}>Infrastructure control</td>
              <td className="p-3" style={{ color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>Their servers</td>
              <td className="p-3" style={{ color: colors.accent, borderBottom: `1px solid ${colors.border}` }}>Your Worker</td>
            </tr>
            <tr style={{ backgroundColor: "white" }}>
              <td className="p-3 font-medium" style={{ color: colors.text, borderBottom: `1px solid ${colors.border}` }}>Customization</td>
              <td className="p-3" style={{ color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>Theme tokens</td>
              <td className="p-3" style={{ color: colors.accent, borderBottom: `1px solid ${colors.border}` }}>Full source code</td>
            </tr>
            <tr style={{ backgroundColor: colors.codeBackground }}>
              <td className="p-3 font-medium" style={{ color: colors.text, borderBottom: `1px solid ${colors.border}` }}>Pricing model</td>
              <td className="p-3" style={{ color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>Per MAU</td>
              <td className="p-3" style={{ color: colors.accent, borderBottom: `1px solid ${colors.border}` }}>CF usage-based</td>
            </tr>
            <tr style={{ backgroundColor: "white" }}>
              <td className="p-3 font-medium" style={{ color: colors.text }}>Maturity</td>
              <td className="p-3" style={{ color: colors.textMuted }}>Production-proven</td>
              <td className="p-3" style={{ color: colors.text }}>Beta</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p
        className="text-center mt-4 text-xs"
        style={{ color: colors.textMuted }}
      >
        Fluxychat is in open beta. Expect rough edges. We{"'"}re shipping fast.
      </p>
    </Slide>
  );
}

// Slide 10: CTA
function CTASlide({ slideNumber, totalSlides }: { slideNumber: number; totalSlides: number }) {
  return (
    <Slide slideNumber={slideNumber} totalSlides={totalSlides} className="justify-center items-center text-center">
      <FluxychatIcon size={48} />

      <h2
        className="text-3xl font-bold tracking-tight mt-5 mb-6"
        style={{ color: colors.text, letterSpacing: "-0.02em" }}
      >
        Get started
      </h2>

      <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-left text-sm mb-6">
        <div>
          <span className="font-medium" style={{ color: colors.text }}>Landing</span>
          <p className="font-mono text-xs" style={{ color: colors.accent }}>fluxychat.vercel.app/landing</p>
        </div>
        <div>
          <span className="font-medium" style={{ color: colors.text }}>Why Fluxychat</span>
          <p className="font-mono text-xs" style={{ color: colors.accent }}>fluxychat.vercel.app/why</p>
        </div>
        <div>
          <span className="font-medium" style={{ color: colors.text }}>GitHub</span>
          <p className="font-mono text-xs" style={{ color: colors.accent }}>github.com/fluxychat/fluxychat</p>
        </div>
        <div>
          <span className="font-medium" style={{ color: colors.text }}>npm</span>
          <p className="font-mono text-xs" style={{ color: colors.accent }}>npmjs.com/package/@fluxy-chat/sdk</p>
        </div>
      </div>

      <p className="font-mono text-sm" style={{ color: colors.textMuted }}>
        fluxychat@outlook.com
      </p>
    </Slide>
  );
}

const slideComponents = [
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
  const totalSlides = slideComponents.length;

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: 16in 9in;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
          }
          .slide-page {
            width: 16in !important;
            height: 9in !important;
            page-break-after: always;
            page-break-inside: avoid;
          }
          .print-button {
            display: none !important;
          }
        }
        @media screen {
          .slide-page {
            max-width: 1200px;
            margin: 0 auto 2rem auto;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
          }
        }
      `}</style>
      <div
        className="min-h-screen py-8 px-4"
        style={{ backgroundColor: "#e5e5e5" }}
      >
        <div className="max-w-5xl mx-auto mb-6 flex items-center justify-between print-button">
          <div>
            <h1 className="text-xl font-bold" style={{ color: colors.text }}>
              Fluxychat Slide Deck
            </h1>
            <p className="text-sm" style={{ color: colors.textMuted }}>
              {totalSlides} slides | 16:9 format
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            style={{
              backgroundColor: colors.accent,
              color: "white",
            }}
          >
            Export to PDF
          </button>
        </div>

        {slideComponents.map((SlideComponent, index) => (
          <SlideComponent
            key={index}
            slideNumber={index + 1}
            totalSlides={totalSlides}
          />
        ))}
      </div>
    </>
  );
}
