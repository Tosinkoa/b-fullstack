import { toast } from "sonner"
import { useEffect, useRef } from "react"

import { useDeploymentLogStream } from "@/hooks/use-deployment-log-stream"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type Props = {
  deploymentId: string
}

export function LogsViewer({ deploymentId }: Props) {
  const { logs, connectionState } = useDeploymentLogStream(deploymentId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isSevereError = (msg: string) =>
    /(error\b|failed\b|panic\b|traceback\b|uncaught|exception\b|exit(ed)? with code)/i.test(
      msg,
    )

  useEffect(() => {
    if (connectionState !== "error") return
    toast.error("Log stream error", {
      description: "SSE disconnected. Retrying automatically…",
    })
  }, [connectionState])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs.length])

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-zinc-950 dark:bg-zinc-950">
      <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        </div>
        <span className="font-mono text-[10px] text-white/30">deployment.log</span>
        <ConnectionBadge state={connectionState} />
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 font-mono text-xs leading-relaxed">
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
                  <span className="shrink-0 select-none text-[10px] text-white/20 tabular-nums">
                    {formatLogTime(line.createdAt)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 select-none text-[10px]",
                      line.stream === "stderr"
                        ? isSevereError(line.message)
                          ? "text-red-400/60"
                          : "text-amber-300/60"
                        : line.stream === "system"
                          ? "text-sky-400/50"
                          : "text-white/20",
                    )}
                  >
                    {line.stream === "stderr" ? "err" : line.stream === "system" ? "sys" : "out"}
                  </span>
                  <span
                    className={cn(
                      "break-all",
                      line.stream === "stderr"
                        ? isSevereError(line.message)
                          ? "text-red-300"
                          : "text-amber-100/90"
                        : line.stream === "system"
                          ? "text-sky-200/70 italic"
                          : "text-green-200/90",
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
      </ScrollArea>
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
        className={cn(
          "relative flex h-1.5 w-1.5 items-center justify-center",
        )}
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
