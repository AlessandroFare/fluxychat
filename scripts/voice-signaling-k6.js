/**
 * Flagship signaling load — GET /voice-ai/providers (public catalog).
 * k6 run scripts/voice-signaling-k6.js -e WORKER_URL=https://your-worker.workers.dev
 */
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 50,
  duration: "60s",
  thresholds: {
    http_req_duration: ["p(95)<300", "p(99)<800"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const worker = __ENV.WORKER_URL || "http://127.0.0.1:8787";
  const providers = http.get(`${worker.replace(/\/$/, "")}/voice-ai/providers`);
  check(providers, {
    "providers 200": (r) => r.status === 200,
    "has openai-realtime": (r) => String(r.body).includes("openai-realtime"),
  });
  const health = http.get(`${worker.replace(/\/$/, "")}/health`);
  check(health, { "health 200": (r) => r.status === 200 });
  sleep(0.2);
}
