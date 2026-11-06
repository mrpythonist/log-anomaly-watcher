# Contributing to Log Anomaly Watcher

Thanks for considering a contribution. This guide covers the setup and the process. The project is small and intentionally simple; keep changes focused and explainable.

## Getting started

1. Fork the repository and clone your fork.
2. Install Node.js 18 or newer (Node 22 is used by the Dockerfile).
3. Install dependencies:

```bash
npm install
```

4. Copy `.env.example` to `.env` if you want to change the defaults for local runs. The service reads plain environment variables; there is no config file loader.
5. Start the server in watch mode:

```bash
npm run dev
```

6. Seed demo data (with the server running):

```bash
npm run demo
```

## How the code is organised

- `src/app.ts` - Express routes and request validation.
- `src/detector.ts` - Pure detection logic. No I/O, so it can be tested without a database. Keep it that way.
- `src/fingerprint.ts` - Message normalisation and hashing.
- `src/memoryStore.ts` and `src/postgresStore.ts` - The two `Store` implementations defined in `src/types.ts`.
- `src/config.ts` - Environment parsing with defaults.
- `src/server.ts` - Entry point and graceful shutdown.
- `test/` - Vitest suites. `test/detector.test.ts` covers the rules, `test/api.test.ts` covers the HTTP layer, `test/fingerprint.test.ts` covers normalisation.
- `public/index.html` - The dashboard. Plain HTML, CSS, and JavaScript, no build step.

## Branch and commit conventions

- Create a feature branch from `main` in your fork. Use a short descriptive name: `fix/spike-min-count`, `docs/api-examples`, `feat/webhook-alerts`.
- Keep one logical change per pull request. If a change touches detection rules, include the tests in the same PR.
- Write commit messages in the imperative mood with a short summary line, for example `Fix spike ratio when baseline is zero`. Add a longer explanation in the body when the reason is not obvious from the diff.
- Do not commit generated files (`dist/`, `node_modules/`), local environment files (`.env`), or log files. They are covered by `.gitignore`.
- Do not commit secrets. The default Postgres credentials in `docker-compose.yml` are local development values only; do not replace them with real credentials.

## Tests

Run the full suite before opening a PR:

```bash
npm test
```

This runs Vitest (`vitest run`) across `test/`. The suite currently has 12 tests in 3 files.

Rules for tests:

- Any change to detection behaviour in `src/detector.ts` must add or update tests in `test/detector.test.ts`, including the boundary cases (minimum count, zero baseline, steady traffic).
- Any change to request handling must add or update tests in `test/api.test.ts`, including the 400 cases.
- Any change to normalisation must add or update tests in `test/fingerprint.test.ts`.
- Tests must pass without Docker and without a database. The Postgres store is not covered by the automated suite yet; if you add Postgres tests, gate them behind `DATABASE_URL` so the default run stays dependency-free.

Also verify the build compiles:

```bash
npm run build
```

There is no lint script configured in `package.json`. `npm run build` (`tsc` in strict mode) is the compile check. Keep the code formatted in the existing style (two-space indent, double quotes, semicolons) and avoid introducing a formatter or linter config without discussing it first in an issue.

## Pull request process

1. Open an issue first for anything larger than a typo or a small docs fix, so the direction can be agreed before you write code.
2. Fill in the pull request template: what changed, why, how you tested it, and any behaviour change a user should know about.
3. Make sure `npm test` and `npm run build` pass. CI runs the same two commands on Node 22.
4. Update the docs in the same PR when behaviour changes: `README.md`, `docs/api.md`, or `docs/architecture.md` as appropriate. If you add a user-facing change, add an entry under the `Unreleased` section of `CHANGELOG.md`.
5. Keep the PR scope tight. A reviewer should be able to read the diff in one sitting.
6. Be ready to revise. Review comments are about the code, not about you.

## Reporting bugs

Use the bug report template (`.github/ISSUE_TEMPLATE/bug_report.yml`). Include the Node version, the store in use (memory or Postgres), the configuration values you changed, the request you sent, and the response you got. A minimal reproduction is the fastest route to a fix.

## Code of conduct

By participating in this project you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Be direct, be respectful, and assume good intent.
