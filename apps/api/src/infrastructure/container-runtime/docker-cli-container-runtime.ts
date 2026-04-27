import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type {
  ContainerRuntime,
  RunContainerResult,
} from "../../application/ports/container-runtime.js";

const execFileAsync = promisify(execFile);

export class DockerCliContainerRuntime implements ContainerRuntime {
  async runDetached(input: {
    containerName: string;
    image: string;
    network?: string;
    env?: Record<string, string>;
    args?: string[];
  }): Promise<RunContainerResult> {
    const dockerArgs: string[] = ["run", "-d", "--name", input.containerName];

    if (input.network) {
      dockerArgs.push("--network", input.network);
    }

    if (input.env) {
      for (const [key, value] of Object.entries(input.env)) {
        dockerArgs.push("-e", `${key}=${value}`);
      }
    }

    dockerArgs.push(input.image);
    if (input.args?.length) {
      dockerArgs.push(...input.args);
    }

    await execFileAsync("docker", dockerArgs, { timeout: 60_000 });

    return { containerName: input.containerName };
  }

  async stopAndRemove(containerName: string): Promise<void> {
    // Best-effort cleanup; ignore failures.
    await execFileAsync("docker", ["rm", "-f", containerName], {
      timeout: 30_000,
    }).catch(() => undefined);
  }
}

