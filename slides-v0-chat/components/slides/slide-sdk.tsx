"use client"

import { SlideLayout } from "./slide-layout"

export function SlideSDK() {
  return (
    <SlideLayout slideNumber={5} totalSlides={10}>
      <div className="space-y-10">
        {/* Headline */}
        <h2 className="text-5xl font-bold tracking-tight text-foreground">
          <span className="font-mono text-primary">useChat</span>
          <span className="text-muted-foreground font-normal">(roomId)</span>
        </h2>

        {/* Code block */}
        <div className="bg-foreground rounded-xl p-8 font-mono text-sm overflow-x-auto">
          <pre className="text-secondary">
            <code>
              <span className="text-primary/70">{"// Wrap your app"}</span>
              {"\n"}
              <span className="text-blue-400">{"<"}</span>
              <span className="text-green-400">FluxyRealtimeProvider</span>
              {"\n"}
              {"  "}
              <span className="text-purple-400">publicKey</span>
              <span className="text-secondary/60">=</span>
              <span className="text-amber-400">{'"pk_live_..."'}</span>
              {"\n"}
              {"  "}
              <span className="text-purple-400">userId</span>
              <span className="text-secondary/60">=</span>
              <span className="text-secondary/80">{"{user.id}"}</span>
              {"\n"}
              <span className="text-blue-400">{">"}</span>
              {"\n"}
              {"  "}
              <span className="text-blue-400">{"<"}</span>
              <span className="text-green-400">App</span>
              <span className="text-blue-400">{" />"}</span>
              {"\n"}
              <span className="text-blue-400">{"</"}</span>
              <span className="text-green-400">FluxyRealtimeProvider</span>
              <span className="text-blue-400">{">"}</span>
              {"\n\n"}
              <span className="text-primary/70">{"// In your component"}</span>
              {"\n"}
              <span className="text-purple-400">const</span>
              <span className="text-secondary">{" { messages, send, status } = "}</span>
              <span className="text-green-400">useChat</span>
              <span className="text-secondary">{"({ "}</span>
              <span className="text-purple-400">roomId</span>
              <span className="text-secondary">{" })"}</span>
            </code>
          </pre>
        </div>

        {/* npm badge */}
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 rounded-lg bg-secondary font-mono text-sm text-foreground">
            npm i @fluxy-chat/sdk
          </div>
          <span className="text-muted-foreground text-sm">
            TypeScript · React 18+ · ~8kb gzipped
          </span>
        </div>
      </div>
    </SlideLayout>
  )
}
