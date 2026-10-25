import { Pool } from "pg";
import type { LogEvent, SignatureStats, Store } from "./types";

/**
 * Postgres store — the documented default for durable use.
 * Table is created on first use. Schema:
 *   logs(service text, level text, message text, normalized text,
 *        signature text, ts timestamptz)
 */
export class PostgresStore implements Store {
  private pool: Pool;
  private ready: Promise<void>;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
    this.ready = this.pool
      .query(
        `CREATE TABLE IF NOT EXISTS logs (
           id BIGSERIAL PRIMARY KEY,
           service TEXT NOT NULL,
           level TEXT NOT NULL,
           message TEXT NOT NULL,
           normalized TEXT NOT NULL,
           signature TEXT NOT NULL,
           ts TIMESTAMPTZ NOT NULL
         );
         CREATE INDEX IF NOT EXISTS logs_signature_ts ON logs (signature, ts);
         CREATE INDEX IF NOT EXISTS logs_ts ON logs (ts);`,
      )
      .then(() => undefined);
  }

  private async insert(events: LogEvent[]): Promise<void> {
    await this.ready;
    if (events.length === 0) return;
    const values: unknown[] = [];
    const rows = events
      .map((e, i) => {
        const base = i * 6;
        values.push(e.service, e.level, e.message, e.normalized, e.signature, e.timestamp);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
      })
      .join(", ");
    await this.pool.query(
      `INSERT INTO logs (service, level, message, normalized, signature, ts) VALUES ${rows}`,
      values,
    );
  }

  async add(event: LogEvent): Promise<void> {
    await this.insert([event]);
  }

  async addMany(events: LogEvent[]): Promise<void> {
    await this.insert(events);
  }

  async eventsSince(since: Date): Promise<LogEvent[]> {
    await this.ready;
    const res = await this.pool.query(
      `SELECT service, level, message, normalized, signature, ts
         FROM logs WHERE ts >= $1 ORDER BY ts ASC`,
      [since],
    );
    return res.rows.map((r) => ({
      service: r.service,
      level: r.level,
      message: r.message,
      normalized: r.normalized,
      signature: r.signature,
      timestamp: new Date(r.ts),
    }));
  }

  async signatures(): Promise<SignatureStats[]> {
    await this.ready;
    const res = await this.pool.query(
      `SELECT signature, service, normalized,
              COUNT(*)::int AS count,
              MIN(ts) AS first_seen, MAX(ts) AS last_seen
         FROM logs
        GROUP BY signature, service, normalized
        ORDER BY count DESC`,
    );
    const levelRes = await this.pool.query(
      `SELECT signature, level, COUNT(*)::int AS n FROM logs GROUP BY signature, level`,
    );
    const levelsBySig = new Map<string, Record<string, number>>();
    for (const r of levelRes.rows) {
      const cur = levelsBySig.get(r.signature) ?? {};
      cur[r.level] = r.n;
      levelsBySig.set(r.signature, cur);
    }
    return res.rows.map((r) => ({
      signature: r.signature,
      service: r.service,
      normalized: r.normalized,
      count: r.count,
      levels: levelsBySig.get(r.signature) ?? {},
      firstSeen: new Date(r.first_seen),
      lastSeen: new Date(r.last_seen),
    }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
