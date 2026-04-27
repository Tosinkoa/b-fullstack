## Overview

This repo implements the one-page deployment pipeline take-home.

**Note on Dockerfiles vs Railpack**: Railpack is used to build **deployed apps** into container images (no handwritten Dockerfiles for those images). Dockerfiles in this repo are only used to containerize the **platform services** (API/UI) so the whole stack can run with `docker compose up`.

## Prerequisites

- Docker + Docker Compose
- Yarn (via Corepack; enabled inside the Node images during builds)

## Run (local)

```bash
docker compose up --build
```

Then browse:

- UI (behind Caddy): `http://localhost`
- API health (behind Caddy): `http://localhost/api/health`

## Architecture (high level)

- **UI**: Vite + React (single page) served via `vite preview` and reverse-proxied by **Caddy** on port **80** (client routes use the normal SPA fallback from Vite).
- **API**: Node + TypeScript (Express) behind `/api` (through Caddy, or direct `:3000` for debugging).
- **Data**: **Postgres** in compose (not published to the host by default).
- **Build**: **Railpack** runs inside the API container, using a **BuildKit** sidecar via `BUILDKIT_HOST`.
- **Run**: the API uses the **Docker socket** to `docker run` the built image on the compose network.
- **Ingress**: Caddy is the public entrypoint; the API can inject per-deployment routes via the **Caddy Admin API** (local demo only; admin is restricted by **Origin** rules).

## Trade-offs / what I’d do next

- **Docker socket in API** is the fastest way to demo `docker run`, but it’s unsafe for real multi-tenant services (broad host access, container breakout risk, noisy neighbors). Next step would be a dedicated builder/worker with least-privilege, quotas, and network policies.
- **Caddy admin on `0.0.0.0:2019`** is convenient on the private compose network, but should be locked down in anything beyond local demos (firewall, mTLS, strong auth, no host publishing).
- **“Git deployments”** currently store a URL and the demo pipeline still builds a known on-repo sample; real cloning + verified builds is the next big chunk.
- **Upload deployments** accept `.zip` and extract to disk for Railpack, but a production system would add malware scanning, size quotas, and sandboxed extract/build environments.

## Scope (intentional non-goals)

This is a time-boxed demo, not a production PaaS:

- **No** authentication / user accounts
- **No** multi-tenancy / billing / quotas
- **No** Kubernetes
- **No** “pixel-perfect” UI
- **A few** meaningful tests (not a coverage target)

## Time spent (fill in)

- Time spent: **~TBD** (include setup + build + testing)

## Brimble (separate from local docker compose)

This section is intentionally a placeholder for the take-home’s **Brimble deploy + feedback** deliverable. Add a link and a short, honest write-up when ready.

## Local dev (optional)

```bash
yarn install
```

**Environment files** (not used by `docker compose`; for local `yarn` only):

- **API** — `apps/api/.env` (copy from `apps/api/.env.example`). You need at least **`DATABASE_URL`** (Postgres reachable from your machine). Optional vars are listed in the example file.
- **Frontend (Vite)** — `apps/frontend/.env` is optional; copy from `apps/frontend/.env.example` if you want to override `VITE_*` values.

The API loads `apps/api/.env` on startup and sets `SAMPLE_APP_SOURCE_PATH` / upload paths to sensible defaults for a local clone.

Run the API on port **3000**, then the Vite dev server proxies **`/api`** to it:

```bash
yarn workspace @app/api build
yarn workspace @app/api dev
yarn workspace @app/frontend dev
```

The UI is a single-page dashboard: list/create deployments and stream logs over **SSE** for the selected deployment.

## URLs

- **Ingress (Caddy)**: `http://localhost`
- **API health (through Caddy)**: `http://localhost/api/health`
- **Deployments API (through Caddy)**:
  - `GET http://localhost/api/deployments`
  - `POST http://localhost/api/deployments`
    - **Git (JSON)**: `{ "sourceType": "git", "gitUrl": "https://example.com/repo.git" }`
    - **Upload (multipart)** — pick one:
      - **Project folder (primary):** field **`files`**, one part per file; each part’s filename is the relative path (e.g. `package.json`, `src/index.ts`). Total size **≤ 25MB**. (The UI uses a directory picker.)
      - **Zip (optional):** field **`file`**, a single **`.zip`** (max **25MB** per file). Root of the archive = app root.
  - `GET http://localhost/api/deployments/:id/logs/stream` (**SSE**; replays persisted logs, then streams new ones)
    - Example: `curl -N http://localhost/api/deployments/<uuid>/logs/stream`
