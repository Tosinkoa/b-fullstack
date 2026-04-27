import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import express, { type RequestHandler } from "express";
import multer from "multer";
import { z } from "zod";

import type { DeploymentLogLive } from "../../application/ports/deployment-log-live.js";
import type { DeploymentLogsRepository } from "../../application/ports/deployment-logs-repository.js";
import type { ContainerRuntime } from "../../application/ports/container-runtime.js";
import type {
  DeploymentRecord,
  DeploymentsRepository,
} from "../../application/ports/deployments-repository.js";
import type { ImageBuilder } from "../../application/ports/image-builder.js";
import type { IngressManager } from "../../application/ports/ingress-manager.js";
import type { Response } from "express";
import { runFakePipeline } from "../../application/deployments/run-fake-pipeline.js";
import { extractZipBufferToDir } from "../../infrastructure/uploads/extract-zip-to-dir.js";
import { writeMulterFilesToDir } from "../../infrastructure/uploads/write-multer-files-to-dir.js";
import { createJsonDeploymentBodySchema } from "./schemas/deployments.js";

function getUploadRoot(): string {
  return process.env.UPLOAD_WORKSPACE_ROOT ?? "/var/lib/b-fullstack-uploads";
}

function skipUnlessContentType(expected: "json" | "multipart"): RequestHandler {
  return (req, _res, next) => {
    const ct = String(req.headers["content-type"] ?? "");
    if (expected === "json") {
      if (!ct.toLowerCase().includes("application/json")) {
        next("route");
        return;
      }
    } else {
      if (!ct.toLowerCase().includes("multipart/form-data")) {
        next("route");
        return;
      }
    }
    next();
  };
}

