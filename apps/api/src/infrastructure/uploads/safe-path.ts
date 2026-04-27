import path from "node:path";

/**
 * Rejects `..`, absolute paths, and NULs for a POSIX-style relative path (zip entries, multipart names).
 */
export function assertSafeRelativePosixPath(rel: string): void {
  const norm = rel.replaceAll("\\", "/");
  if (norm.includes("\0")) {
    throw new Error("Unsafe path");
  }
  if (norm.startsWith("/") || /^[A-Za-z]:/.test(norm)) {
    throw new Error("Unsafe path (absolute)");
  }
  for (const seg of norm.split("/")) {
    if (seg === "..") {
      throw new Error("Unsafe path (..)");
    }
  }
}

export function assertResolvedPathWithinDest(params: { destDir: string; targetPath: string }): void {
  const resolved = path.resolve(params.targetPath);
  const base = path.resolve(params.destDir);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error("Unsafe path (escapes destination)");
  }
}
