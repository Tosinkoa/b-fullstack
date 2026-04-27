import { mkdir, rm } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { URL } from "node:url";

import type { DeploymentLogLive } from "../ports/deployment-log-live.js";
import type { DeploymentLogsRepository } from "../ports/deployment-logs-repository.js";
import type {
  DeploymentStatus,
  DeploymentsRepository,
} from "../ports/deployments-repository.js";
import type { ContainerRuntime } from "../ports/container-runtime.js";
import type { ImageBuilder } from "../ports/image-builder.js";
import type { IngressManager } from "../ports/ingress-manager.js";
import { assertDeploymentPipelineStatusTransition } from "../deployment/assert-valid-transition.js";
import { cloneGitRepo } from "../../infrastructure/vcs/git-cli-cloner.js";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitForHttpOk(input: {
  url: string;
  timeoutMs: number;
  intervalMs: number;
  headers?: Record<string, string>;
}): Promise<void> {
  const start = Date.now();
  let lastError: string | null = null;

  while (Date.now() - start < input.timeoutMs) {
    try {
      const status = await getStatusCode({ url: input.url, headers: input.headers });
      if (status >= 200 && status < 300) return;
      lastError = `HTTP ${status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await sleep(input.intervalMs);
  }

  throw new Error(`Timed out waiting for ${input.url} (${lastError ?? "no response"})`);
}

function getStatusCode(input: {
  url: string;
  headers?: Record<string, string>;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const u = new URL(input.url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port ? Number(u.port) : undefined,
        path: `${u.pathname}${u.search}`,
        method: "GET",
        headers: input.headers,
      },
      (res) => {
        res.resume(); // drain
        resolve(res.statusCode ?? 0);
      },
    );
    req.once("error", reject);
    req.end();
  });
}

export async function runFakePipeline(deps: {
  deploymentId: string;
  deploymentsRepo: DeploymentsRepository;
  deploymentLogsRepo: DeploymentLogsRepository;
  deploymentLogLive: DeploymentLogLive;
  ingressManager: IngressManager;
  containerRuntime: ContainerRuntime;
  imageBuilder?: ImageBuilder;
  /**
   * If set, the pipeline clones this URL before building instead of using buildSourcePath.
   * The clone is placed in a temp workspace that is cleaned up on completion.
   */
  gitUrl?: string;
  /**
   * Where Railpack should build from (pre-extracted upload or a pre-cloned path).
   * - Default monorepo demo uses `/repo` (Yarn workspace + `RAILPACK_*_CMD` from compose)
   * - Upload deployments point at an extracted temp directory
   */
  buildSourcePath?: string;
  /** If set, deleted after the pipeline finishes (success or failure). */
  workspacePath?: string;
  sampleAppSourcePath?: string;
  dockerNetwork?: string;
}): Promise<void> {
  const append = async (message: string, stream: "system" | "stdout" | "stderr" = "system") => {
    const log = await deps.deploymentLogsRepo.append({
      deploymentId: deps.deploymentId,
      stream,
      message,
    });
    deps.deploymentLogLive.publish(deps.deploymentId, log);
  };

  const setStatus = async (status: DeploymentStatus) => {
    const current = await deps.deploymentsRepo.getById(deps.deploymentId);
    if (!current) {
      throw new Error("Deployment not found");
    }

    assertDeploymentPipelineStatusTransition(current.status, status);
    await deps.deploymentsRepo.update({ id: deps.deploymentId, status });
  };

  const monorepoRailpackRoot = process.env.SAMPLE_APP_SOURCE_PATH ?? "/repo";

  // Will be set to the actual source path once we've cloned (git) or received (upload).
  let railpackSourcePath = deps.buildSourcePath ?? deps.sampleAppSourcePath;
  let gitCloneWorkspacePath: string | undefined;

  try {
    if (process.env.FORCE_PIPELINE_FAIL === "1") {
      throw new Error("Forced pipeline failure (FORCE_PIPELINE_FAIL=1)");
    }

    await setStatus("building");
    await append("Starting build…");
    await sleep(400);

    // ── Git clone ────────────────────────────────────────────────────────────
    if (deps.gitUrl) {
      const uploadRoot = process.env.UPLOAD_WORKSPACE_ROOT ?? "/var/lib/b-fullstack-uploads";
      gitCloneWorkspacePath = path.join(uploadRoot, `git-${deps.deploymentId}`);
      const cloneDir = path.join(gitCloneWorkspacePath, "src");

      await mkdir(gitCloneWorkspacePath, { recursive: true });
      await append(`Cloning ${deps.gitUrl}…`);

      await cloneGitRepo({
        url: deps.gitUrl,
        destDir: cloneDir,
        onLogLine: (line) => {
          void append(line.message, line.stream);
        },
      });

      railpackSourcePath = cloneDir;
      await append("Clone complete.");
      await sleep(200);
    }

    // ── Railpack build ───────────────────────────────────────────────────────
    const useMonorepoRailpackCmds =
      !!railpackSourcePath && railpackSourcePath === monorepoRailpackRoot;

    await append("Resolving dependencies…", "stdout");
    await sleep(400);
    await append("Running build steps…", "stdout");
    await sleep(400);

    let imageTag: string | null = null;
    if (deps.imageBuilder && railpackSourcePath) {
      imageTag = `brimble/deployment-${deps.deploymentId}:latest`;
      await append(`Railpack build: ${railpackSourcePath} → ${imageTag}`);
      const result = await deps.imageBuilder.buildFromPath({
        sourcePath: railpackSourcePath,
        imageTag,
        buildCommand: useMonorepoRailpackCmds
          ? process.env.RAILPACK_BUILD_CMD
          : undefined,
        startCommand: useMonorepoRailpackCmds
          ? process.env.RAILPACK_START_CMD
          : undefined,
        onLogLine: (line) => {
          void append(line.message, line.stream);
        },
      });
      imageTag = result.imageTag;
      await deps.deploymentsRepo.update({
        id: deps.deploymentId,
        imageTag,
      });
      await append(`Build complete: ${imageTag}`);
    } else {
      await append("Build complete (fake).");
    }

    // ── Docker run ───────────────────────────────────────────────────────────
    await setStatus("deploying");
    await append("Starting deploy…");
    await sleep(400);
    await append("Launching container…", "stdout");
    const containerName = `deployment-${deps.deploymentId}`;

    await deps.containerRuntime.stopAndRemove(containerName);

    await deps.containerRuntime.runDetached({
      containerName,
      image: imageTag ?? "node:24-slim",
      network: deps.dockerNetwork,
      env: { PORT: "8080" },
      args: imageTag
        ? undefined
        : [
            "node",
            "-e",
            [
              "const http=require('http');",
              "const port=Number(process.env.PORT||8080);",
              "http.createServer((req,res)=>{",
              "if(req.url==='/health'){res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true}));return;}",
              "res.setHeader('content-type','text/html');res.end('<h1>Deployed app</h1><p>placeholder container</p>');",
              "}).listen(port,'0.0.0.0',()=>console.log('listening',port));",
            ].join(""),
          ],
    });
    await sleep(400);

    await append("Waiting for container health…");
    await waitForHttpOk({
      url: `http://${containerName}:8080/health`,
      timeoutMs: 45_000,
      intervalMs: 750,
    });
    await append("Container is healthy.");

    // ── Caddy ingress ────────────────────────────────────────────────────────
    await append("Wiring ingress…");
    await sleep(400);

    const host = `${deps.deploymentId}.localhost`;
    const liveUrl = `http://${host}/`;
    await deps.ingressManager.upsertHostRoute({
      routeId: `deployment-${deps.deploymentId}`,
      host,
      upstream: `${containerName}:8080`,
    });
    await deps.deploymentsRepo.update({
      id: deps.deploymentId,
      routePath: host,
      liveUrl,
    });

    await append("Waiting for ingress health…");
    await waitForHttpOk({
      // Call Caddy by service name (works in compose); add Host header so the host-based
      // route matches. Using the upstream directly avoids origin/host enforcement edge cases.
      url: `http://caddy:80/health`,
      // Through Caddy, which routes by Host.
      headers: { Host: host },
      // If this request gets routed to the *wrong* upstream (platform frontend),
      // we'll see non-200s (often 403). Keep retrying until it becomes 200.
      timeoutMs: 45_000,
      intervalMs: 750,
    });
    await append("Ingress is healthy.");

    await append("Deployment is live.");
    await setStatus("running");
  } catch (err) {
    await deps.deploymentsRepo.update({
      id: deps.deploymentId,
      status: "failed",
      lastError: err instanceof Error ? err.message : String(err),
    });
    await append(
      `Pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
      "stderr",
    );
  } finally {
    for (const p of [deps.workspacePath, gitCloneWorkspacePath]) {
      if (p) {
        try {
          await rm(p, { recursive: true, force: true });
        } catch {
          // Best-effort cleanup; avoid hiding the original failure.
        }
      }
    }
  }
}
