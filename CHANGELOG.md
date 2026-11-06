# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

No unreleased changes yet.

## [0.1.0] - 2026-10-25

Initial public release.

### Added

- HTTP log ingestion: `POST /api/logs` accepts a single log, a JSON array, or `{ "logs": [...] }`. Returns `201` with `{ "accepted": n }`.
- Log fingerprinting: messages are normalised (UUIDs, IPv4 addresses, hex values, quoted strings, and numbers become placeholders) and hashed with SHA-256, scoped per service.
- Spike detection: the last 10 minutes are compared against the previous hour, expressed as an average per window. A spike fires when the window count is at least 5 and at least 3 times the baseline average.
- New-signature detection: a signature first seen inside the current window (within a 24-hour lookback) is flagged as new. Applies to every log level.
- `GET /api/anomalies` with `service` and `severity` filters, returning type, severity, window count, baseline per window, ratio, first/last seen, and a human-readable reason.
- `GET /api/signatures` with a `service` filter, returning count, per-level breakdown, and first/last seen timestamps.
- `GET /api/health` returning the store in use (`postgres` or `memory`).
- Minimal dashboard at `/`: current anomalies and the top 20 signatures, with a Refresh button and 30-second auto-refresh.
- Two stores behind one interface: `MemoryStore` (development and tests) and `PostgresStore` (durable; creates the `logs` table and indexes on first use).
- Configuration through environment variables: `PORT`, `DATABASE_URL`, `WINDOW_MINUTES`, `BASELINE_HOURS`, `SPIKE_MULTIPLIER`, `SPIKE_MIN_COUNT`, `NEW_SIGNATURE_LOOKBACK_HOURS`.
- Demo seed script (`scripts/seed-demo.js`) that posts a baseline, a spike, and a new signature.
- Dockerfile (multi-stage, Node 22 Alpine) and `docker-compose.yml` with Postgres 17.
- Test suite: 12 tests in 3 files covering fingerprinting, detection rules, and the HTTP API.

### Known limitations in this release

- The Postgres store, Dockerfile, and Docker Compose setup have not been run live (no Docker in the environment where this release was prepared). The in-memory path is tested and verified.
- New-signature detection applies to all log levels, including `info` and `debug`.
- No authentication, no alerting channels, no log search, no retention policy.
