export interface Config {
  port: number;
  databaseUrl: string | undefined;
  /** Sliding window, in minutes, used for the current count. */
  windowMinutes: number;
  /** Baseline period, in hours, immediately before the window. */
  baselineHours: number;
  /** Spike when window count >= baselinePerWindow * multiplier. */
  spikeMultiplier: number;
  /** Spike also requires at least this many events in the window. */
  spikeMinCount: number;
  /** A signature first seen in the current window (and within this many hours) is "new". */
  newSignatureLookbackHours: number;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): Config {
  return {
    port: num("PORT", 3000),
    databaseUrl: process.env.DATABASE_URL || undefined,
    windowMinutes: num("WINDOW_MINUTES", 10),
    baselineHours: num("BASELINE_HOURS", 1),
    spikeMultiplier: num("SPIKE_MULTIPLIER", 3),
    spikeMinCount: num("SPIKE_MIN_COUNT", 5),
    newSignatureLookbackHours: num("NEW_SIGNATURE_LOOKBACK_HOURS", 24),
  };
}
