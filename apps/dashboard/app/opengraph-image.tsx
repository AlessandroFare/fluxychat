import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FluxyChat: realtime chat and AI on Cloudflare";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background: "linear-gradient(135deg, #0f0f0f 0%, #1a1208 50%, #0f0f0f 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 40 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              background: "#FF6A1A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 52,
              fontWeight: 800,
            }}
          >
            F
          </div>
          <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: "-0.03em" }}>fluxychat</span>
        </div>
        <p
          style={{
            fontSize: 36,
            lineHeight: 1.35,
            maxWidth: 920,
            color: "#e8e8e8",
            margin: 0,
          }}
        >
          Ship in-app chat, AI agents, stream, collab, and IoT on one Cloudflare Worker.
        </p>
      </div>
    ),
    { ...size },
  );
}
