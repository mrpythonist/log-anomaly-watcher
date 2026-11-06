# Development

## Prerequisites

- Node.js 18 or newer. Node 22 is used by the Dockerfile; the docs and test runs here used Node 24.
- npm (ships with Node).
- Optional: Docker and Docker Compose, for the Postgres-backed setup. The Docker and Postgres paths have not been run live in the environment where these docs were written (no Docker available).

## Setup

```bash
git clone https://github.com/mrpythonist/log-anomaly-watcher.git
cd log-anomaly-watcher
npm install
```

Copy `.env.example` to `.env` if you want to change the defaults for local runs. The service reads plain environment variables; there is no config file loader, so export them or set them in your process manager.

## Scripts

All scripts are defined in `package.json`. Only these commands exist; do not document or rely on any others.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the server in watch mode with `tsx watch src/server.ts` |
| `npm start` | Runs the compiled server from `dist/server.js` (run `npm run build` first) |
| `npm run build` | Compiles TypeScript in strict mode to `dist/` (`tsc`) |
| `npm test` | Runs the Vitest suite (`vitest run`) |
| `npm run demo` | Seeds demo data against a running server (`node scripts/seed-demo.js`) |

There is no lint script configured. `npm run build` is the compile check.

## Running locally

In-memory store (default, data lost on restart):

```bash
npm run dev
# Dashboard: http://localhost:3000
# Health:    curl http://localhost:3000/api/health
```

With Postgres:

```bash
DATABASE_URL=postgres://logwatcher:logwatcher@localhost:5432/logwatcher npm run dev
```

With Docker Compose (documented, not yet run live here):

```bash
docker compose up --build
```

Change the default Postgres credentials in `docker-compose.yml` before any shared or internet-facing use.

## Running the demo

With the server running:

```bash
npm run demo
```

This posts 23 logs: 6 `Database timeout` events in the previous hour as a baseline, 12 more in the last 5 minutes (a spike, ratio 12x), 3 `Payment gateway rejected card` events (a new signature), and 2 `Cache miss` info events. It then prints the anomalies from `GET /api/anomalies`. The real output is saved in `docs/screenshots/demo-seed.txt`. Note that the first `Cache miss` info event is flagged as a new signature, because new-signature detection in this version applies to all log levels.

`BASE_URL` can be set to point the demo at a different server (default `http://localhost:3000`).

## Tests

```bash
npm test
```

The suite has 12 tests in 3 files, all passing as of the last run on 2026-11-06 (see `docs/screenshots/test-run.txt`):

- `test/fingerprint.test.ts` (4 tests): normalisation of numbers, UUIDs, IPs, and quoted strings.
- `test/detector.test.ts` (4 tests): spike detection, the minimum-count guard, new-signature detection, and steady traffic producing no anomaly.
- `test/api.test.ts` (4 tests): request validation (missing message, unknown level, bad timestamp) and signature grouping through the HTTP API.

Conventions for new tests:

- Detection behaviour goes in `test/detector.test.ts`, including boundary cases.
- Request handling goes in `test/api.test.ts`, including the 400 cases.
- Normalisation goes in `test/fingerprint.test.ts`.
- Tests must pass without Docker and without a database. The Postgres store has no automated tests yet; if you add any, gate them behind `DATABASE_URL` so the default run stays dependency-free.

## Project layout

```
src/
  server.ts        # Entry point, graceful shutdown
  app.ts           # Express routes and validation
  config.ts        # Environment parsing
  detector.ts      # Pure detection logic
  fingerprint.ts   # Normalisation and hashing
  types.ts         # Types and the Store interface
  memoryStore.ts   # In-memory store
  postgresStore.ts # Postgres store
test/              # Vitest suites
public/index.html  # Dashboard (static)
scripts/seed-demo.js # Demo seed
docs/              # Architecture, API, development docs, screenshots
```

## Conventions

- TypeScript strict mode, two-space indent, double quotes, semicolons.
- Keep `src/detector.ts` free of I/O so it stays unit-testable without a store.
- Keep detection rules explainable: if a rule cannot be described in one sentence, it probably does not belong here.
- Do not commit `dist/`, `node_modules/`, `.env`, or log files. They are covered by `.gitignore`.
- Do not commit secrets. The default Postgres credentials in `docker-compose.yml` are local development values only.
- Update the docs in the same change when behaviour changes, and add a `CHANGELOG.md` entry under `Unreleased` for user-facing changes.

## Troubleshooting

- **Port already in use.** The server listens on `PORT` (default 3000). Set `PORT` to another value or stop the other process.
- **Data disappears after restart.** That is the in-memory store. Set `DATABASE_URL` to use Postgres.
- **Old signatures re-flag as new.** The store was reset (or the in-memory store restarted). "New" means new to this deployment's store. Use Postgres for durable use.
- **A spike does not fire.** Check the two conditions: window count must be at least `SPIKE_MIN_COUNT` (default 5) and at least `baselinePerWindow * SPIKE_MULTIPLIER` (default 3x). If the baseline hour itself contains the incident, the ratio may stay below the threshold.
- **An info message is flagged as new.** That is the behaviour of this version: new-signature detection applies to all levels. See the README Limitations section.
