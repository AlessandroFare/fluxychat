"use client"

import { SlideLayout } from "./slide-layout"

export function SlideTradeoffs() {
  return (
    <SlideLayout slideNumber={9} totalSlides={10}>
      <div className="space-y-10">
        {/* Headline */}
        <h2 className="text-5xl font-bold tracking-tight text-foreground">
          Honest tradeoffs
        </h2>

        {/* Comparison table */}
        <div className="rounded-xl border border-border overflow-hidden mt-8">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary">
                <th className="px-6 py-4 text-lg font-bold text-foreground">
                  Aspect
                </th>
                <th className="px-6 py-4 text-lg font-bold text-muted-foreground">
                  Stream / TalkJS
                </th>
                <th className="px-6 py-4 text-lg font-bold text-primary">
                  Fluxychat
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-6 py-4 text-foreground font-medium">
                  Time to polished UI
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-green-600">●</span> Minutes (pre-built)
                  </span>
                </td>
                <td className="px-6 py-4 text-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-amber-500">●</span> Hours (BYO UI)
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-foreground font-medium">
                  Control over Worker
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-red-500">●</span> None
                  </span>
                </td>
                <td className="px-6 py-4 text-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-green-600">●</span> Full (MIT code)
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-foreground font-medium">
                  Self-host option
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-red-500">●</span> No
                  </span>
                </td>
                <td className="px-6 py-4 text-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-green-600">●</span> Yes
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-foreground font-medium">
                  Enterprise SLA
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-green-600">●</span> Yes
                  </span>
                </td>
                <td className="px-6 py-4 text-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-amber-500">●</span> Open beta
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-foreground font-medium">
                  Platform lock-in
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-red-500">●</span> Vendor stack
                  </span>
                </td>
                <td className="px-6 py-4 text-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-amber-500">●</span> CF-native (MIT source)
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Beta disclaimer */}
        <p className="text-center text-muted-foreground">
          ⚠️ Fluxychat is in <span className="font-medium text-foreground">open beta</span>. 
          Expect rough edges, but we ship fixes fast.
        </p>
      </div>
    </SlideLayout>
  )
}
