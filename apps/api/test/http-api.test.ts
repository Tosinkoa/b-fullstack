import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Server } from "node:http";

import { createApp } from "../src/presentation/http/app.js";
import { MemoryDeploymentLogLive } from "../src/infrastructure/realtime/memory-deployment-log-live.js";
import type {
  DeploymentLogRecord,
  DeploymentLogsRepository,
} from "../src/application/ports/deployment-logs-repository.js";
import type {
  DeploymentRecord,
  DeploymentsRepository,
  DeploymentStatus,
} from "../src/application/ports/deployments-repository.js";
import type { IngressManager } from "../src/application/ports/ingress-manager.js";
import type { ContainerRuntime } from "../src/application/ports/container-runtime.js";

function createTestServer() {
  const deploymentsRepo = new InMemoryDeploymentsRepository();
  const deploymentLogsRepo = new InMemoryDeploymentLogsRepository();
  const deploymentLogLive = new MemoryDeploymentLogLive();

  const app = createApp({
    deploymentsRepo,
    deploymentLogsRepo,
    deploymentLogLive,
    ingressManager: new NoopIngressManager(),
    containerRuntime: new NoopContainerRuntime(),
    // Keep the pipeline "fake" for these HTTP tests (the pipeline itself is exercised elsewhere).
    imageBuilder: undefined,
  });

  let server: Server | null = null;
  let baseUrl: string | null = null;

  return {
    deploymentsRepo,
    deploymentLogsRepo,
    deploymentLogLive,
    async start() {
      server = app.listen(0, "127.0.0.1");
      await new Promise<void>((resolve) => server!.once("listening", resolve));
      const addr = server!.address();
      if (!addr || typeof addr === "string") throw new Error("Unexpected listen address");
      baseUrl = `http://127.0.0.1:${addr.port}`;
      return { baseUrl };
    },
    async stop() {
      if (!server) return;
      await new Promise<void>((resolve, reject) =>
        server!.close((err) => (err ? reject(err) : resolve())),
      );
      server = null;
      baseUrl = null;
    },
    getBaseUrl() {
      if (!baseUrl) throw new Error("Server not started");
      return baseUrl;
    },
  };
}

describe("HTTP API (in-memory repos)", () => {
  const t = createTestServer();

  beforeAll(async () => {
    await t.start();
  });

  afterAll(async () => {
    await t.stop();
  });

  it("POST /api/deployments creates a deployment (pending)", async () => {
    const res = await fetch(`${t.getBaseUrl()}/api/deployments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceType: "git",
        gitUrl: "https://example.com/repo.git",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.deployment.status).toBe("pending");
    expect(json.deployment.sourceType).toBe("git");
  });

  it("GET /api/deployments lists deployments", async () => {
    const res = await fetch(`${t.getBaseUrl()}/api/deployments`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.deployments)).toBe(true);
    expect(json.deployments.length).toBeGreaterThan(0);
  });

  it("SSE logs stream replays persisted logs then receives live logs", async () => {
    const deployment = await t.deploymentsRepo.create({
      sourceType: "git",
      sourceUrl: "https://example.com/repo.git",
    });

    const persisted = await t.deploymentLogsRepo.append({
      deploymentId: deployment.id,
      stream: "system",
      message: "persisted-1",
    });

    const sseRes = await fetch(
      `${t.getBaseUrl()}/api/deployments/${deployment.id}/logs/stream`,
      { headers: { accept: "text/event-stream" } },
    );
    expect(sseRes.status).toBe(200);
    if (!sseRes.body) throw new Error("Missing response body");

    // Publish a live log after the connection is established.
    const live: DeploymentLogRecord = {
      id: "00000000-0000-4000-8000-000000000999",
      deploymentId: deployment.id,
      createdAt: new Date().toISOString(),
      stream: "stdout",
      message: "live-1",
    };
    t.deploymentLogLive.publish(deployment.id, live);

    const reader = sseRes.body.getReader();
    const decoder = new TextDecoder();
    let text = "";

    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.includes(persisted.id) && text.includes(live.message)) {
        break;
      }
    }

    // Close connection to avoid hanging the test runner.
    await reader.cancel();

    expect(text).toContain(`\"id\":\"${persisted.id}\"`);
    expect(text).toContain(`\"message\":\"${persisted.message}\"`);
    expect(text).toContain(`\"message\":\"${live.message}\"`);
  });
});

class InMemoryDeploymentsRepository implements DeploymentsRepository {
  private readonly byId = new Map<string, DeploymentRecord>();

  async create(input: {
    sourceType: "git";
    sourceUrl: string;
  }): Promise<DeploymentRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const rec: DeploymentRecord = {
      id,
      createdAt: now,
      updatedAt: now,
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl,
      status: "pending",
      imageTag: null,
      routePath: null,
      liveUrl: null,
      lastError: null,
    };
    this.byId.set(id, rec);
    return rec;
  }

  async list(): Promise<DeploymentRecord[]> {
    return [...this.byId.values()].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    );
  }

  async getById(id: string): Promise<DeploymentRecord | null> {
    return this.byId.get(id) ?? null;
  }

  async update(input: {
    id: string;
    status?: DeploymentStatus;
    imageTag?: string | null;
    routePath?: string | null;
    liveUrl?: string | null;
    lastError?: string | null;
  }): Promise<void> {
    const existing = this.byId.get(input.id);
    if (!existing) return;
    this.byId.set(input.id, {
      ...existing,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.imageTag !== undefined ? { imageTag: input.imageTag } : {}),
      ...(input.routePath !== undefined ? { routePath: input.routePath } : {}),
      ...(input.liveUrl !== undefined ? { liveUrl: input.liveUrl } : {}),
      ...(input.lastError !== undefined ? { lastError: input.lastError } : {}),
      updatedAt: new Date().toISOString(),
    });
  }
}

class InMemoryDeploymentLogsRepository implements DeploymentLogsRepository {
  private readonly logs: DeploymentLogRecord[] = [];

  async append(input: {
    deploymentId: string;
    stream: DeploymentLogRecord["stream"];
    message: string;
  }): Promise<DeploymentLogRecord> {
    const rec: DeploymentLogRecord = {
      id: crypto.randomUUID(),
      deploymentId: input.deploymentId,
      createdAt: new Date().toISOString(),
      stream: input.stream,
      message: input.message,
    };
    this.logs.push(rec);
    return rec;
  }

  async listForDeployment(deploymentId: string): Promise<DeploymentLogRecord[]> {
    return this.logs.filter((l) => l.deploymentId === deploymentId);
  }
}

class NoopIngressManager implements IngressManager {
  async upsertPathRoute(): Promise<void> {}
  async removeRoute(): Promise<void> {}
}

class NoopContainerRuntime implements ContainerRuntime {
  async stopAndRemove(): Promise<void> {}
  async runDetached(): Promise<void> {}
}

