/**
 * Client-side upload filtering (same idea as .dockerignore / CI): drop heavy or
 * irrelevant paths before multipart upload. Reduces payload and stays under the API cap.
 */

export type UploadProfileId = "node" | "python" | "go" | "static" | "other"

export const UPLOAD_PROFILES: {
  id: UploadProfileId
  label: string
  hint: string
}[] = [
  {
    id: "node",
    label: "Node / TS",
    hint: "Skips node_modules, build output, caches. Best for package.json apps.",
  },
  {
    id: "python",
    label: "Python",
    hint: "Also skips venvs, __pycache__, pytest/mypy caches.",
  },
  {
    id: "go",
    label: "Go",
    hint: "Skips build noise; keeps go.mod and your source (vendor is kept).",
  },
  {
    id: "static",
    label: "Static",
    hint: "HTML/CSS/JS; same junk filtering. Put index.html in the project root for Railpack.",
  },
  {
    id: "other",
    label: "Other",
    hint: "Only generic junk (node_modules, .git, dist, …) is removed.",
  },
]

/** Path components we never need in a source upload (heavy or reproduceable). */
const BASE_DENY_SEGMENTS = new Set([
  "node_modules",
  "bower_components",
  ".git",
  ".svn",
  ".hg",
  "__pycache__",
  ".venv",
  "venv",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  ".nyc_output",
  ".cache",
  ".turbo",
  ".parcel-cache",
  "tmp",
  "temp",
  ".DS_Store",
])

const PROFILE_EXTRA_SEGMENTS: Record<UploadProfileId, Set<string>> = {
  node: new Set([".angular", ".svelte-kit", "storybook-static", ".output"]),
  python: new Set([".mypy_cache", ".pytest_cache", ".tox", ".eggs", "htmlcov"]),
  go: new Set([]),
  static: new Set([]),
  other: new Set([]),
}

function normalizeRelPath(f: File): string {
  const rel =
    f.webkitRelativePath && f.webkitRelativePath.length > 0
      ? f.webkitRelativePath
      : f.name
  return rel.replaceAll("\\", "/")
}

function shouldSkipPath(relativePath: string, profile: UploadProfileId): boolean {
  const segments = relativePath.split("/").filter(Boolean)
  const deny = new Set([...BASE_DENY_SEGMENTS, ...PROFILE_EXTRA_SEGMENTS[profile]])

  for (const seg of segments) {
    if (deny.has(seg)) return true
    if (seg.endsWith(".egg-info")) return true
  }
  return false
}

export type FilterUploadFilesResult = {
  kept: File[]
  skippedCount: number
  skippedBytes: number
  originalCount: number
}

/**
 * Filters a directory upload before building FormData. Does not run for .zip uploads
 * (users should pack without node_modules or use folder upload).
 */
export function filterFilesForUpload(
  files: File[],
  profile: UploadProfileId,
): FilterUploadFilesResult {
  const kept: File[] = []
  let skippedCount = 0
  let skippedBytes = 0

  for (const f of files) {
    const rel = normalizeRelPath(f)
    if (shouldSkipPath(rel, profile)) {
      skippedCount += 1
      skippedBytes += f.size
      continue
    }
    kept.push(f)
  }

  return {
    kept,
    skippedCount,
    skippedBytes,
    originalCount: files.length,
  }
}

const MAX_BYTES = 25 * 1024 * 1024

export function totalFileBytes(files: File[]): number {
  return files.reduce((s, f) => s + f.size, 0)
}

export function assertUnderUploadLimit(files: File[]): { ok: true } | { ok: false; total: number } {
  const total = totalFileBytes(files)
  if (total > MAX_BYTES) {
    return { ok: false, total }
  }
  return { ok: true }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
