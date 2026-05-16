#!/usr/bin/env node
// Latency benchmark for Fluxychat production worker
// Usage: WORKER_URL=https://api.fluxychat.com TEST_JWT=eyJ... node scripts/benchmark.js
//   --local  : target http://127.0.0.1:8787
//   BENCH_ROOM_ID=<roomId>  : room to post messages to (default: benchmark-room)

const WORKER_URL = process.env.WORKER_URL || "https://api.fluxychat.com";
const TEST_JWT = process.env.TEST_JWT;
const ROOM_ID = process.env.BENCH_ROOM_ID || "benchmark-room";

if (!TEST_JWT) {
  console.error("ERROR: TEST_JWT environment variable not set.");
  console.error("Set it with:  export TEST_JWT=eyJ...");
  process.exit(1);
}

const SEQUENTIAL_RUNS = 20;
const CONCURRENT_RUNS = 10;

// Thresholds: exit 1 if p95 or p99 is missed
const THRESHOLDS = {
  p50: 100,   // ms
  p95: 200,   // ms  ← miss triggers exit 1
  p99: 500,   // ms  ← miss triggers exit 1
};

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function analyze(label, times) {
  const sorted = [...times].sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const checks = {};
  let criticalMiss = false;

  console.log(`\n${label}`);
  console.log(`  min=${min.toFixed(1)}ms  avg=${avg.toFixed(1)}ms  p50=${p50.toFixed(1)}ms  p95=${p95.toFixed(1)}ms  p99=${p99.toFixed(1)}ms  max=${max.toFixed(1)}ms`);

  for (const [key, limit] of Object.entries(THRESHOLDS)) {
    const val = key === "p50" ? p50 : key === "p95" ? p95 : p99;
    const ok = val < limit;
    const mark = ok ? "PASS" : "FAIL";
    console.log(`  ${key} < ${limit}ms  =>  ${val.toFixed(1)}ms  [${mark}]`);
    checks[key] = { val, limit, ok };
    if (!ok && (key === "p95" || key === "p99")) criticalMiss = true;
  }

  return { p50, p95, p99, avg, min, max, checks, criticalMiss };
}

async function postMessage(jwt, content) {
  const start = Date.now();
  const res = await fetch(`${WORKER_URL}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ roomId: ROOM_ID, content }),
  });
  const elapsed = Date.now() - start;
  return { status: res.status, elapsed };
}

async function sequential() {
  const times = [];
  for (let i = 0; i < SEQUENTIAL_RUNS; i++) {
    const { elapsed } = await postMessage(TEST_JWT, `bench seq ${Date.now()} ${i}`);
    times.push(elapsed);
    process.stdout.write(".");
  }
  console.log("");
  return times;
}

async function concurrent() {
  const promises = [];
  for (let i = 0; i < CONCURRENT_RUNS; i++) {
    promises.push(postMessage(TEST_JWT, `bench conc ${Date.now()} ${i}`));
    process.stdout.write(".");
  }
  const results = await Promise.all(promises);
  console.log("");
  return results.map((r) => r.elapsed);
}

async function main() {
  console.log(`Target: ${WORKER_URL}`);
  console.log(`Room: ${ROOM_ID}`);
  console.log(`Sequential runs: ${SEQUENTIAL_RUNS}  |  Concurrent runs: ${CONCURRENT_RUNS}`);

  console.log(`\nRunning ${SEQUENTIAL_RUNS} sequential requests...`);
  const seqTimes = await sequential();
  const seq = analyze(`Sequential (n=${SEQUENTIAL_RUNS})`, seqTimes);

  console.log(`\nRunning ${CONCURRENT_RUNS} concurrent requests...`);
  const concTimes = await concurrent();
  const conc = analyze(`Concurrent (n=${CONCURRENT_RUNS})`, concTimes);

  console.log("\n══════════════════════════════════════════");
  console.log("  RESULTS SUMMARY");
  console.log("══════════════════════════════════════════");

  let anyCritical = false;
  for (const [key, limit] of Object.entries(THRESHOLDS)) {
    const seqOk = seq.checks[key].ok;
    const concOk = conc.checks[key].ok;
    const overallOk = seqOk && concOk;
    if (!overallOk && (key === "p95" || key === "p99")) anyCritical = true;
    const seqVal = seq.checks[key].val.toFixed(1);
    const concVal = conc.checks[key].val.toFixed(1);
    const seqMark = seqOk ? "PASS" : "FAIL";
    const concMark = concOk ? "PASS" : "FAIL";
    const critical = key === "p95" || key === "p99" ? "  ← exit-1 on FAIL" : "";
    console.log(`  ${key} < ${limit}ms:`);
    console.log(`    sequential: ${seqVal}ms  [${seqMark}]`);
    console.log(`    concurrent: ${concVal}ms  [${concMark}]${critical}`);
  }

  console.log("");
  if (anyCritical) {
    console.log("FAILED — p95 or p99 threshold missed. See output above.");
    process.exit(1);
  } else {
    console.log("All thresholds PASSED.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});