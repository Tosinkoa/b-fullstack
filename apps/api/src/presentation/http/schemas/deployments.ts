import { z } from "zod";

export const createGitDeploymentBodySchema = z.object({
  sourceType: z.literal("git"),
  gitUrl: z.url(),
});

export type CreateGitDeploymentBody = z.infer<typeof createGitDeploymentBodySchema>;

export const createSampleDeploymentBodySchema = z.object({
  sourceType: z.literal("sample"),
});

export type CreateSampleDeploymentBody = z.infer<typeof createSampleDeploymentBodySchema>;

export const createJsonDeploymentBodySchema = z.discriminatedUnion("sourceType", [
  createGitDeploymentBodySchema,
  createSampleDeploymentBodySchema,
]);

export type CreateJsonDeploymentBody = z.infer<typeof createJsonDeploymentBodySchema>;
