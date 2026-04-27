import { config } from "dotenv";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves the monorepo root by walking up from this file looking for `yarn.lock`.
 * Works for compiled output under `apps/api/dist/...` (local and Docker `WORKDIR /repo`).
 */
function findYarnMonorepoRootFromHere(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 40; i++) {
    if (existsSync(join(dir, "yarn.lock"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error(
    "Could not locate yarn.lock (monorepo root). Set SAMPLE_APP_SOURCE_PATH to an absolute path.",
  );
}

/**
 * Load `apps/api/.env` (optional) and set sensible defaults for local `yarn` runs.
 * Docker Compose sets env in `docker-compose.yml` and does not require this file.
 */
export function loadApiEnvAndLocalDefaults(): void {
  const monorepoRoot = findYarnMonorepoRootFromHere();
  const apiEnv = join(monorepoRoot, "apps", "api", ".env");
  if (existsSync(apiEnv)) {
    config({ path: apiEnv, override: false });
  }
  if (process.env.SAMPLE_APP_SOURCE_PATH == null || process.env.SAMPLE_APP_SOURCE_PATH === "") {
    process.env.SAMPLE_APP_SOURCE_PATH = monorepoRoot;
  }
  if (process.env.UPLOAD_WORKSPACE_ROOT == null || process.env.UPLOAD_WORKSPACE_ROOT === "") {
    const uploadDir = join(monorepoRoot, "apps", "api", ".data", "b-fullstack-uploads");
    process.env.UPLOAD_WORKSPACE_ROOT = uploadDir;
    mkdirSync(uploadDir, { recursive: true });
  }
}
