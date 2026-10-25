import request from "supertest";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { createApp } from "../src/app";
import { MemoryStore } from "../src/memoryStore";

function setup() {
  const config = { ...loadConfig(), windowMinutes: 10, baselineHours: 1, spikeMultiplier: 3, spikeMinCount: 5 };
  const { app } = createApp(config, new MemoryStore());
  return app;
}

describe("POST /api/logs validation", () => {
  it("rejects a missing message with 400", async () => {
    const app = setup();
    const res = await request(app).post("/api/logs").send({ service: "api", level: "error" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/message/);
  });

  it("rejects an unknown level with 400", async () => {
    const app = setup();
    const res = await request(app)
      .post("/api/logs")
      .send({ service: "api", level: "critical", message: "boom" });
    expect(res.status).toBe(400);
  });

  it("rejects a bad timestamp with 400", async () => {
    const app = setup();
    const res = await request(app)
      .post("/api/logs")
      .send({ service: "api", level: "error", message: "boom", timestamp: "not-a-date" });
    expect(res.status).toBe(400);
  });

  it("accepts a single log and a batch, and groups ids into one signature", async () => {
    const app = setup();
    const single = await request(app)
      .post("/api/logs")
      .send({ service: "api", level: "error", message: "Connection failed for user 12345" });
    expect(single.status).toBe(201);
    expect(single.body.accepted).toBe(1);

    const batch = await request(app)
      .post("/api/logs")
      .send([
        { service: "api", level: "error", message: "Connection failed for user 67890" },
        { service: "api", level: "error", message: "Connection failed for user 11111" },
      ]);
    expect(batch.status).toBe(201);
    expect(batch.body.accepted).toBe(2);

    const sigs = await request(app).get("/api/signatures");
    expect(sigs.body.signatures).toHaveLength(1);
    expect(sigs.body.signatures[0].count).toBe(3);
    expect(sigs.body.signatures[0].normalized).toBe("Connection failed for user <num>");
  });
});
