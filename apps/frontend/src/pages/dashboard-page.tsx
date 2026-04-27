import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import {
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconLoader2,
  IconRocket,
  IconCheck,
  IconExternalLink,
  IconPackage,
  IconTag,
  IconLink,
} from "@tabler/icons-react"

import { createDeployment, listDeployments } from "@/api/deployments-client.ts"
import { CreateDeploymentForm } from "@/components/create-deployment-form.tsx"
import { DeploymentList } from "@/components/deployment-list.tsx"
import { LogsViewer } from "@/components/logs-viewer.tsx"
import type { DeploymentRecord } from "@/schemas/deployment.ts"
import { cn } from "@/lib/utils"

export function DashboardPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const deploymentsQuery = useQuery({
    queryKey: ["deployments"],
    queryFn: listDeployments,
    refetchInterval: (query) =>
      query.state.status === "error" ? false : 2_000,
  })

  const createMutation = useMutation({
    mutationFn: createDeployment,
    onSuccess: async (deployment) => {
      await queryClient.invalidateQueries({ queryKey: ["deployments"] })
      setSelectedId(deployment.id)
      toast.success("Deployment created", { description: deployment.id })
    },
    onError: (err) => {
      toast.error("Failed to create deployment", {
        description: err instanceof Error ? err.message : String(err),
      })
    },
  })

  useEffect(() => {
    if (!deploymentsQuery.isError) return
    toast.error("Failed to load deployments", {
      description: deploymentsQuery.error?.message ?? "Unknown error",
    })
  }, [deploymentsQuery.isError, deploymentsQuery.error])

  const selected =
    deploymentsQuery.data?.find((d) => d.id === selectedId) ?? null

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex min-w-0 shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
          <IconRocket className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm leading-none font-semibold tracking-tight">
            Brimble Deploy
          </h1>
          <p className="mt-1 text-xs leading-none text-muted-foreground">
            Build · deploy · stream logs live over SSE
          </p>
        </div>
      </header>

      <main className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain p-4 lg:overflow-hidden lg:p-6">
        <div className="mx-auto grid min-h-0 w-full max-w-full min-w-0 gap-4 lg:h-full lg:max-w-7xl lg:grid-cols-2 lg:gap-6">
          <div className="flex min-w-0 max-w-full flex-col gap-4 lg:min-h-0">
            <CreateDeploymentForm
              disabled={createMutation.isPending}
              onSubmit={(body) => createMutation.mutate(body)}
            />
            <DeploymentList
              className="min-h-64 lg:min-h-0 lg:flex-1"
              deployments={deploymentsQuery.data ?? []}
              isError={deploymentsQuery.isError}
              isLoading={deploymentsQuery.isPending}
              onSelect={setSelectedId}
              selectedId={selectedId}
            />
          </div>

          <div className="flex min-h-96 min-w-0 max-w-full flex-col lg:min-h-0">
            <DeploymentDetailPanel deployment={selected} />
          </div>
        </div>
      </main>
    </div>
  )
}

const PIPELINE_STEPS: Array<DeploymentRecord["status"]> = [
  "pending",
  "building",
  "deploying",
  "running",
]

const STATUS_META: Record<
  DeploymentRecord["status"],
  {
    icon: React.ComponentType<{ className?: string }>
    label: string
    color: string
  }
> = {
  pending: { icon: IconClock, label: "Pending", color: "text-amber-500" },
  building: { icon: IconLoader2, label: "Building", color: "text-blue-500" },
  deploying: { icon: IconRocket, label: "Deploying", color: "text-violet-500" },
  running: {
    icon: IconCircleCheck,
    label: "Running",
    color: "text-emerald-500",
  },
  failed: { icon: IconCircleX, label: "Failed", color: "text-destructive" },
}

