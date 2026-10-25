// Demo seed: posts logs that produce one spike anomaly and one
// new-signature anomaly. Run with the server already up:
//   npm run dev   (or npm start)
//   npm run demo
// Uses only the built-in fetch (Node 18+). No dependencies.
const BASE = process.env.BASE_URL || "http://localhost:3000";
const now = Date.now();
const iso = (minutesAgo) => new Date(now - minutesAgo * 60_000).toISOString();

async function post(logs) {
  const res = await fetch(`${BASE}/api/logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(logs),
  });
  if (!res.ok) throw new Error(`POST /api/logs failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const logs = [];
  // Baseline for the spike signature: 6 "Database timeout" events in the
  // previous hour, outside the last-10-minute window (15..55 min ago).
  for (let i = 0; i < 6; i++) {
    logs.push({ service: "api", level: "error", message: "Database timeout", timestamp: iso(15 + i * 8) });
  }
  // Spike: 12 more in the last 5 minutes. Baseline per window = 6/6 = 1,
  // so 12 >= 1*3 and >= 5 -> spike, ratio 12x.
  for (let i = 0; i < 12; i++) {
    logs.push({ service: "api", level: "error", message: "Database timeout", timestamp: iso(5) });
  }
  // New signature: never seen before, first seen now.
  for (let i = 0; i < 3; i++) {
    logs.push({ service: "api", level: "error", message: "Payment gateway rejected card", timestamp: iso(2) });
  }
  // Steady background traffic that should NOT flag.
  logs.push({ service: "api", level: "info", message: "Cache miss for key abc", timestamp: iso(3) });
  logs.push({ service: "api", level: "info", message: "Cache miss for key xyz", timestamp: iso(30) });

  const result = await post(logs);
  console.log(`Seeded ${result.accepted} logs.`);
  const anomalies = await (await fetch(`${BASE}/api/anomalies`)).json();
  console.log(JSON.stringify(anomalies, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
