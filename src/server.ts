import { loadConfig } from "./config";
import { createApp } from "./app";

const config = loadConfig();
const { app, store, storeKind } = createApp(config);

const server = app.listen(config.port, () => {
  console.log(
    `log-anomaly-watcher listening on http://localhost:${config.port} ` +
      `(store=${storeKind}, window=${config.windowMinutes}m, ` +
      `baseline=${config.baselineHours}h, spike=${config.spikeMultiplier}x/min ${config.spikeMinCount})`,
  );
  if (storeKind === "memory") {
    console.log("Note: no DATABASE_URL set — using the in-memory dev store (data is lost on restart).");
  }
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down...`);
  server.close(() => {
    void store.close().finally(() => process.exit(0));
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
