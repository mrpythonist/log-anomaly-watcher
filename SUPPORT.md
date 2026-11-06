# Support

## Where to get help

- **Documentation first.** The README covers setup, configuration, the API, and known limitations. `docs/api.md` is the full API reference, `docs/architecture.md` explains the design, and `docs/development.md` covers local setup and conventions.
- **Bugs and feature requests.** Open an issue in this repository using the bug report or feature request template. Include the Node version, the store in use (memory or Postgres), the configuration values you changed, and the request and response involved.
- **Questions about using the service.** Open an issue and label it as a question. There is no separate forum or chat channel.
- **Project website.** https://mrpythonist.com

## What to include in a support request

- The version or commit you are running (`git rev-parse HEAD` or the release tag).
- The Node.js version (`node --version`).
- The store in use and whether `DATABASE_URL` is set (do not paste the connection string or any password).
- The configuration values you changed from the defaults.
- The exact request you sent and the exact response you received.
- What you expected to happen, and what happened instead.

## Response times

This is a side project maintained by one person. Issues are usually reviewed within a week. Bug reports with a minimal reproduction get priority over feature requests.

## Security issues

Do not open a public issue for a security vulnerability. See [SECURITY.md](SECURITY.md) for how to report one.
