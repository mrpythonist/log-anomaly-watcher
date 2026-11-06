# Screenshots

There is no headless browser in the environment where these docs were prepared, so there are no GUI screenshots of the dashboard. The files here are genuine terminal captures from a real run on 2026-11-06 against the public 0.1.0 code, using the in-memory store on Node 24.

- `test-run.txt` - Output of `npm test`: 3 test files, 12 tests, all passing.
- `server-and-api.txt` - Real `curl` calls against the running server: `GET /api/health`, `POST /api/logs` (one log accepted), `GET /api/signatures`, `GET /api/anomalies`, a rejected invalid level, and `GET /` returning HTTP 200 with `Content-Type: text/html`.
- `demo-seed.txt` - Output of `npm run demo`: 23 logs seeded, one critical spike (12 events vs a baseline of 1.00 per window, ratio 12.0x) and two new signatures. Note that one of the new signatures is a `Cache miss` info event: new-signature detection in this version applies to all log levels.

The dashboard itself is a plain static page (`public/index.html`): a heading, a Refresh button, an anomalies list, and a table of the top 20 signatures. It has no charts and no login screen.
