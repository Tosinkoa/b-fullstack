import express from "express";

import type { DeploymentLogLive } from "../../application/ports/deployment-log-live.js";
import type { DeploymentLogsRepository } from "../../application/ports/deployment-logs-repository.js";
import type { DeploymentsRepository } from "../../application/ports/deployments-repository.js";
import type { IngressManager } from "../../application/ports/ingress-manager.js";
import type { ContainerRuntime } from "../../application/ports/container-runtime.js";
import type { ImageBuilder } from "../../application/ports/image-builder.js";
import { createApiRouter } from "./api-router.js";

export function createApp(deps: {
  deploymentsRepo: DeploymentsRepository;
  deploymentLogsRepo: DeploymentLogsRepository;
  deploymentLogLive: DeploymentLogLive;
  ingressManager: IngressManager;
  containerRuntime: ContainerRuntime;
  imageBuilder?: ImageBuilder;
  sampleAppSourcePath?: string;
  dockerNetwork?: string;
}) {
  const app = express();

  app.disable("x-powered-by");

  app.use("/api", createApiRouter(deps));

  app.use((_req, res) => {
    res.status(404).json({ error: "not found" });
  });

  return app;
}
