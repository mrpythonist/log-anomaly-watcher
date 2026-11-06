# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

This is an early project with a single released version. Security fixes, when needed, are applied to the latest `main` and released as a new patch version.

## Reporting a vulnerability

Do not open a public GitHub issue to report a security vulnerability.

Instead, report it through one of these channels:

- Open a GitHub issue in this repository with a general description only (no exploit details, no proof-of-concept code), and state that you want to share security details privately. The maintainer will follow up on how to share them.
- Or use the contact details on https://mrpythonist.com to reach the maintainer directly.

Include in your report:

- A description of the vulnerability and what it affects.
- Steps to reproduce, or a minimal proof of concept.
- The version or commit you tested against.
- Any suggested fix, if you have one.

You can expect an acknowledgement within 7 days and a follow-up on the planned fix once the report has been assessed. If you do not hear back within 14 days, you may open a public issue with a limited description to get attention, but still without exploit details.

## Known security notes

These are documented limitations of the current version, not vulnerabilities to report as new findings:

- **No authentication.** The API and dashboard have no auth. Do not expose the service on the public internet without adding auth in front of it. See the Security section of the README.
- **Raw log messages are stored.** Do not send secrets, tokens, or personal data in log messages. Fingerprinting normalises some patterns, but the original message is still stored.
- **Default Postgres credentials in `docker-compose.yml`** (`logwatcher` / `logwatcher`) are for local development only. Change them before any non-local use.
- **No rate limiting.** A client can flood `POST /api/logs`. Run the service behind a reverse proxy with rate limits if it is reachable beyond localhost.
