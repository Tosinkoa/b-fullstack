import { loadApiEnvAndLocalDefaults } from "./config/dotenv-and-defaults.js";
import { createApp } from "./presentation/http/app.js";
import { migrate } from "./infrastructure/db/migrate.js";
import { createPool } from "./infrastructure/db/pool.js";
import { DockerCliContainerRuntime } from "./infrastructure/container-runtime/docker-cli-container-runtime.js";
import { CaddyAdminIngressManager } from "./infrastructure/ingress/caddy-admin-ingress-manager.js";
import { RailpackCliImageBuilder } from "./infrastructure/image-builder/railpack-cli-image-builder.js";
import { MemoryDeploymentLogLive } from "./infrastructure/realtime/memory-deployment-log-live.js";
import { PostgresDeploymentLogsRepository } from "./infrastructure/persistence/postgres-deployment-logs-repository.js";
import { PostgresDeploymentsRepository } from "./infrastructure/persistence/postgres-deployments-repository.js";

loadApiEnvAndLocalDefaults();

const port = Number(process.env.PORT ?? 3000);

const pool = createPool();

// Retry migration: Postgres may still be initialising when the API container starts,
// even with a compose healthcheck. Error code 57P03 = "database system is starting up".
const DB_NOT_READY_CODES = new Set(["57P03", "08006", "08001", "ECONNREFUSED"]);
for (let attempt = 1; ; attempt++) {
  try {
    await migrate(pool);
    break;
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    if (attempt >= 15 || !DB_NOT_READY_CODES.has(code)) throw err;
    console.log(`DB not ready yet (${code}), retrying in 2s… (attempt ${attempt}/15)`);
    await new Promise((r) => setTimeout(r, 2_000));
  }
}

const deploymentsRepo = new PostgresDeploymentsRepository(pool);
const deploymentLogsRepo = new PostgresDeploymentLogsRepository(pool);
const deploymentLogLive = new MemoryDeploymentLogLive();
const ingressManager = new CaddyAdminIngressManager({
  adminBaseUrl: process.env.CADDY_ADMIN_URL ?? "http://caddy:2019",
  httpServerId: process.env.CADDY_HTTP_SERVER_ID,
});
const containerRuntime = new DockerCliContainerRuntime();
const imageBuilder = new RailpackCliImageBuilder();
const app = createApp({
  deploymentsRepo,
  deploymentLogsRepo,
  deploymentLogLive,
  ingressManager,
  containerRuntime,
  imageBuilder,
  // Railpack/Yarn Berry need the workspace root (lockfile + manifests), not only `apps/sample-app/`.
  sampleAppSourcePath: process.env.SAMPLE_APP_SOURCE_PATH ?? "/repo",
  dockerNetwork: process.env.DOCKER_NETWORK,
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`api listening on :${port}`);
});

const shutdown = () => {
  console.log("SIGTERM received, closing server…");
  server.close(() => {
    console.log("HTTP server closed");
    pool.end(() => process.exit(0));
  });
  // Force exit if graceful close takes too long (e.g. in-flight pipelines).
  setTimeout(() => process.exit(1), 10_000);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

