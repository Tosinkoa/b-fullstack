import { z } from "zod"

export const deploymentLogStreamSchema = z.enum(["stdout", "stderr", "system"])

export const deploymentLogSsePayloadSchema = z.object({
  id: z.uuid(),
  createdAt: z.string(),
  stream: deploymentLogStreamSchema,
  message: z.string(),
})

export type DeploymentLogEntry = z.infer<typeof deploymentLogSsePayloadSchema>
