import { z } from "zod"

export const deploymentStatusSchema = z.enum([
  "pending",
  "building",
  "deploying",
  "running",
  "failed",
])

export const deploymentRecordSchema = z.object({
  id: z.uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sourceType: z.enum(["git", "upload"]),
  sourceUrl: z.string().nullable(),
  status: deploymentStatusSchema,
  imageTag: z.string().nullable(),
  routePath: z.string().nullable(),
  liveUrl: z.string().nullable(),
  lastError: z.string().nullable(),
})

export type DeploymentRecord = z.infer<typeof deploymentRecordSchema>

export const listDeploymentsResponseSchema = z.object({
  deployments: z.array(deploymentRecordSchema),
})

export const getDeploymentResponseSchema = z.object({
  deployment: deploymentRecordSchema,
})

export const createGitDeploymentBodySchema = z.object({
  sourceType: z.literal("git"),
  gitUrl: z.url(),
})

export type CreateGitDeploymentBody = z.infer<
  typeof createGitDeploymentBodySchema
>

export const createSampleDeploymentBodySchema = z.object({
  sourceType: z.literal("sample"),
})

export type CreateSampleDeploymentBody = z.infer<
  typeof createSampleDeploymentBodySchema
>

export type CreateDeploymentRequest =
  | CreateGitDeploymentBody
  | CreateSampleDeploymentBody
  | {
      sourceType: "upload"
      /** One or more files; use folder picker so each file has `webkitRelativePath`. */
      upload: { kind: "folder"; files: File[] }
    }
  | {
      sourceType: "upload"
      upload: { kind: "zip"; file: File }
    }
