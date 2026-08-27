"use client";

import { useState } from "react";
import { SpotlightCard } from "~/components/marketing/spotlight-card";
import { cn } from "@/lib/utils";

type BuildExample = {
  id: string;
  title: string;
  time: string;
  command: string;
  snippet: string;
  preview: "cursors" | "war" | "iot" | "deal";
};

const EXAMPLES: BuildExample[] = [
  {
    id: "cursors",
    title: "Live cursors",
    time: "about 10 minutes",
    command: "npx @fluxy-chat/create-fluxy-chat@latest my-cursors --example live-cursors",
    snippet: `const { liveCursors, sendCursor } = useChat({ roomId });

function onMove(e: PointerEvent) {
  sendCursor({ x: e.clientX, y: e.clientY, color: "#ff6a1a" });
}`,
    preview: "cursors",
  },
  {
    id: "war",
    title: "Agent war room",
    time: "an afternoon",
    command: "npx @fluxy-chat/create-fluxy-chat@latest my-war --example war-room",
    snippet: `const { messages, invokeAgent } = useChat({ roomId });

await invokeAgent(agentId, "Summarize the last 20 messages");`,
    preview: "war",
  },
  {
    id: "iot",
    title: "Device panel",
    time: "an afternoon",
    command: "npx @fluxy-chat/create-fluxy-chat@latest my-iot --example iot-panel",
    snippet: `await fetch(\`\${worker}/iot/devices/\${id}/readings\`, {
  method: "POST",
  headers: { Authorization: \`Bearer \${jwt}\` },
  body: JSON.stringify({ sensor: "temp", value: 21.4, unit: "C" }),
});`,
    preview: "iot",
  },
  {
    id: "deal",
    title: "Deal room",
    time: "a day",
    command: "npx @fluxy-chat/create-fluxy-chat@latest my-deal --example deal-room",
    snippet: `await client.createDecision(roomId, { title: "Ship Friday?" });
await client.ackDecision(roomId, decisionId);
const md = await client.exportRoomMarkdown(roomId);`,
    preview: "deal",
  },
];

function Preview({ kind }: { kind: BuildExample["preview"] }) {
  if (kind === "cursors") {
    return (
      <div className="relative h-44 overflow-hidden rounded-xl bg-zinc-950">
        <div className="absolute left-[18%] top-[28%] flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-[#ff6a1a]" />
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-200">you</span>
        </div>
        <div className="absolute left-[58%] top-[52%] flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-sky-400" />
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-200">sam</span>
        </div>
        <p className="absolute bottom-3 left-3 text-[11px] text-zinc-500">Two pointers on one room</p>
      </div>
    );
  }
  if (kind === "war") {
    return (
      <div className="flex h-44 flex-col gap-2 rounded-xl bg-zinc-950 p-3 text-left text-[11px]">
        <div className="self-start rounded-lg bg-zinc-800 px-2 py-1 text-zinc-200">alice: Check the logs</div>
        <div className="self-start rounded-lg bg-orange-500/20 px-2 py-1 text-orange-100">@ops summarizing…</div>
        <div className="self-end rounded-lg bg-zinc-100 px-2 py-1 text-zinc-900">3 errors in the last hour</div>
      </div>
    );
  }
  if (kind === "iot") {
    return (
      <div className="grid h-44 grid-cols-2 gap-2 rounded-xl bg-zinc-950 p-3">
        {["21.4 C", "ok", "0.12", "health 92"].map((label) => (
          <div key={label} className="flex items-center justify-center rounded-lg bg-zinc-900 font-mono text-xs text-zinc-200">
            {label}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-44 flex-col justify-between rounded-xl bg-zinc-950 p-3 text-left text-[11px] text-zinc-200">
      <p className="font-medium">Ship Friday?</p>
      <p className="text-zinc-500">2 of 2 acked</p>
      <button type="button" className="rounded-md bg-[#ff6a1a] px-2 py-1 text-white">
        Export markdown
      </button>
    </div>
  );
}

export function LandingBuildGallery() {
  const [activeId, setActiveId] = useState(EXAMPLES[0].id);
  const [tab, setTab] = useState<"ui" | "code">("ui");
  const active = EXAMPLES.find((e) => e.id === activeId) ?? EXAMPLES[0];

  return (
    <section
      id="build-gallery"
      className="scroll-mt-20 border-b border-white/10 px-4 py-20 sm:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-balance text-center font-heading text-3xl font-bold tracking-tight text-white">
          Click the product, then the code
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-center text-zinc-300">
          These are real gallery apps. Times are for someone who already has a Worker URL
          and a room. Hosted setup is longer the first time because of sign-in.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-4">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => {
                setActiveId(ex.id);
                setTab("ui");
              }}
              className={cn(
                "rounded-xl border px-3 py-3 text-left text-sm transition",
                activeId === ex.id
                  ? "border-[#ff6a1a]/60 bg-white/10 text-white"
                  : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/8",
              )}
            >
              <span className="block font-medium">{ex.title}</span>
              <span className="mt-1 block text-xs text-zinc-400">{ex.time}</span>
            </button>
          ))}
        </div>

        <SpotlightCard className="mt-6 border-white/10 bg-zinc-950/80" spotlightColor="rgba(255, 106, 26, 0.22)">
          <div className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTab("ui")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  tab === "ui" ? "bg-white text-zinc-950" : "bg-white/10 text-zinc-300",
                )}
              >
                Product
              </button>
              <button
                type="button"
                onClick={() => setTab("code")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  tab === "code" ? "bg-white text-zinc-950" : "bg-white/10 text-zinc-300",
                )}
              >
                Code
              </button>
              <code className="ml-auto hidden max-w-full truncate font-mono text-[10px] text-zinc-500 sm:inline">
                {active.command}
              </code>
            </div>
            {tab === "ui" ? (
              <Preview kind={active.preview} />
            ) : (
              <pre className="overflow-x-auto rounded-xl bg-zinc-900 p-4 font-mono text-xs leading-relaxed text-zinc-200">
                {active.snippet}
              </pre>
            )}
            <p className="mt-3 font-mono text-[10px] text-zinc-500 sm:hidden">{active.command}</p>
          </div>
        </SpotlightCard>
      </div>
    </section>
  );
}
