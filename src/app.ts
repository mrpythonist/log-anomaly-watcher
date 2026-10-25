import express, { type Request, type Response } from "express";
import path from "path";
import type { Config } from "./config";
import { detectAnomalies } from "./detector";
import { fingerprint } from "./fingerprint";
import { MemoryStore } from "./memoryStore";
import { PostgresStore } from "./postgresStore";
import { LOG_LEVELS, type LogEvent, type LogLevel, type Store } from "./types";

export interface AppContext {
  app: express.Express;
  store: Store;
  storeKind: "postgres" | "memory";
  config: Config;
}

interface RawLog {
  service?: unknown;
  level?: unknown;
  message?: unknown;
  timestamp?: unknown;
}

function parseLog(raw: unknown): { event?: LogEvent; error?: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { error: "each log must be an object" };
  }
  const r = raw as RawLog;
  if (typeof r.service !== "string" || r.service.trim() === "") {
    return { error: "service is required and must be a non-empty string" };
  }
  if (typeof r.level !== "string" || !(LOG_LEVELS as string[]).includes(r.level)) {
    return { error: `level must be one of: ${LOG_LEVELS.join(", ")}` };
  }
  if (typeof r.message !== "string" || r.message.trim() === "") {
    return { error: "message is required and must be a non-empty string" };
  }
  let timestamp = new Date();
  if (r.timestamp !== undefined) {
    const parsed = new Date(r.timestamp as string);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "timestamp must be a valid ISO date string" };
    }
    timestamp = parsed;
  }
  const { normalized, hash } = fingerprint(r.service, r.message);
  return {
    event: {
      service: r.service,
      level: r.level as LogLevel,
      message: r.message,
      normalized,
      signature: hash,
      timestamp,
    },
  };
}

export function createApp(config: Config, storeOverride?: Store): AppContext {
  const store: Store = storeOverride
    ? storeOverride
    : config.databaseUrl
      ? new PostgresStore(config.databaseUrl)
      : new MemoryStore();
  const storeKind: AppContext["storeKind"] = storeOverride
    ? "memory"
    : config.databaseUrl
      ? "postgres"
      : "memory";

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, store: storeKind });
  });

  app.post("/api/logs", async (req: Request, res: Response) => {
    const body = req.body;
    const items: unknown[] = Array.isArray(body)
      ? body
      : Array.isArray((body as { logs?: unknown[] } | null)?.logs)
        ? ((body as { logs: unknown[] }).logs as unknown[])
        : [body];
    if (items.length === 0) {
      res.status(400).json({ error: "no logs provided" });
      return;
    }
    const events: LogEvent[] = [];
    for (const item of items) {
      const { event, error } = parseLog(item);
      if (error || !event) {
        res.status(400).json({ error });
        return;
      }
      events.push(event);
    }
    await store.addMany(events);
    res.status(201).json({ accepted: events.length });
  });

  app.get("/api/signatures", async (req: Request, res: Response) => {
    const service = typeof req.query.service === "string" ? req.query.service : undefined;
    const all = await store.signatures();
    const filtered = service ? all.filter((s) => s.service === service) : all;
    res.json({
      signatures: filtered.map((s) => ({
        ...s,
        firstSeen: s.firstSeen.toISOString(),
        lastSeen: s.lastSeen.toISOString(),
      })),
    });
  });

  app.get("/api/anomalies", async (req: Request, res: Response) => {
    const service = typeof req.query.service === "string" ? req.query.service : undefined;
    const severity = typeof req.query.severity === "string" ? req.query.severity : undefined;
    const now = new Date();
    const baselineStart = new Date(
      now.getTime() -
        (config.windowMinutes + config.baselineHours * 60) * 60_000,
    );
    const events = await store.eventsSince(baselineStart);
    const signatures = await store.signatures();
    let anomalies = detectAnomalies(events, signatures, config, now);
    if (service) anomalies = anomalies.filter((a) => a.service === service);
    if (severity) anomalies = anomalies.filter((a) => a.severity === severity);
    res.json({ anomalies, windowMinutes: config.windowMinutes, generatedAt: now.toISOString() });
  });

  return { app, store, storeKind, config };
}