- **Live deployments (through Caddy)**:
  - `http://localhost/apps/<deploymentId>/` (app)
  - `http://localhost/apps/<deploymentId>/health` (health)
- **Direct service ports (debugging only)**:
  - API: `http://localhost:3000/api/health`
  - Frontend preview: `http://localhost:4173`

## Environment variables

Defaults are set in `docker-compose.yml`.

- `DATABASE_URL` (API): points at the `db` service on the Docker network
- `DOCKER_HOST` (API): `unix:///var/run/docker.sock` (used for local demo)
- `DOCKER_NETWORK` (API): compose network name used for per-deployment containers (default `b-fullstack_default`)
- `CADDY_ADMIN_URL` (API): `http://caddy:2019`
- `CADDY_HTTP_SERVER_ID` (API): Caddy adapted server id for `:80` (default `srv0`)
- `BUILDKIT_HOST` (API): `docker-container://buildkit` (Railpack)
- `RAILPACK_BUILD_CMD` / `RAILPACK_START_CMD` (API): monorepo commands for the default git demo (targets `@app/sample-app`). **Not** used for normal `.zip` uploads; Railpack auto-detects those apps.
- `UPLOAD_WORKSPACE_ROOT` (API): where uploaded projects (folder or zip) are written (compose mounts a named volume to persist across restarts)
- `FORCE_PIPELINE_FAIL` (API test helper): set to `1` to force a failed pipeline
- `VITE_API_BASE_URL` (frontend build): currently `/api` (relative to the browser origin)

## Notes

- Postgres is **not** published to the host by default (avoids `5432` collisions). It’s reachable as `db:5432` inside the compose network.
- We pin the DB image to **`postgres:18`** (current major on Docker Hub’s `latest` track as of this repo’s timeframe).
- Postgres **18+** images expect persistent storage mounted at **`/var/lib/postgresql`** (not the older `.../data` path).
- The API service mounts the **Docker socket** (`/var/run/docker.sock`) so it can run containers for the local demo. This is a **security trade-off** and is not recommended for untrusted multi-tenant environments.
- Caddy’s Admin API is bound to `0.0.0.0:2019` for compose-network access; it uses **Origin enforcement**. The API sets `Origin: http://api:3000` on Admin API calls, and the Caddyfile allows that origin.

## Verification checklist

From a clean environment:

0. (Optional) wipe local volumes for a stricter “clean machine” test:

   ```bash
   docker compose down -v
   ```

1. `docker compose up --build`
2. Open the UI at `http://localhost`
3. Create a deployment (Git URL form) **or** upload a **project folder** (or a `.zip` fallback; see below)
4. Confirm status transitions: `pending → building → deploying → running`
5. Watch logs stream live while building (SSE) and confirm scrollback persists after completion
6. Click the live URL and confirm:
   - `/` shows the deployed app
   - `/health` returns 200
7. Create a second deployment and confirm both are routable under `/apps/<id>`

**Upload a project folder (recommended):** choose a directory whose **top level** contains Railpack trigger files (e.g. `package.json`). The browser sends one multipart part per file. In the **UI**, you pick a small **stack** card (Node, Python, Go, Static, Other); we then **drop common junk client-side**—`node_modules`, `.git`, `dist`, build caches, and profile-specific noise—so uploads stay small (similar in spirit to a `.dockerignore` / CI checkout, not a security boundary).

**Upload a .zip (alternative):** the archive should unpack with your app at the **root** (e.g. `package.json` at the top). There is **no** client-side path filtering for zips; omit `node_modules` in the zip or use a folder upload. From this repo you can test with:

```bash
( cd apps/sample-app && zip -r /tmp/sample-app.zip . )
```

Then under **Upload**, use **Or upload a .zip** and select `/tmp/sample-app.zip`.

Failure scenario:

- Force a pipeline failure:

```bash
FORCE_PIPELINE_FAIL=1 docker compose up -d --build --force-recreate api
```

- Create a deployment and confirm:
  - status becomes `failed`
  - `lastError` is set
  - SSE logs show the failure cause
