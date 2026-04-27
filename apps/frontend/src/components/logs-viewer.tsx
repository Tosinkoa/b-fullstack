import { toast } from "sonner"
import { useEffect, useRef } from "react"

import { useDeploymentLogStream } from "@/hooks/use-deployment-log-stream"
import type { DeploymentLogEntry } from "@/schemas/deployment-log"
import { cn } from "@/lib/utils"

type Props = {
  deploymentId: string
}

const STREAM_META: Record<
  DeploymentLogEntry["stream"],
  { label: string; title: string }
> = {
  stdout: {
    label: "stdout",
    title: "Standard output from the build or container process.",
  },
  stderr: {
    label: "stderr",
    title:
      "Standard error stream. Many CLIs (npm, cargo, compilers) write normal progress and info here, it is not the same as “your deployment failed”.",
  },
  system: {
    label: "system",
    title:
      "Message from the deployment platform (API / pipeline), not from the app’s stdout/stderr.",
  },
}

export function LogsViewer({ deploymentId }: Props) {
  const { logs, connectionState } = useDeploymentLogStream(deploymentId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isSevereError = (msg: string) =>
    /(error\b|failed\b|panic\b|traceback\b|uncaught|exception\b|exit(ed)? with code)/i.test(
      msg
    )

  useEffect(() => {
    if (connectionState !== "error") return
    toast.error("Log stream error", {
      description: "SSE disconnected. Retrying automatically…",
    })
  }, [connectionState])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    })
  }, [logs.length])

  return (
    <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-hidden rounded-xl border border-border bg-zinc-950 dark:bg-zinc-950">
      <div className="flex min-w-0 max-w-full shrink-0 items-center justify-between gap-2 border-b border-white/8 px-3 py-2">
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        </div>
        <span className="min-w-0 flex-1 truncate text-center font-mono text-[10px] text-white/30">
          deployment.log
        </span>
        <div className="shrink-0">
          <ConnectionBadge state={connectionState} />
        </div>
      </div>

      <div
        className={cn(
          "min-h-0 min-w-0 max-w-full flex-1 overflow-auto overscroll-x-contain overscroll-y-contain",
          "touch-pan-x touch-pan-y lg:[scrollbar-gutter:stable]",
        )}
      >
        <div className="min-w-min max-w-none p-3 font-mono text-xs leading-relaxed">
          {logs.length === 0 ? (
            <div className="flex items-center gap-2 text-white/30">
              {connectionState === "connecting" ? (
                <>
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400/60" />
                  <span>Connecting to log stream…</span>
                </>
              ) : (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-white/20" />
                  <span>No log lines yet.</span>
                </>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {logs.map((line) => (
                <li key={line.id} className="group flex gap-2 leading-snug">
                  <span className="shrink-0 text-[10px] text-white/20 tabular-nums select-none">
                    {formatLogTime(line.createdAt)}
                  </span>
                  <span
                    title={STREAM_META[line.stream].title}
                    className={cn(
                      "w-14 shrink-0 cursor-help text-right font-mono text-[9px] leading-none tracking-tight whitespace-nowrap select-none sm:text-[10px]",
                      line.stream === "stderr"
                        ? isSevereError(line.message)
                          ? "text-red-400/80"
                          : "text-amber-300/80"
                        : line.stream === "system"
                          ? "text-sky-400/70"
                          : "text-white/35"
                    )}
                  >
                    {STREAM_META[line.stream].label}
                  </span>
                  <span
                    title={line.message}
                    className={cn(
                      "whitespace-pre-wrap",
                      line.stream === "stderr"
                        ? isSevereError(line.message)
                          ? "text-red-300"
                          : "text-amber-100/90"
                        : line.stream === "system"
                          ? "text-sky-200/70 italic"
                          : "text-green-200/90"
                    )}
                  >
                    {line.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}

function formatLogTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours().toString().padStart(2, "0")
  const m = d.getMinutes().toString().padStart(2, "0")
  const s = d.getSeconds().toString().padStart(2, "0")
  const ms = d.getMilliseconds().toString().padStart(3, "0")
  return `${h}:${m}:${s}.${ms}`
}

function ConnectionBadge({
  state,
}: {
  state: "connecting" | "open" | "closed" | "error"
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn("relative flex h-1.5 w-1.5 items-center justify-center")}
      >
        {state === "connecting" && (
          <>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
          </>
        )}
        {state === "open" && (
          <>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </>
        )}
        {state === "error" && (
          <>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-400" />
          </>
        )}
        {state === "closed" && (
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white/25" />
        )}
      </span>
      <span className="font-mono text-[10px] text-white/30">{state}</span>
    </div>
  )
}
