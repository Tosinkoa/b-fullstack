import { useEffect, useState } from "react"

import { getApiBaseUrl } from "@/lib/api-base"
import {
  deploymentLogSsePayloadSchema,
  type DeploymentLogEntry,
} from "@/schemas/deployment-log"

export type DeploymentLogConnectionState =
  | "connecting"
  | "open"
  | "closed"
  | "error"

/**
 * Subscribes to `GET …/deployments/:id/logs/stream` (SSE). Remount this hook
 * (e.g. `key={deploymentId}` on the parent) when `deploymentId` changes so log
 * lines reset without an effect-driven “clear” pass.
 */
export function useDeploymentLogStream(deploymentId: string): {
  logs: DeploymentLogEntry[]
  connectionState: DeploymentLogConnectionState
} {
  const [logs, setLogs] = useState<DeploymentLogEntry[]>([])
  const [connectionState, setConnectionState] =
    useState<DeploymentLogConnectionState>("connecting")

  useEffect(() => {
    const url = `${getApiBaseUrl()}/deployments/${deploymentId}/logs/stream`
    const source = new EventSource(url)

    const onLog = (event: MessageEvent<string>) => {
      let data: unknown
      try {
        data = JSON.parse(event.data) as unknown
      } catch {
        return
      }
      const parsed = deploymentLogSsePayloadSchema.safeParse(data)
      if (!parsed.success) return
      setLogs((prev) => [...prev, parsed.data])
    }

    const onPing = () => {}

    source.addEventListener("log", onLog as EventListener)
    source.addEventListener("ping", onPing)

    source.onopen = () => {
      setConnectionState("open")
    }

    source.onerror = () => {
      setConnectionState("error")
    }

    return () => {
      source.removeEventListener("log", onLog as EventListener)
      source.removeEventListener("ping", onPing)
      source.close()
    }
  }, [deploymentId])

  return { logs, connectionState }
}
