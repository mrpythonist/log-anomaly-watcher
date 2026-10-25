export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error", "fatal"];

export interface LogEvent {
  service: string;
  level: LogLevel;
  message: string;
  /** Normalised message, e.g. "Connection failed for user <num>". */
  normalized: string;
  /** 16-hex-char fingerprint of service + normalized message. */
  signature: string;
  timestamp: Date;
}

export interface SignatureStats {
  signature: string;
  service: string;
  normalized: string;
  count: number;
  levels: Record<string, number>;
  firstSeen: Date;
  lastSeen: Date;
}

export interface Store {
  add(event: LogEvent): Promise<void>;
  addMany(events: LogEvent[]): Promise<void>;
  /** All events at or after `since`. Used by the detector. */
  eventsSince(since: Date): Promise<LogEvent[]>;
  signatures(): Promise<SignatureStats[]>;
  close(): Promise<void>;
}
