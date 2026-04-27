import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { assertResolvedPathWithinDest, assertSafeRelativePosixPath } from "./safe-path.js";

type MulterFile = {
  originalname: string;
  buffer: Buffer;
};

/**
 * Writes multipart parts (field `files`) to `destDir`, preserving each part’s
 * `filename` as a relative POSIX path (e.g. from `FormData` + folder picker).
 */
export async function writeMulterFilesToDir(input: { destDir: string; files: MulterFile[] }): Promise<void> {
  await mkdir(input.destDir, { recursive: true });

  for (const f of input.files) {
    const rel = f.originalname.replaceAll("\\", "/");
    if (!rel.trim()) {
      continue;
    }
    assertSafeRelativePosixPath(rel);
    const targetPath = path.join(input.destDir, rel);
    assertResolvedPathWithinDest({ destDir: input.destDir, targetPath });
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, f.buffer);
  }
}