function PipelineStatus({ status }: { status: DeploymentRecord["status"] }) {
  if (status === "failed") {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2.5">
        <IconCircleX className="h-4 w-4 shrink-0 text-destructive" />
        <span className="min-w-0 truncate text-sm font-medium text-destructive">
          Deployment failed
        </span>
      </div>
    )
  }

  const currentIdx = PIPELINE_STEPS.indexOf(status)

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-auto overflow-y-hidden">
      <div className="flex min-w-[260px] items-start gap-0">
        {PIPELINE_STEPS.map((step, idx) => {
          const isDone = idx < currentIdx
          const isCurrent = idx === currentIdx
          const isPending = idx > currentIdx
          const meta = STATUS_META[step]
          const Icon = meta.icon

          return (
            <div key={step} className="flex flex-1 items-start">
              <div className="flex min-w-0 flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300",
                    isDone && "border-primary bg-primary",
                    isCurrent &&
                      "border-primary bg-background shadow-sm shadow-primary/25",
                    isPending && "border-border bg-muted/50"
                  )}
                >
                  {isDone ? (
                    <IconCheck className="h-3.5 w-3.5 text-primary-foreground" />
                  ) : isCurrent ? (
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5",
                        meta.color,
                        step === "building" && "animate-spin",
                        step === "deploying" && "animate-pulse",
                        step === "pending" && "animate-pulse"
                      )}
                    />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-border" />
                  )}
                  {isCurrent && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] leading-none font-medium capitalize",
                    isCurrent && "text-foreground",
                    isDone && "text-muted-foreground",
                    isPending && "text-muted-foreground/40"
                  )}
                >
                  {step}
                </span>
              </div>
              {idx < PIPELINE_STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-1 mt-4 h-px flex-1 transition-colors duration-500",
                    isDone ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeploymentDetailPanel({
  deployment,
}: {
  deployment: DeploymentRecord | null
}) {
  if (!deployment) {
    return (
      <div className="flex min-h-96 w-full max-w-full min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 text-center lg:h-full">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted/50">
          <IconRocket className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          No deployment selected
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Pick one from the list to view details and stream logs
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-96 w-full max-w-full min-w-0 flex-col gap-4 rounded-xl border border-border bg-card shadow-sm ring-1 ring-foreground/5 lg:h-full lg:min-h-0 lg:overflow-hidden">
      <div className="min-w-0 max-w-full shrink-0 space-y-4 px-4 pt-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Deployment ID
            </p>
            <p
              className="mt-0.5 truncate font-mono text-xs text-foreground/80"
              title={deployment.id}
            >
              {deployment.id}
            </p>
          </div>
          <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {deployment.sourceType}
          </span>
        </div>

        <PipelineStatus status={deployment.status} />

        <div className="grid min-w-0 grid-cols-2 gap-3 text-sm">
          {deployment.imageTag && (
            <div className="col-span-2 flex min-w-0 items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <IconTag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground">Image tag</p>
                <p
                  className="truncate font-mono text-xs"
                  title={deployment.imageTag}
                >
                  {deployment.imageTag}
                </p>
              </div>
            </div>
          )}
          {deployment.sourceUrl && (
            <div className="col-span-2 flex min-w-0 items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <IconLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground">Source URL</p>
                <p
                  className="truncate font-mono text-xs"
                  title={deployment.sourceUrl}
                >
                  {deployment.sourceUrl}
                </p>
              </div>
            </div>
          )}
          {deployment.liveUrl && (
            <div className="col-span-2 flex min-w-0 items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2">
              <IconPackage className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  Live URL
                </p>
                <a
                  className="flex min-w-0 items-center gap-1 font-mono text-xs text-emerald-700 underline underline-offset-2 hover:text-emerald-600 dark:text-emerald-400"
                  href={deployment.liveUrl}
                  rel="noreferrer"
                  target="_blank"
                  title={deployment.liveUrl}
                >
                  <span className="min-w-0 truncate">{deployment.liveUrl}</span>
                  <IconExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            </div>
          )}
          {deployment.lastError && (
            <div className="col-span-2 flex min-w-0 items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2">
              <IconCircleX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-destructive">Error</p>
                <p
                  className="line-clamp-2 text-xs text-destructive/80"
                  title={deployment.lastError}
                >
                  {deployment.lastError}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col px-4 pb-4 max-lg:min-h-[min(50dvh,22rem)] lg:min-h-0">
        <LogsViewer key={deployment.id} deploymentId={deployment.id} />
      </div>
    </div>
  )
}
