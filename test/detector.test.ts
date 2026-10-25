import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { detectAnomalies } from "../src/detector";
import { fingerprint } from "../src/fingerprint";
import type { LogEvent, SignatureStats } from "../src/types";

function makeEvent(
  service: string,
  message: string,
  minutesAgo: number,
  now: Date,
  level: LogEvent["level"] = "error",
): LogEvent {
  const { normalized, hash } = fingerprint(service, message);
  return {
    service,
    level,
    message,
    normalized,
    signature: hash,
    timestamp: new Date(now.getTime() - minutesAgo * 60_000),
  };
}

function statsFor(events: LogEvent[]): SignatureStats[] {
  const by = new Map<string, SignatureStats>();
  for (const e of events) {
    const cur = by.get(e.signature);
    if (!cur) {
      by.set(e.signature, {
        signature: e.signature,
        service: e.service,
        normalized: e.normalized,
        count: 1,
        levels: { [e.level]: 1 },
        firstSeen: e.timestamp,
        lastSeen: e.timestamp,
      });
    } else {
      cur.count += 1;
      cur.levels[e.level] = (cur.levels[e.level] ?? 0) + 1;
      if (e.timestamp < cur.firstSeen) cur.firstSeen = e.timestamp;
      if (e.timestamp > cur.lastSeen) cur.lastSeen = e.timestamp;
    }
  }
  return [...by.values()];
}

const config = { ...loadConfig(), windowMinutes: 10, baselineHours: 1, spikeMultiplier: 3, spikeMinCount: 5, newSignatureLookbackHours: 24 };

describe("detectAnomalies", () => {
  it("flags a spike when the window count beats baseline * multiplier and the minimum", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    const events: LogEvent[] = [];
    // Baseline: 6 events spread over the previous hour, outside the window.
    for (let i = 0; i < 6; i++) events.push(makeEvent("api", "Database timeout", 15 + i * 8, now));
    // Spike: 12 events in the last 5 minutes.
    for (let i = 0; i < 12; i++) events.push(makeEvent("api", "Database timeout", 5, now));
    const anomalies = detectAnomalies(events, statsFor(events), config, now);
    const spike = anomalies.find((a) => a.type === "spike");
    expect(spike).toBeDefined();
    expect(spike!.windowCount).toBe(12);
    expect(spike!.baselinePerWindow).toBe(1); // 6 baseline events / 6 windows per hour
    expect(spike!.ratio).toBe(12);
  });

  it("does not flag a spike below the minimum count", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    const events: LogEvent[] = [];
    events.push(makeEvent("api", "Database timeout", 30, now));
    for (let i = 0; i < 4; i++) events.push(makeEvent("api", "Database timeout", 2, now));
    const anomalies = detectAnomalies(events, statsFor(events), config, now);
    expect(anomalies.filter((a) => a.type === "spike")).toHaveLength(0);
  });

  it("flags a brand-new signature seen for the first time", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    const events: LogEvent[] = [];
    for (let i = 0; i < 3; i++) events.push(makeEvent("api", "Payment gateway rejected card", 2, now));
    const anomalies = detectAnomalies(events, statsFor(events), config, now);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].type).toBe("new_signature");
    expect(anomalies[0].normalized).toBe("Payment gateway rejected card");
  });

  it("does not flag steady traffic as an anomaly", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    const events: LogEvent[] = [];
    for (let i = 0; i < 6; i++) events.push(makeEvent("api", "Cache miss for key 1", 15 + i * 8, now));
    for (let i = 0; i < 2; i++) events.push(makeEvent("api", "Cache miss for key 2", 3, now));
    expect(detectAnomalies(events, statsFor(events), config, now)).toHaveLength(0);
  });
});
