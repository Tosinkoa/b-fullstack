import { spawn } from "node:child_process";

export async function cloneGitRepo(input: {
  url: string;
  destDir: string;
  onLogLine: (line: { stream: "stdout" | "stderr"; message: string }) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "git",
      ["clone", "--depth", "1", "--single-branch", input.url, input.destDir],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    const consume = (data: Buffer, stream: "stdout" | "stderr") => {
      for (const line of data.toString("utf8").split("\n")) {
        const trimmed = line.trimEnd();
        if (trimmed) input.onLogLine({ stream, message: trimmed });
      }
    };

    child.stdout?.on("data", (d: Buffer) => consume(d, "stdout"));
    child.stderr?.on("data", (d: Buffer) => consume(d, "stderr"));

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git clone exited with code ${code}`));
    });

    child.on("error", (err) => reject(new Error(`git clone spawn error: ${err.message}`)));
  });
}
