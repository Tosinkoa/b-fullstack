import {
  IconCircleCheck,
  IconCircleX,
  IconLoader2,
  IconRocket,
  IconExternalLink,
  IconInbox,
  IconAlertTriangle,
} from "@tabler/icons-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { DeploymentRecord } from "@/schemas/deployment"

type Props = {
  deployments: DeploymentRecord[]
  selectedId: string | null
  onSelect: (id: string) => void
  isLoading: boolean
  isError: boolean
  className?: string
}

export function DeploymentList({
  deployments,
  selectedId,
  onSelect,
  isLoading,
  isError,
  className,
}: Props) {
  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <CardHeader className="shrink-0 border-b border-border/60 pb-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <CardTitle className="min-w-0 truncate">All deployments</CardTitle>
          {!isLoading && !isError && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {deployments.length}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col p-0">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-border/50 p-3"
              >
                <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Couldn&apos;t load deployments
            </p>
            <p className="text-xs text-muted-foreground/60">
              See toast for details
            </p>
          </div>
        ) : deployments.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <IconInbox className="h-5 w-5 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No deployments yet
            </p>
            <p className="text-xs text-muted-foreground/60">
              Create one above to get started
            </p>
          </div>
        ) : (
          <ScrollArea className="min-h-0 min-w-0 flex-1">
            <ul className="divide-y divide-border/60">
              {deployments.map((d) => {
                const active = d.id === selectedId
                return (
                  <li key={d.id}>
                    <button
                      className={cn(
                        "group flex w-full max-w-full min-w-0 items-center gap-3 px-4 py-3 text-left text-sm transition-all",
                        "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset",
                        "hover:bg-muted/60",
                        active && "bg-muted/80"
                      )}
                      onClick={() => onSelect(d.id)}
                      type="button"
                    >
                      <StatusDot status={d.status} />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="flex min-w-0 items-center gap-2">
                          <StatusLabel status={d.status} />
                          <span className="shrink-0 rounded border border-border px-1 py-px font-mono text-[10px] text-muted-foreground">
                            {d.sourceType}
                          </span>
                          {d.liveUrl && (
                            <a
                              className="ml-auto flex shrink-0 items-center gap-0.5 text-[10px] text-primary hover:underline"
                              href={d.liveUrl}
                              onClick={(e) => e.stopPropagation()}
                              rel="noreferrer"
                              target="_blank"
                            >
                              open
                              <IconExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                        <div className="mt-0.5 flex min-w-0 items-center gap-2">
                          <p
                            className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground"
                            title={d.id}
                          >
                            {d.id}
                          </p>
                          <span className="shrink-0 text-[10px] text-muted-foreground/40">
                            {relativeTime(d.createdAt)}
                          </span>
                        </div>
                        {d.imageTag && (
                          <p
                            className="truncate font-mono text-[10px] text-muted-foreground/60"
                            title={d.imageTag}
                          >
                            {d.imageTag}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

function StatusDot({ status }: { status: DeploymentRecord["status"] }) {
  if (status === "running") {
    return (
      <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
    )
  }
  if (status === "building") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <IconLoader2 className="h-4 w-4 animate-spin text-blue-500" />
      </span>
    )
  }
  if (status === "deploying") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <IconRocket className="h-3.5 w-3.5 animate-bounce text-violet-500" />
      </span>
    )
  }
  if (status === "pending") {
    return (
      <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
      </span>
    )
  }
  if (status === "failed") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <IconCircleX className="h-4 w-4 text-destructive" />
      </span>
    )
  }
  return null
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function StatusLabel({ status }: { status: DeploymentRecord["status"] }) {
  const configs: Record<
    DeploymentRecord["status"],
    {
      label: string
      className: string
      icon?: React.ComponentType<{ className?: string }>
    }
  > = {
    pending: {
      label: "Pending",
      className: "text-amber-600 dark:text-amber-400",
    },
    building: {
      label: "Building",
      className: "text-blue-600 dark:text-blue-400",
    },
    deploying: {
      label: "Deploying",
      className: "text-violet-600 dark:text-violet-400",
    },
    running: {
      label: "Running",
      className: "text-emerald-600 dark:text-emerald-400",
      icon: IconCircleCheck,
    },
    failed: { label: "Failed", className: "text-destructive" },
  }
  const { label, className, icon: Icon } = configs[status]
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 text-xs font-medium",
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  )
}
