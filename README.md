# Log Anomaly Watcher

A backend service for small teams that can't justify a Sentry/Datadog budget
yet, but still want to know when something in their logs goes wrong:
**a known error suddenly spiking, or a brand-new error appearing for the
first time.**

Send it logs over HTTP. It groups them by error signature, then surfaces
anomalies with transparent rules you can read and tune — no black-box
model, no vendor lock-in.

## How it works

1. **Ingest** — `POST /api/logs` accepts a single log or a batch.
2. **Fingerprint** — each message is normalised (numbers, UUIDs, IPs, hex
   values and quoted strings are replaced with placeholders) and hashed,
   so `Connection failed for user 12345` and `Connection failed for user
   67890` become one signature. Fingerprints are scoped per service.
3. **Detect** — every read of `GET /api/anomalies` compares the last
   *window* (default 10 minutes) against a *baseline* (default the previous
   hour, expressed as an average per window):
   - **Spike:** window count ≥ minimum count **and** ≥ baseline ×
     multiplier (defaults: minimum 5, multiplier 3).
   - **New signature:** a signature first seen inside the current window
     (and within the lookback, default 24h). A signature with baseline
     history is not "new", even if its first sighting is inside a long
     lookback — otherwise its spike would be hidden by the new label.
4. **View** — a minimal dashboard at `/` lists current anomalies and the
   top signatures.

## Architecture

```
Client / app ──POST /api/logs──► Express (TypeScript)
                                     │
                        ┌────────────┴────────────┐
                        │                         │
                  MemoryStore              PostgresStore
               (dev / tests only)      (DATABASE_URL set;
                                    durable, default for
                                    docker-compose)
                                     │
                        ┌────────────┴────────────┐
                        │                         │
                 fingerprint.ts            detector.ts
              (normalise + hash)      (pure function:
                                       window vs baseline)
```

Detection is a pure function of stored events, so it is unit-tested
without a database. The store interface is the only seam between the
in-memory and Postgres implementations.

## Run it

### With Docker (recommended, Postgres included)

```bash
docker compose up --build
# Dashboard: http://localhost:3000
# Health:    curl http://localhost:3000/api/health
```

### Locally (in-memory dev store)

```bash
npm install
npm run dev
# Dashboard: http://localhost:3000
```

Without `DATABASE_URL` the service uses the in-memory store: data is lost
on restart and it is **not** suitable for production. Set `DATABASE_URL`
to use Postgres (the table is created automatically on first use).

### Demo

With the server running:

```bash
npm run demo
```

This seeds a baseline of 6 `Database timeout` events in the previous
hour, 12 more in the last 5 minutes (a spike), and a brand-new
`Payment gateway rejected card` signature, then prints the anomalies.

## API

### POST /api/logs

Single log or batch (array, or `{ "logs": [...] }`):

```bash
curl -X POST http://localhost:3000/api/logs \
  -H 'Content-Type: application/json' \
  -d '{"service":"api","level":"error","message":"Database timeout for user 12345"}'
# {"accepted":1}
```

Fields: `service` (non-empty string), `level` (`debug|info|warn|error|fatal`),
`message` (non-empty string), `timestamp` (optional ISO date, defaults to
now). Invalid payloads return `400` with an `error` message.

### GET /api/signatures

```bash
curl http://localhost:3000/api/signatures
curl "http://localhost:3000/api/signatures?service=api"
```

Returns signatures ordered by count, with level breakdown and first/last
seen timestamps.

### GET /api/anomalies

```bash
curl http://localhost:3000/api/anomalies
curl "http://localhost:3000/api/anomalies?service=api&severity=critical"
```

Each anomaly includes `type` (`spike` | `new_signature`), `severity`
(`medium` | `high` | `critical`), `windowCount`, `baselinePerWindow`,
`ratio`, `firstSeen`, `lastSeen`, and a human-readable `reason`.

### GET /api/health

Returns `{ "ok": true, "store": "postgres" | "memory" }`.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATABASE_URL` | *(unset)* | Postgres connection string; unset = in-memory dev store |
| `WINDOW_MINUTES` | `10` | Current window for spike detection |
| `BASELINE_HOURS` | `1` | Baseline period immediately before the window |
| `SPIKE_MULTIPLIER` | `3` | Spike threshold as a multiple of baseline per window |
| `SPIKE_MIN_COUNT` | `5` | Minimum window count for a spike |
| `NEW_SIGNATURE_LOOKBACK_HOURS` | `24` | First-seen window for new-signature detection |

See `.env.example`.

## Tests

```bash
npm test
```

Covers fingerprint normalisation, spike detection (including the minimum
count guard), new-signature detection, steady-traffic non-detection, and
API validation/grouping.

## Limitations — what this is NOT

- **Not a replacement for Sentry or Datadog.** No tracing, no alerting
  channels (email/Slack/webhooks), no log search, no retention policy,
  no multi-tenant auth. Those are deliberate omissions for a first
  version, not oversights to hide.
- **No ML/AI model.** Detection is transparent statistical rules
  (window count vs baseline average). Nothing is trained, inferred, or
  "intelligent" beyond those rules — the name refers to the problem
  (watching logs for anomalies), not to a model.
- **Single instance.** The in-memory store and the Postgres queries both
  assume one service instance; there is no sharding or distributed
  aggregation.
- **No authentication.** Do not expose this on the public internet
  without adding auth in front of it.
- **Clock dependence.** Detection uses log timestamps as supplied, so
  clients with badly skewed clocks will distort windows and baselines.

## Trade-offs

- **Rules over models:** a multiplier + minimum count is easy to explain
  to an on-call engineer and easy to tune, at the cost of missing slow
  drifts that a model might catch.
- **Baseline = previous hour:** simple and explainable, but a baseline
  that itself contains an incident will mask a spike. A longer or
  median-based baseline would be the next improvement.
- **First-seen = first seen by this service:** "new signature" means new
  to this deployment's store, not new to the world. After a store reset,
  old signatures will re-flag once — a known consequence of the
  in-memory store, and a reason to use Postgres for durable use.
- **Postgres via a store interface:** the query path reads events since
  the baseline start, which is fine at small-team scale and a bottleneck
  at high volume; pre-aggregated counters would be the scaling step.

## License

MIT — see [LICENSE](LICENSE).
