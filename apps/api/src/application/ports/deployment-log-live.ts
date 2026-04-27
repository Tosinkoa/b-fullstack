import type { DeploymentLogRecord } from "./deployment-logs-repository.js";

export type DeploymentLogLiveSubscriber = (log: DeploymentLogRecord) => void;

export interface DeploymentLogLive {
  subscribe(deploymentId: string, subscriber: DeploymentLogLiveSubscriber): () => void;
  publish(deploymentId: string, log: DeploymentLogRecord): void;
}
