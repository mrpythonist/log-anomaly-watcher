import { describe, expect, it } from "vitest";
import { fingerprint, normalizeMessage } from "../src/fingerprint";

describe("normalizeMessage", () => {
  it("groups the same failure with different user ids", () => {
    expect(normalizeMessage("Connection failed for user 12345")).toBe(
      normalizeMessage("Connection failed for user 67890"),
    );
    expect(normalizeMessage("Connection failed for user 12345")).toBe(
      "Connection failed for user <num>",
    );
  });

  it("normalizes uuids, ips, hex and paths", () => {
    expect(
      normalizeMessage("Request from 192.168.1.10 failed for /users/12345/orders"),
    ).toBe("Request from <ip> failed for /users/<num>/orders");
    expect(
      normalizeMessage("Trace 550e8400-e29b-41d4-a716-446655440000 at 0xdeadbeef"),
    ).toBe("Trace <uuid> at <hex>");
  });

  it("keeps different failures distinct", () => {
    expect(normalizeMessage("Database timeout")).not.toBe(
      normalizeMessage("Payment gateway rejected card"),
    );
  });
});

describe("fingerprint", () => {
  it("is stable for the same service and message, and scoped per service", () => {
    const a = fingerprint("api", "DB timeout for user 1");
    const b = fingerprint("api", "DB timeout for user 2");
    const c = fingerprint("worker", "DB timeout for user 1");
    expect(a.hash).toBe(b.hash);
    expect(a.hash).not.toBe(c.hash);
  });
});
