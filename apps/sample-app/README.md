# sample-app

Minimal HTTP server used as the “deployed app” target.

- **Port**: defaults to `8080` (override via `PORT`)
- **Routes**:
  - `/` renders a tiny HTML page
  - `/health` returns `{ ok: true }`
