import express from "express";

import type { DeploymentLogLive } from "../../application/ports/deployment-log-live.js";
import type { DeploymentLogsRepository } from "../../application/ports/deployment-logs-repository.js";
import type { DeploymentsRepository } from "../../application/ports/deployments-repository.js";
import type { IngressManager } from "../../application/ports/ingress-manager.js";
import type { ContainerRuntime } from "../../application/ports/container-runtime.js";
import type { ImageBuilder } from "../../application/ports/image-builder.js";
import { createDeploymentsRouter } from "./deployments-router.js";

export function createApiRouter(deps: {
  deploymentsRepo: DeploymentsRepository;
  deploymentLogsRepo: DeploymentLogsRepository;
  deploymentLogLive: DeploymentLogLive;
  ingressManager: IngressManager;
  containerRuntime: ContainerRuntime;
  imageBuilder?: ImageBuilder;
  sampleAppSourcePath?: string;
  dockerNetwork?: string;
}): express.Router {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  router.use("/deployments", createDeploymentsRouter(deps));

  return router;
}
