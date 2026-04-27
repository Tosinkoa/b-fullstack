import { describe, expect, it, vi } from "vitest";

import type { DeploymentLogRecord } from "../src/application/ports/deployment-logs-repository.js";
import { MemoryDeploymentLogLive } from "../src/infrastructure/realtime/memory-deployment-log-live.js";

describe("MemoryDeploymentLogLive", () => {
  it("notifies subscribers for a deployment id", () => {
    const live = new MemoryDeploymentLogLive();
    const fn = vi.fn();

    const deploymentId = "00000000-0000-4000-8000-000000000001";
    const unsubscribe = live.subscribe(deploymentId, fn);

    const log: DeploymentLogRecord = {
      id: "00000000-0000-4000-8000-000000000002",
      deploymentId,
      createdAt: new Date().toISOString(),
      stream: "system",
      message: "hello",
    };

    live.publish(deploymentId, log);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(log);

    unsubscribe();
    live.publish(deploymentId, log);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
