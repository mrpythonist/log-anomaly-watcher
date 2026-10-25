import type { Config } from "./config";
import type { LogEvent, SignatureStats } from "./types";

export type AnomalyType = "spike" | "new_signature";

export interface Anomaly {
  type: AnomalyType;
  signature: string;
  service: string;
  normalized: string;
  /** Events in the current window. */
  windowCount: number;
  /** Expected events per window, from the baseline period. */
  baselinePerWindow: number;
  /** windowCount / baselinePerWindow; null when the baseline is zero. */
  ratio: number | null;
  severity: "medium" | "high" | "critical";
  firstSeen: string;
  lastSeen: string;
  /** Human-readable explanation of why this fired. */
  reason: string;
}

function severityForSpike(ratio: number | null, windowCount: number): Anomaly["severity"] {
  if (ratio !== null && ratio >= 10) return "critical";
  if (windowCount >= 50) return "critical";
  if (ratio !== null && ratio >= 5) return "high";
  return "medium";
}

/**
 * Pure detection logic — no I/O, so it is unit-testable without a store.
 *
 * Window: the last `windowMinutes` before `now`.
 * Baseline: the `baselineHours` immediately before the window, expressed
 * as an average per window. A spike fires only when BOTH conditions hold:
 *   windowCount >= spikeMinCount AND windowCount >= baselinePerWindow * multiplier
 * A zero baseline does not by itself fire a spike (that case is covered by
 * new-signature detection when the signature is genuinely new).
 */
export function detectAnomalies(
  events: LogEvent[],
  signatures: SignatureStats[],
  config: Config,
  now: Date = new Date(),
): Anomaly[] {
  const windowStart = new Date(now.getTime() - config.windowMinutes * 60_000);
  const baselineStart = new Date(
    windowStart.getTime() - config.baselineHours * 3_600_000,
  );
  const windowsInBaseline = (config.baselineHours * 60) / config.windowMinutes;
  const newCutoff = new Date(
    now.getTime() - config.newSignatureLookbackHours * 3_600_000,
  );

  const windowCounts = new Map<string, number>();
  const baselineCounts = new Map<string, number>();
  for (const e of events) {
    if (e.timestamp >= windowStart) {
      windowCounts.set(e.signature, (windowCounts.get(e.signature) ?? 0) + 1);
    } else if (e.timestamp >= baselineStart) {
      baselineCounts.set(e.signature, (baselineCounts.get(e.signature) ?? 0) + 1);
    }
  }

  const bySignature = new Map(signatures.map((s) => [s.signature, s]));
  const anomalies: Anomaly[] = [];

  for (const [signature, windowCount] of windowCounts) {
    const meta = bySignature.get(signature);
    if (!meta) continue;
    const baselinePerWindow =
      (baselineCounts.get(signature) ?? 0) / windowsInBaseline;
    const ratio =
      baselinePerWindow > 0 ? windowCount / baselinePerWindow : null;

    // "New" means first seen inside the current window (and within the
    // lookback). A signature with baseline history is NOT new, even if
    // its first sighting falls inside a long lookback — otherwise every
    // spike signature would be misclassified as new and its spike hidden.
    if (meta.firstSeen >= windowStart && meta.firstSeen >= newCutoff) {
      anomalies.push({
        type: "new_signature",
        signature,
        service: meta.service,
        normalized: meta.normalized,
        windowCount,
        baselinePerWindow,
        ratio,
        severity: "medium",
        firstSeen: meta.firstSeen.toISOString(),
        lastSeen: meta.lastSeen.toISOString(),
        reason: `First seen ${meta.firstSeen.toISOString()} (within the ${config.newSignatureLookbackHours}h lookback) with ${windowCount} event(s) in the last ${config.windowMinutes} minutes.`,
      });
      continue;
    }

    if (
      windowCount >= config.spikeMinCount &&
      baselinePerWindow > 0 &&
      windowCount >= baselinePerWindow * config.spikeMultiplier
    ) {
      anomalies.push({
        type: "spike",
        signature,
        service: meta.service,
        normalized: meta.normalized,
        windowCount,
        baselinePerWindow,
        ratio,
        severity: severityForSpike(ratio, windowCount),
        firstSeen: meta.firstSeen.toISOString(),
        lastSeen: meta.lastSeen.toISOString(),
        reason: `${windowCount} events in the last ${config.windowMinutes} minutes vs a baseline of ${baselinePerWindow.toFixed(2)} per window (ratio ${ratio!.toFixed(1)}x, threshold ${config.spikeMultiplier}x, minimum ${config.spikeMinCount}).`,
      });
    }
  }

  return anomalies.sort((a, b) => b.windowCount - a.windowCount);
}
