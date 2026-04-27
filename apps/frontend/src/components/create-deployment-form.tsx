import { toast } from "sonner"
import { type ComponentProps, useId, useState, type SubmitEvent } from "react"
import {
  IconBrandGithub,
  IconBrandNodejs,
  IconBrandPython,
  IconBrandGolang,
  IconHtml,
  IconCode,
  IconFolderUp,
  IconFileZip,
  IconCheck,
  IconLoader2,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createGitDeploymentBodySchema } from "@/schemas/deployment"
import type { CreateDeploymentRequest } from "@/schemas/deployment"
import {
  type UploadProfileId,
  UPLOAD_PROFILES,
  assertUnderUploadLimit,
  filterFilesForUpload,
  formatBytes,
} from "@/lib/filter-upload-files"
import { cn } from "@/lib/utils"

type Props = {
  disabled?: boolean
  onSubmit: (body: CreateDeploymentRequest) => void
}

const SOURCE_OPTIONS = [
  {
    id: "git" as const,
    icon: IconBrandGithub,
    label: "GitHub",
    desc: "Deploy from a Git URL",
  },
  {
    id: "upload" as const,
    icon: IconFolderUp,
    label: "Upload",
    desc: "Folder or .zip archive",
  },
]

const STACK_META: Record<
  UploadProfileId,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  node: { icon: IconBrandNodejs, label: "Node.js" },
  python: { icon: IconBrandPython, label: "Python" },
  go: { icon: IconBrandGolang, label: "Go" },
  static: { icon: IconHtml, label: "HTML" },
  other: { icon: IconCode, label: "Other" },
}

export function CreateDeploymentForm({ disabled, onSubmit }: Props) {
  const folderInputId = useId()
  const zipInputId = useId()
  const [mode, setMode] = useState<"git" | "upload">("git")
  const [gitUrl, setGitUrl] = useState("")
  const [uploadProfile, setUploadProfile] = useState<UploadProfileId>("node")
  const [folderFiles, setFolderFiles] = useState<FileList | null>(null)
  const [zipFile, setZipFile] = useState<File | null>(null)

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (mode === "git") {
      const parsed = createGitDeploymentBodySchema.safeParse({
        sourceType: "git" as const,
        gitUrl: gitUrl.trim(),
      })
      if (!parsed.success) {
        toast.error("Invalid Git URL", {
          description: parsed.error.issues.map((i) => i.message).join(" ") || "Enter a valid URL",
        })
        return
      }
      onSubmit(parsed.data)
      return
    }

    if (folderFiles && folderFiles.length > 0) {
      const { kept, skippedCount, skippedBytes, originalCount } = filterFilesForUpload(
        Array.from(folderFiles),
        uploadProfile,
      )
      if (kept.length === 0) {
        toast.error("Nothing left to upload", {
          description: 'All files were skipped. Try "Other" or a different folder.',
        })
        return
      }
      if (skippedCount > 0) {
        toast.message("Upload trimmed", {
          description: `Skipped ${skippedCount} of ${originalCount} files (~${formatBytes(skippedBytes)}) — node_modules, .git, build output.`,
        })
      }
      const limit = assertUnderUploadLimit(kept)
      if (!limit.ok) {
        toast.error("Upload too large", {
          description: `~${formatBytes(limit.total)} total (max 25 MB). Remove large assets or use a .zip.`,
        })
        return
      }
      onSubmit({ sourceType: "upload", upload: { kind: "folder", files: kept } })
      return
    }
    if (zipFile) {
      onSubmit({ sourceType: "upload", upload: { kind: "zip", file: zipFile } })
      return
    }

    toast.error("Select a folder or .zip to upload")
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>New deployment</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {/* ── Source type picker ── */}
          <div className="grid grid-cols-2 gap-3">
            {SOURCE_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const active = mode === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMode(opt.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition-all duration-150 outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring/60",
                    active
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-border/80 hover:bg-muted/40",
                  )}
                >
                  {active && (
                    <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                      <IconCheck className="h-2.5 w-2.5 text-primary-foreground" />
                    </span>
                  )}
                  <Icon
                    className={cn(
                      "h-7 w-7 transition-colors",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <div>
                    <p className={cn("text-sm font-semibold", active && "text-primary")}>
                      {opt.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight">{opt.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* ── Git URL input ── */}
          {mode === "git" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="gitUrl">
                Repository URL
              </label>
              <Input
                id="gitUrl"
                name="gitUrl"
                onChange={(ev) => setGitUrl(ev.target.value)}
                placeholder="https://github.com/org/repo.git"
                type="url"
                value={gitUrl}
              />
            </div>
          )}

          {/* ── Upload mode ── */}
          {mode === "upload" && (
            <div className="flex flex-col gap-4">
              {/* Stack picker */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">Stack</p>
                <div className="grid grid-cols-5 gap-2">
                  {UPLOAD_PROFILES.map((p) => {
                    const { icon: Icon, label } = STACK_META[p.id]
                    const active = uploadProfile === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setUploadProfile(p.id)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-lg border py-2.5 px-1 text-center transition-all outline-none",
                          "focus-visible:ring-2 focus-visible:ring-ring/60",
                          active
                            ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                            : "border-border hover:bg-muted/60",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5 transition-colors",
                            active ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                        <span
                          className={cn(
                            "text-[10px] font-medium leading-none",
                            active ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* File upload areas */}
              <div className="grid grid-cols-2 gap-3">
                {/* Folder upload */}
                <label
                  htmlFor={folderInputId}
                  className={cn(
                    "group flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-3 py-5 text-center transition-all",
                    "hover:bg-muted/40 active:scale-[0.98]",
                    folderFiles && folderFiles.length > 0
                      ? "border-primary bg-primary/5"
                      : "border-border",
                  )}
                >
                  <IconFolderUp
                    className={cn(
                      "h-7 w-7 transition-colors",
                      folderFiles && folderFiles.length > 0
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground/60",
                    )}
                  />
                  <div>
                    <p className="text-xs font-semibold">
                      {folderFiles && folderFiles.length > 0
                        ? `${folderFiles.length} files selected`
                        : "Choose folder"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">webkitdirectory</p>
                  </div>
                  <input
                    className="sr-only"
                    id={folderInputId}
                    name="projectFolder"
                    type="file"
                    onChange={(ev) => {
                      setFolderFiles(ev.target.files)
                      if (ev.target.files && ev.target.files.length > 0) setZipFile(null)
                    }}
                    {...({ webkitdirectory: "true" } as ComponentProps<"input">)}
                  />
                </label>

                {/* Zip upload */}
                <label
                  htmlFor={zipInputId}
                  className={cn(
                    "group flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-3 py-5 text-center transition-all",
                    "hover:bg-muted/40 active:scale-[0.98]",
                    zipFile ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <IconFileZip
                    className={cn(
                      "h-7 w-7 transition-colors",
                      zipFile
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground/60",
                    )}
                  />
                  <div>
                    <p className="text-xs font-semibold">
                      {zipFile ? zipFile.name : "Choose .zip"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">25 MB limit</p>
                  </div>
                  <Input
                    accept=".zip,application/zip"
                    className="sr-only"
                    id={zipInputId}
                    name="file"
                    type="file"
                    onChange={(ev) => {
                      const f = ev.target.files?.[0] ?? null
                      setZipFile(f)
                      if (f) setFolderFiles(null)
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-end">
          <Button disabled={disabled} type="submit" variant="default">
            {disabled ? (
              <span className="flex items-center gap-2">
                <IconLoader2 className="h-4 w-4 animate-spin" />
                Deploying…
              </span>
            ) : (
              "Deploy"
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
