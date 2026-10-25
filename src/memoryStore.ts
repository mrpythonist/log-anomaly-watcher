import type { LogEvent, SignatureStats, Store } from "./types";

/**
 * In-memory store. This is the dev/test store: it is fast, needs no
 * infrastructure, and loses data on restart. It is NOT the production
 * store — use PostgresStore (DATABASE_URL) for anything durable.
 */
export class MemoryStore implements Store {
  private events: LogEvent[] = [];

  async add(event: LogEvent): Promise<void> {
    this.events.push(event);
  }

  async addMany(events: LogEvent[]): Promise<void> {
    this.events.push(...events);
  }

  async eventsSince(since: Date): Promise<LogEvent[]> {
    return this.events.filter((e) => e.timestamp >= since);
  }

  async signatures(): Promise<SignatureStats[]> {
    const byKey = new Map<string, SignatureStats>();
    for (const e of this.events) {
      const existing = byKey.get(e.signature);
      if (!existing) {
        byKey.set(e.signature, {
          signature: e.signature,
          service: e.service,
          normalized: e.normalized,
          count: 1,
          levels: { [e.level]: 1 },
          firstSeen: e.timestamp,
          lastSeen: e.timestamp,
        });
      } else {
        existing.count += 1;
        existing.levels[e.level] = (existing.levels[e.level] ?? 0) + 1;
        if (e.timestamp < existing.firstSeen) existing.firstSeen = e.timestamp;
        if (e.timestamp > existing.lastSeen) existing.lastSeen = e.timestamp;
      }
    }
    return [...byKey.values()].sort((a, b) => b.count - a.count);
  }

  async close(): Promise<void> {
    this.events = [];
  }
}
