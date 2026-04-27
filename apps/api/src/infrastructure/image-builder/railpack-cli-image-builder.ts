import { spawn } from "node:child_process";

import type {
  ImageBuilder,
  ImageBuildLogLine,
  ImageBuildResult,
} from "../../application/ports/image-builder.js";

export class RailpackCliImageBuilder implements ImageBuilder {
  constructor(
    private readonly options: {
      railpackCommand?: string;
      logger?: (line: { stream: "stdout" | "stderr"; message: string }) => void;
    } = {},
  ) {}

  async buildFromPath(input: {
    sourcePath: string;
    imageTag: string;
    buildCommand?: string;
    startCommand?: string;
    buildArgs?: Record<string, string>;
    onLogLine?: (line: ImageBuildLogLine) => void;
  }): Promise<ImageBuildResult> {
    const cmd = this.options.railpackCommand ?? "railpack";

    // Railpack uses `--name` for the image name/tag.
    const args: string[] = ["build", "--name", input.imageTag];

    if (input.buildCommand) {
      args.push("--build-cmd", input.buildCommand);
    }
    if (input.startCommand) {
      args.push("--start-cmd", input.startCommand);
    }

    args.push(input.sourcePath);

    if (input.buildArgs) {
      for (const [key, value] of Object.entries(input.buildArgs)) {
        args.push("--build-arg", `${key}=${value}`);
      }
    }

    await runStreaming(cmd, args, (line) => {
      this.options.logger?.(line);
      input.onLogLine?.(line);
    });

    return { imageTag: input.imageTag };
  }
}

function runStreaming(
  command: string,
  args: string[],
  onLine: (line: { stream: "stdout" | "stderr"; message: string }) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

    const onError = (err: Error) => {
      reject(err);
    };
    child.once("error", onError);

    const wire = (stream: "stdout" | "stderr") => (buf: Buffer) => {
      const text = buf.toString("utf8");
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trimEnd();
        if (!line) continue;
        onLine({ stream, message: line });
      }
    };

    child.stdout?.on("data", wire("stdout"));
    child.stderr?.on("data", wire("stderr"));

    child.once("close", (code) => {
      child.removeListener("error", onError);
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