export function createDeploymentsRouter(deps: {
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
  const jsonParser = express.json({ limit: "1mb" });

  async function finishUploadAndRespond(
    res: Response,
    input: {
      deployment: DeploymentRecord;
      extractPath: string;
      workspacePath: string;
      logLabel: string;
    },
  ) {
    const { deployment } = input;

    const created = await deps.deploymentLogsRepo.append({
      deploymentId: deployment.id,
      stream: "system",
      message: "Deployment created.",
    });
    deps.deploymentLogLive.publish(deployment.id, created);

    const next = await deps.deploymentLogsRepo.append({
      deploymentId: deployment.id,
      stream: "system",
      message: input.logLabel,
    });
    deps.deploymentLogLive.publish(deployment.id, next);

    void runFakePipeline({
      deploymentId: deployment.id,
      deploymentsRepo: deps.deploymentsRepo,
      deploymentLogsRepo: deps.deploymentLogsRepo,
      deploymentLogLive: deps.deploymentLogLive,
      ingressManager: deps.ingressManager,
      containerRuntime: deps.containerRuntime,
      imageBuilder: deps.imageBuilder,
      buildSourcePath: input.extractPath,
      workspacePath: input.workspacePath,
      sampleAppSourcePath: deps.sampleAppSourcePath,
      dockerNetwork: deps.dockerNetwork,
    });

    res.status(201).json({ deployment });
  }
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024, files: 5_000 },
  });
  const maxUploadBytes = 25 * 1024 * 1024;

  router.get("/", async (_req, res) => {
    const deployments = await deps.deploymentsRepo.list();
    res.json({ deployments });
  });

  router.get("/:id", async (req, res) => {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "invalid id" });
      return;
    }

    const deployment = await deps.deploymentsRepo.getById(id.data);
    if (!deployment) {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.json({ deployment });
  });

  router.get("/:id/logs/stream", async (req, res) => {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "invalid id" });
      return;
    }

    const deployment = await deps.deploymentsRepo.getById(id.data);
    if (!deployment) {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    res.flushHeaders();

    const sendLogEvent = (log: {
      id: string;
      createdAt: string;
      stream: string;
      message: string;
    }) => {
      res.write(`event: log\n`);
      res.write(
        `data: ${JSON.stringify({
          id: log.id,
          createdAt: log.createdAt,
          stream: log.stream,
          message: log.message,
        })}\n\n`,
      );
    };

    const existing = await deps.deploymentLogsRepo.listForDeployment(
      deployment.id,
    );
    for (const log of existing) {
      sendLogEvent(log);
    }

    const unsubscribe = deps.deploymentLogLive.subscribe(
      deployment.id,
      (log) => {
        sendLogEvent(log);
      },
    );

    const heartbeat = setInterval(() => {
      res.write(`event: ping\n`);
      res.write(`data: {}\n\n`);
    }, 25_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  router.post(
    "/",
    skipUnlessContentType("json"),
    jsonParser,
    async (req, res) => {
      const parsed = createJsonDeploymentBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: z.treeifyError(parsed.error) });
        return;
      }

      if (parsed.data.sourceType === "sample") {
        const monorepoRoot = deps.sampleAppSourcePath ?? "/repo";
        const sampleAppBuildPath = path.join(monorepoRoot, "apps", "sample-app");
        const deployment = await deps.deploymentsRepo.create({
          sourceType: "upload",
          sourceUrl: "sample-app (bundled)",
        });

        const log = await deps.deploymentLogsRepo.append({
          deploymentId: deployment.id,
          stream: "system",
          message: "Deployment created.",
        });
        deps.deploymentLogLive.publish(deployment.id, log);

        const next = await deps.deploymentLogsRepo.append({
          deploymentId: deployment.id,
          stream: "system",
          message: `Bundled demo: Railpack builds from ${sampleAppBuildPath} only (small context, auto-detected install/build, not the full monorepo).`,
        });
        deps.deploymentLogLive.publish(deployment.id, next);

        void runFakePipeline({
          deploymentId: deployment.id,
          deploymentsRepo: deps.deploymentsRepo,
          deploymentLogsRepo: deps.deploymentLogsRepo,
          deploymentLogLive: deps.deploymentLogLive,
          ingressManager: deps.ingressManager,
          containerRuntime: deps.containerRuntime,
          imageBuilder: deps.imageBuilder,
          buildSourcePath: sampleAppBuildPath,
          sampleAppSourcePath: deps.sampleAppSourcePath,
          dockerNetwork: deps.dockerNetwork,
        });

        res.status(201).json({ deployment });
        return;
      }

      const deployment = await deps.deploymentsRepo.create({
        sourceType: "git",
        sourceUrl: parsed.data.gitUrl,
      });

      const log = await deps.deploymentLogsRepo.append({
        deploymentId: deployment.id,
        stream: "system",
        message: "Deployment created.",
      });
      deps.deploymentLogLive.publish(deployment.id, log);

      // Fire-and-forget: in-process background work (demo)
      void runFakePipeline({
        deploymentId: deployment.id,
        deploymentsRepo: deps.deploymentsRepo,
        deploymentLogsRepo: deps.deploymentLogsRepo,
        deploymentLogLive: deps.deploymentLogLive,
        ingressManager: deps.ingressManager,
        containerRuntime: deps.containerRuntime,
        imageBuilder: deps.imageBuilder,
        gitUrl: parsed.data.gitUrl,
        sampleAppSourcePath: deps.sampleAppSourcePath,
        dockerNetwork: deps.dockerNetwork,
      });

      res.status(201).json({ deployment });
    },
  );

  router.post(
    "/",
    skipUnlessContentType("multipart"),
    upload.any(),
    async (req, res) => {
      const all = (req.files ?? []) as Express.Multer.File[];
      const filesParts = all.filter((f) => f.fieldname === "files");
      const fileParts = all.filter((f) => f.fieldname === "file");

      if (filesParts.length > 0 && fileParts.length > 0) {
        res.status(400).json({
          error:
            'Use either field "files" (project folder) or a single "file" (.zip), not both',
        });
        return;
      }

      if (filesParts.length > 0) {
        const total = filesParts.reduce((s, f) => s + f.buffer.length, 0);
        if (total > maxUploadBytes) {
          res
            .status(400)
            .json({ error: `Project upload exceeds ${maxUploadBytes} bytes total` });
          return;
        }

        const deployment = await deps.deploymentsRepo.create({
          sourceType: "upload",
          sourceUrl: `upload:folder(${filesParts.length} files)`,
        });

        const uploadRoot = getUploadRoot();
        const workspacePath = path.join(uploadRoot, deployment.id);
        const extractPath = path.join(workspacePath, "src");

        try {
          await mkdir(workspacePath, { recursive: true });
          await writeMulterFilesToDir({ destDir: extractPath, files: filesParts });
        } catch (err) {
          await deps.deploymentsRepo.update({
            id: deployment.id,
            status: "failed",
            lastError: err instanceof Error ? err.message : String(err),
          });
          const log = await deps.deploymentLogsRepo.append({
            deploymentId: deployment.id,
            stream: "stderr",
            message: `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
          });
          deps.deploymentLogLive.publish(deployment.id, log);
          res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
          return;
        }

        return finishUploadAndRespond(res, {
          deployment,
          extractPath,
          workspacePath,
          logLabel: `Project files written to ${extractPath}.`,
        });
      }

      if (fileParts.length > 0) {
        if (fileParts.length !== 1) {
          res
            .status(400)
            .json({ error: 'Field "file" must contain exactly one .zip archive' });
          return;
        }
        const file = fileParts[0]!;
        if (!file.originalname.toLowerCase().endsWith(".zip")) {
          res.status(400).json({
            error:
              'Field "file" must be a .zip, or use field "files" to upload a project folder',
          });
          return;
        }

        const deployment = await deps.deploymentsRepo.create({
          sourceType: "upload",
          sourceUrl: file.originalname,
        });

        const uploadRoot = getUploadRoot();
        const workspacePath = path.join(uploadRoot, deployment.id);
        const extractPath = path.join(workspacePath, "src");

        try {
          await mkdir(workspacePath, { recursive: true });
          await writeFile(path.join(workspacePath, "upload.zip"), file.buffer);
          await extractZipBufferToDir({ zip: file.buffer, destDir: extractPath });
        } catch (err) {
          await deps.deploymentsRepo.update({
            id: deployment.id,
            status: "failed",
            lastError: err instanceof Error ? err.message : String(err),
          });
          const log = await deps.deploymentLogsRepo.append({
            deploymentId: deployment.id,
            stream: "stderr",
            message: `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
          });
          deps.deploymentLogLive.publish(deployment.id, log);
          res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
          return;
        }

        return finishUploadAndRespond(res, {
          deployment,
          extractPath,
          workspacePath,
          logLabel: `Zip extracted to ${extractPath}.`,
        });
      }

      res.status(400).json({
        error:
          'Expected multipart field "files" (project folder) or a single "file" (.zip archive)',
      });
    },
  );

  return router;
}
