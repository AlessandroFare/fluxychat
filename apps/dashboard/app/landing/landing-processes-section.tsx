"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { docsSiteHref } from "@/lib/hosted-product";

const PROCESSES = [
  { id: "pto", label: "Time off", seed: "ops-pto", color: "#7dd3fc" },
  { id: "access", label: "Prod access", seed: "ops-iam", color: "#fcd34d" },
  { id: "invoice", label: "Supplier pay", seed: "ops-pay", color: "#86efac" },
  { id: "incident", label: "P1 comms", seed: "ops-p1", color: "#f9a8d4" },
] as const;

const STEPS = ["Describe", "Human approve", "Tool runs"] as const;

function botSvgUrl(seed: string, bg: string) {
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg.replace("#", "")}&size=80`;
}

export function LandingProcessesSection() {
  const [tick, setTick] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduce) return undefined;
    const id = window.setInterval(() => setTick((n) => n + 1), 1600);
    return () => window.clearInterval(id);
  }, [reduce]);

  const activeProcess = PROCESSES[tick % PROCESSES.length];
  const activeStep = tick % STEPS.length;
  const packetLane = tick % PROCESSES.length;
  const packetLeft = reduce ? 50 : 14 + activeStep * 34;

  return (
    <section id="processes" className="scroll-mt-20 border-b border-white/10 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 text-center">
          <p className="text-xs font-semibold uppercase text-[var(--mkt-brand-soft)]">Processes</p>
          <h2 className="text-balance font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Describe the work. A person still signs the write.
          </h2>
          <p className="mx-auto max-w-2xl text-pretty leading-relaxed text-slate-300">
            Console path is Processes. You talk in plain language. The builder drafts steps from tools your admin already
            enabled. Nothing that changes data runs until someone approves the hashed payload. The interpreter is generic.
            Invoice, PTO, and access reviews are definitions, not a special engine.
          </p>
        </div>

        <div className="relative mx-auto mt-12 max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 p-6 sm:p-8">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-stretch lg:justify-between">
            <ul className="flex w-full flex-col gap-3 lg:w-44">
              {PROCESSES.map((proc, index) => (
                <li key={proc.id}>
                  <div
                    className="flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors duration-500"
                    style={{
                      borderColor: packetLane === index ? proc.color : "rgba(255,255,255,0.1)",
                      background: packetLane === index ? `${proc.color}22` : "rgba(255,255,255,0.04)",
                      color: packetLane === index ? "#fff" : "#94a3b8",
                    }}
                  >
                    <img
                      src={botSvgUrl(proc.seed, proc.color)}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 rounded-lg bg-white/10"
                    />
                    {proc.label}
                  </div>
                </li>
              ))}
            </ul>

            <div className="relative flex min-h-44 flex-1 flex-col items-center justify-center">
              <div
                className="absolute inset-x-8 top-1/2 hidden h-px bg-gradient-to-r from-transparent via-white/20 to-transparent lg:block"
                aria-hidden
              />
              <span
                className="pointer-events-none absolute top-[calc(50%-6px)] z-10 hidden size-3 rounded-full shadow-[0_0_12px_currentColor] transition-[left] duration-1000 ease-in-out lg:block"
                style={{
                  left: `${packetLeft}%`,
                  background: activeProcess.color,
                  color: activeProcess.color,
                  opacity: reduce ? 0 : 1,
                }}
                aria-hidden
              />
              <div className="relative z-20 flex flex-col items-center gap-2">
                <img
                  src={botSvgUrl("fluxy-ops-runner", "1d4ed8")}
                  alt="Process runner"
                  width={88}
                  height={88}
                  className="size-20 rounded-2xl border border-white/15 bg-slate-900 sm:size-[5.5rem]"
                />
                <p className="text-xs font-medium text-slate-300">Runner in the room</p>
                <p className="max-w-[14rem] text-center text-xs text-slate-400">
                  {reduce
                    ? `${activeProcess.label}: ${STEPS.join(" → ")}`
                    : `${activeProcess.label} · ${STEPS[activeStep]}`}
                </p>
              </div>
            </div>

            <ol className="flex w-full flex-col gap-3 lg:w-48">
              {STEPS.map((step, index) => (
                <li
                  key={step}
                  className="rounded-xl border px-3 py-2 text-sm transition-colors duration-500"
                  style={{
                    borderColor: activeStep === index ? "rgba(96,165,250,0.6)" : "rgba(255,255,255,0.1)",
                    background: activeStep === index ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                    color: activeStep === index ? "#fff" : "#94a3b8",
                  }}
                >
                  {index + 1}. {step}
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            Bot faces come from DiceBear Bottts (same source as the stream demo avatars).
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/ops"
            className="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Open Processes
          </Link>
          <Link
            href={docsSiteHref("platform/processes")}
            className="inline-flex h-10 items-center rounded-md border border-white/20 px-4 text-sm font-semibold text-white hover:bg-white/10"
          >
            Docs
          </Link>
        </div>
      </div>
    </section>
  );
}
