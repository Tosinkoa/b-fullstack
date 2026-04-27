import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import unzipper from "unzipper";

import { assertResolvedPathWithinDest, assertSafeRelativePosixPath } from "./safe-path.js";

function assertZipMagicPrefix(buf: Buffer): void {
  if (buf.length < 2 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error("Not a ZIP file (missing PK header)");
  }
}

export async function extractZipBufferToDir(input: {
  zip: Buffer;
  destDir: string;
}): Promise<void> {
  assertZipMagicPrefix(input.zip);
  await mkdir(input.destDir, { recursive: true });

  const directory = await unzipper.Open.buffer(input.zip);

  for (const entry of directory.files) {
    const entryPath = entry.path.replaceAll("\\", "/");
    if (!entryPath.trim()) {
      continue;
    }
    assertSafeRelativePosixPath(entryPath);

    const targetPath = path.join(input.destDir, ...entryPath.split("/"));
    assertResolvedPathWithinDest({ destDir: input.destDir, targetPath });

    if (entry.type === "Directory") {
      await mkdir(targetPath, { recursive: true });
      continue;
    }

    if (entry.type === "File") {
      // ZIP bomb guard: uncompressed size must be ≤ 100 MB per entry.
      if (entry.uncompressedSize > 100 * 1024 * 1024) {
        throw new Error(
          `ZIP entry "${entryPath}" exceeds 100 MB uncompressed (${entry.uncompressedSize} bytes)`,
        );
      }
      await mkdir(path.dirname(targetPath), { recursive: true });
      const readStream = entry.stream();
      await pipeline(readStream, createWriteStream(targetPath));
    }
  }
}
