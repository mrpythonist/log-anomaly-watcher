import { createHash } from "crypto";

const UUID_RE =
  /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const HEX_RE = /\b0x[0-9a-fA-F]+\b/g;
const NUMBER_RE = /\b\d+(?:\.\d+)?\b/g;
// Quoted strings (IDs, emails, tokens) collapse, but keep the surrounding words.
const QUOTED_RE = /"[^"]*"|'[^']*'/g;
/**
 * Normalize a log message so the same failure with different ids, ips,
 * numbers or paths maps to one signature. Order matters: specific
 * patterns (uuid, ip, hex) are replaced before generic numbers.
 */
export function normalizeMessage(message: string): string {
  let out = message.trim().replace(/\s+/g, " ");
  out = out.replace(UUID_RE, "<uuid>");
  out = out.replace(IPV4_RE, "<ip>");
  out = out.replace(HEX_RE, "<hex>");
  out = out.replace(QUOTED_RE, "<str>");
  out = out.replace(NUMBER_RE, "<num>");
  // Path ids are already covered: numbers in a path become <num>, so
  // "/users/12345/orders" normalizes to "/users/<num>/orders".
  return out;
}

/** Fingerprint is scoped to a service: the same message in two services is distinct. */
export function fingerprint(service: string, message: string): { normalized: string; hash: string } {
  const normalized = normalizeMessage(message);
  const hash = createHash("sha256")
    .update(`${service}\n${normalized}`)
    .digest("hex")
    .slice(0, 16);
  return { normalized, hash };
}
