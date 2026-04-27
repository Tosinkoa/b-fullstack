import { getApiBaseUrl } from "@/lib/api-base"
import {
  createGitDeploymentBodySchema,
  getDeploymentResponseSchema,
  listDeploymentsResponseSchema,
  type CreateDeploymentRequest,
  type CreateGitDeploymentBody,
  type DeploymentRecord,
} from "@/schemas/deployment"

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error("Invalid JSON from API")
  }
}

export async function listDeployments(): Promise<DeploymentRecord[]> {
  const res = await fetch(`${getApiBaseUrl()}/deployments`)
  const json = await parseJson(res)
  if (!res.ok) {
    throw new Error(
      typeof json === "object" && json && "error" in json
        ? String((json as { error: unknown }).error)
        : `Request failed (${res.status})`,
    )
  }
  const parsed = listDeploymentsResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error("Unexpected deployments list shape")
  }
  return parsed.data.deployments
}

export async function createDeployment(
  body: CreateDeploymentRequest,
): Promise<DeploymentRecord> {
  if (body.sourceType === "git") {
    const payload: CreateGitDeploymentBody = createGitDeploymentBodySchema.parse(
      body,
    )
    const res = await fetch(`${getApiBaseUrl()}/deployments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const json = await parseJson(res)
    if (!res.ok) {
      throw new Error(
        typeof json === "object" && json && "error" in json
          ? JSON.stringify((json as { error: unknown }).error)
          : `Request failed (${res.status})`,
      )
    }
    const parsed = getDeploymentResponseSchema.safeParse(json)
    if (!parsed.success) {
      throw new Error("Unexpected create deployment response")
    }
    return parsed.data.deployment
  }

  const data = new FormData()
  if (body.upload.kind === "zip") {
    data.set("file", body.upload.file, body.upload.file.name)
  } else {
    for (const f of body.upload.files) {
      const rel =
        f.webkitRelativePath && f.webkitRelativePath.length > 0
          ? f.webkitRelativePath
          : f.name
      data.append("files", f, rel)
    }
  }
  const res = await fetch(`${getApiBaseUrl()}/deployments`, {
    method: "POST",
    body: data,
  })
  const json = await parseJson(res)
  if (!res.ok) {
    throw new Error(
      typeof json === "object" && json && "error" in json
        ? String((json as { error: unknown }).error)
        : `Request failed (${res.status})`,
    )
  }
  const parsed = getDeploymentResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error("Unexpected create deployment response")
  }
  return parsed.data.deployment
}
