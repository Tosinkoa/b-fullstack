export type DeploymentStatus =
  | "pending"
  | "building"
  | "deploying"
  | "running"
  | "failed";

export type DeploymentSourceType = "git" | "upload";

export type DeploymentRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  sourceType: DeploymentSourceType;
  sourceUrl: string | null;
  status: DeploymentStatus;
  imageTag: string | null;
  routePath: string | null;
  liveUrl: string | null;
  lastError: string | null;
};

export type CreateDeploymentInput = {
  sourceType: DeploymentSourceType;
  sourceUrl: string | null;
};

export interface DeploymentsRepository {
  create(input: CreateDeploymentInput): Promise<DeploymentRecord>;
  list(): Promise<DeploymentRecord[]>;
  getById(id: string): Promise<DeploymentRecord | null>;
  update(input: {
    id: string;
    status?: DeploymentStatus;
    imageTag?: string | null;
    routePath?: string | null;
    liveUrl?: string | null;
    lastError?: string | null;
  }): Promise<DeploymentRecord>;
}
