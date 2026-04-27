export type DeploymentLogStream = "stdout" | "stderr" | "system";

export type DeploymentLogRecord = {
  id: string;
  deploymentId: string;
  createdAt: string;
  stream: DeploymentLogStream;
  message: string;
};

export interface DeploymentLogsRepository {
  append(input: {
    deploymentId: string;
    stream: DeploymentLogStream;
    message: string;
  }): Promise<DeploymentLogRecord>;

  listForDeployment(deploymentId: string): Promise<DeploymentLogRecord[]>;
}
