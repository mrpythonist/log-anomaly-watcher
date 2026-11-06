# API Reference

Base URL: `http://localhost:3000` by default (set `PORT` to change it). All responses are JSON. The JSON body limit for `POST /api/logs` is 1 MB.

There is no authentication on any endpoint. Do not expose this service on the public internet without adding auth in front of it.

## GET /api/health

Returns the service status and the store in use.

```bash
curl http://localhost:3000/api/health
```

Response (HTTP 200):

```json
{"ok":true,"store":"memory"}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `ok` | boolean | Always `true` when the service answers. |
| `store` | string | `postgres` when `DATABASE_URL` is set, otherwise `memory`. |

## POST /api/logs

Ingests one log, a JSON array of logs, or an object with a `logs` array. Returns `201` with the number of accepted logs.

```bash
curl -X POST http://localhost:3000/api/logs \
  -H 'Content-Type: application/json' \
  -d '{"service":"api","level":"error","message":"Database timeout for user 12345"}'
```

Response (HTTP 201):

```json
{"accepted":1}
```

Batch examples:

```bash
# JSON array
curl -X POST http://localhost:3000/api/logs \
  -H 'Content-Type: application/json' \
  -d '[{"service":"api","level":"error","message":"Database timeout"},{"service":"web","level":"warn","message":"Slow response"}]'

# Object with a logs array
curl -X POST http://localhost:3000/api/logs \
  -H 'Content-Type: application/json' \
  -d '{"logs":[{"service":"api","level":"error","message":"Database timeout"}]}'
```

### Request fields

| Field | Required | Rules |
| --- | --- | --- |
| `service` | yes | Non-empty string. Fingerprints are scoped per service. |
| `level` | yes | One of `debug`, `info`, `warn`, `error`, `fatal`. |
| `message` | yes | Non-empty string. |
| `timestamp` | no | Valid ISO date string. Defaults to now. |

### Errors

All errors return `400` with `{ "error": "..." }`. If any item in a batch is invalid, the whole batch is rejected and nothing is stored.

| Case | Response |
| --- | --- |
| Missing or empty `service` | `{"error":"service is required and must be a non-empty string"}` |
| Unknown `level` | `{"error":"level must be one of: debug, info, warn, error, fatal"}` |
| Missing or empty `message` | `{"error":"message is required and must be a non-empty string"}` |
| Invalid `timestamp` | `{"error":"timestamp must be a valid ISO date string"}` |
| Log item is not an object | `{"error":"each log must be an object"}` |
| Empty array or empty `logs` array | `{"error":"no logs provided"}` |

Example:

```bash
curl -X POST http://localhost:3000/api/logs \
  -H 'Content-Type: application/json' \
  -d '{"service":"api","level":"critical","message":"boom"}'
# {"error":"level must be one of: debug, info, warn, error, fatal"}
```

### Fingerprinting

Before storage, each message is normalised: UUIDs become `<uuid>`, IPv4 addresses become `<ip>`, hex values become `<hex>`, quoted strings become `<str>`, and numbers become `<num>`. Whitespace is collapsed. The fingerprint is the first 16 hex characters of SHA-256 over `service` plus a newline plus the normalised message.

Example: `Database timeout for user 12345` normalises to `Database timeout for user <num>` with fingerprint `087af866c0dd0230` for service `api`.

## GET /api/signatures

Returns signatures ordered by count, highest first.

```bash
curl http://localhost:3000/api/signatures
curl "http://localhost:3000/api/signatures?service=api"
```

Query parameters:

| Parameter | Meaning |
| --- | --- |
| `service` | Optional. Only return signatures for this service. |

Response (HTTP 200):

```json
{"signatures":[{"signature":"087af866c0dd0230","service":"api","normalized":"Database timeout for user <num>","count":1,"levels":{"error":1},"firstSeen":"2026-11-06T05:02:31.739Z","lastSeen":"2026-11-06T05:02:31.739Z"}]}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `signature` | string | 16-hex-character fingerprint. |
| `service` | string | Service the logs were sent with. |
| `normalized` | string | Normalised message. |
| `count` | number | Total events for this signature. |
| `levels` | object | Per-level counts, for example `{"error": 18}`. |
| `firstSeen` | string | ISO timestamp of the earliest event. |
| `lastSeen` | string | ISO timestamp of the latest event. |

## GET /api/anomalies

Returns the anomalies detected at read time, plus the window size and generation time.

```bash
curl http://localhost:3000/api/anomalies
curl "http://localhost:3000/api/anomalies?service=api&severity=critical"
```

Query parameters:

| Parameter | Meaning |
| --- | --- |
| `service` | Optional. Only return anomalies for this service. |
| `severity` | Optional. Only return anomalies with this severity (`medium`, `high`, or `critical`). |

Response (HTTP 200):

```json
{"anomalies":[{"type":"spike","signature":"342cb2ffe5ba4ad6","service":"api","normalized":"Database timeout","windowCount":12,"baselinePerWindow":1,"ratio":12,"severity":"critical","firstSeen":"2026-11-06T04:07:09.168Z","lastSeen":"2026-11-06T04:57:09.168Z","reason":"12 events in the last 10 minutes vs a baseline of 1.00 per window (ratio 12.0x, threshold 3x, minimum 5)."}],"windowMinutes":10,"generatedAt":"2026-11-06T05:02:10.031Z"}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `type` | string | `spike` or `new_signature`. |
| `signature` | string | 16-hex-character fingerprint. |
| `service` | string | Service the logs were sent with. |
| `normalized` | string | Normalised message. |
| `windowCount` | number | Events for this signature in the current window. |
| `baselinePerWindow` | number | Expected events per window, from the baseline average. |
| `ratio` | number or null | `windowCount / baselinePerWindow`. Null when the baseline is zero. |
| `severity` | string | `medium`, `high`, or `critical`. |
| `firstSeen` | string | ISO timestamp of the earliest event for this signature. |
| `lastSeen` | string | ISO timestamp of the latest event for this signature. |
| `reason` | string | Human-readable explanation of why the anomaly fired. |

Top-level fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `anomalies` | array | Anomalies sorted by window count, highest first. |
| `windowMinutes` | number | The current window size from configuration. |
| `generatedAt` | string | ISO timestamp of when the response was generated. |

### Detection rules

Defaults in parentheses. All values are configurable through environment variables (see the README).

- **Window:** the last `WINDOW_MINUTES` (10) minutes before now.
- **Baseline:** the `BASELINE_HOURS` (1) immediately before the window, expressed as an average per window.
- **New signature:** a signature first seen inside the current window and within the `NEW_SIGNATURE_LOOKBACK_HOURS` (24) lookback. Severity is always `medium`. Applies to every log level in this version.
- **Spike:** fires only when both conditions hold: window count is at least `SPIKE_MIN_COUNT` (5) and at least `baselinePerWindow * SPIKE_MULTIPLIER` (3). A zero baseline cannot fire a spike. Severity is `critical` when the ratio is 10 or more or the window count is 50 or more, `high` when the ratio is 5 or more, otherwise `medium`.
- A signature with baseline history is never reported as new, even if its first sighting falls inside a long lookback. The new-signature check runs first, so a genuinely new signature is never reported as a spike instead.

## GET /

The dashboard. A static HTML page that fetches `/api/anomalies` and `/api/signatures`, lists current anomalies with severity styling, and shows the top 20 signatures in a table. It refreshes on button click and every 30 seconds.

```bash
curl -i http://localhost:3000/
# HTTP/1.1 200 OK
# Content-Type: text/html; charset=UTF-8
```
