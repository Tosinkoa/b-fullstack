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
    refetchInterval: (query) => (query.state.status === "error" ? false : 2_000),
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
    <div className="h-dvh flex flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border px-6 py-3 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
          <IconRocket className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold tracking-tight leading-none">Brimble Deploy</h1>
          <p className="mt-1 text-xs text-muted-foreground leading-none">
            Build · deploy · stream logs live over SSE
          </p>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-auto lg:overflow-hidden p-4 lg:p-6">
        <div className="min-h-full lg:h-full max-w-7xl mx-auto grid gap-4 lg:grid-cols-2 lg:gap-6">
          <div className="flex flex-col gap-4 lg:min-h-0">
            <CreateDeploymentForm
              disabled={createMutation.isPending}
              onSubmit={(body) => createMutation.mutate(body)}
            />
            <DeploymentList
              className="min-h-64 lg:flex-1 lg:min-h-0"
              deployments={deploymentsQuery.data ?? []}
              isError={deploymentsQuery.isError}
              isLoading={deploymentsQuery.isPending}
              onSelect={setSelectedId}
              selectedId={selectedId}
            />
          </div>

          <div className="min-h-96 lg:min-h-0 lg:flex lg:flex-col">
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
  { icon: React.ComponentType<{ className?: string }>; label: string; color: string }
> = {
  pending: { icon: IconClock, label: "Pending", color: "text-amber-500" },
  building: { icon: IconLoader2, label: "Building", color: "text-blue-500" },
  deploying: { icon: IconRocket, label: "Deploying", color: "text-violet-500" },
  running: { icon: IconCircleCheck, label: "Running", color: "text-emerald-500" },
  failed: { icon: IconCircleX, label: "Failed", color: "text-destructive" },
}

function PipelineStatus({ status }: { status: DeploymentRecord["status"] }) {
  if (status === "failed") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2.5">
        <IconCircleX className="h-4 w-4 shrink-0 text-destructive" />
        <span className="text-sm font-medium text-destructive">Deployment failed</span>
      </div>
    )
  }

  const currentIdx = PIPELINE_STEPS.indexOf(status)

  return (
    <div className="flex items-start gap-0">
      {PIPELINE_STEPS.map((step, idx) => {
        const isDone = idx < currentIdx
        const isCurrent = idx === currentIdx
        const isPending = idx > currentIdx
        const meta = STATUS_META[step]
        const Icon = meta.icon

        return (
          <div key={step} className="flex flex-1 items-start">
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <div
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300",
                  isDone && "border-primary bg-primary",
                  isCurrent && "border-primary bg-background shadow-sm shadow-primary/25",
                  isPending && "border-border bg-muted/50",
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
                      step === "pending" && "animate-pulse",
                    )}
                  />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-border" />
                )}
                {isCurrent && (
                  <span className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium capitalize leading-none",
                  isCurrent && "text-foreground",
                  isDone && "text-muted-foreground",
                  isPending && "text-muted-foreground/40",
                )}
              >
                {step}
              </span>
            </div>
            {idx < PIPELINE_STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-1 mt-4 h-px flex-1 transition-colors duration-500",
                  isDone ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </div>
        )
      })}
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
      <div className="flex h-full min-h-96 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted/50">
          <IconRocket className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground">No deployment selected</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Pick one from the list to view details and stream logs
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-96 flex-col gap-4 rounded-xl border border-border bg-card shadow-sm ring-1 ring-foreground/5">
      <div className="shrink-0 px-4 pt-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Deployment ID
            </p>
            <p className="mt-0.5 font-mono text-xs break-all text-foreground/80">
              {deployment.id}
            </p>
          </div>
          <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {deployment.sourceType}
          </span>
        </div>

        <PipelineStatus status={deployment.status} />

        <div className="grid grid-cols-2 gap-3 text-sm">
          {deployment.imageTag && (
            <div className="col-span-2 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <IconTag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Image tag</p>
                <p className="font-mono text-xs break-all">{deployment.imageTag}</p>
              </div>
            </div>
          )}
          {deployment.sourceUrl && (
            <div className="col-span-2 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <IconLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Source URL</p>
                <p className="font-mono text-xs break-all">{deployment.sourceUrl}</p>
              </div>
            </div>
          )}
          {deployment.liveUrl && (
            <div className="col-span-2 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2">
              <IconPackage className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400">Live URL</p>
                <a
                  className="flex items-center gap-1 font-mono text-xs text-emerald-700 underline underline-offset-2 hover:text-emerald-600 dark:text-emerald-400"
                  href={deployment.liveUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="truncate">{deployment.liveUrl}</span>
                  <IconExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            </div>
          )}
          {deployment.lastError && (
            <div className="col-span-2 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2">
              <IconCircleX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <div className="min-w-0">
                <p className="text-[10px] text-destructive">Error</p>
                <p className="text-xs break-all text-destructive/80">{deployment.lastError}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <LogsViewer key={deployment.id} deploymentId={deployment.id} />
      </div>
    </div>
  )
}
