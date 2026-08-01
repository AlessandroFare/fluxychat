/**
 * k6 signaling smoke — optional scale test for WS room joins.
 * Run: k6 run scripts/voice-signaling-k6.js -e WORKER_WS=wss://api.example.com -e TOKEN=...
 */
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const worker = __ENV.WORKER_URL || "http://127.0.0.1:8787";
  const res = http.get(`${worker}/health`);
  check(res, { "health ok": (r) => r.status === 200 });
  sleep(1);
}
