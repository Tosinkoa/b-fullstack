import { z } from "zod";

export const createGitDeploymentBodySchema = z.object({
  sourceType: z.literal("git"),
  gitUrl: z.url(),
});

export type CreateGitDeploymentBody = z.infer<typeof createGitDeploymentBodySchema>;
