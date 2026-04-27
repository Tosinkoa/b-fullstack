import type { DeploymentLogRecord } from "../../application/ports/deployment-logs-repository.js";
import type {
  DeploymentLogLive,
  DeploymentLogLiveSubscriber,
} from "../../application/ports/deployment-log-live.js";

export class MemoryDeploymentLogLive implements DeploymentLogLive {
  private readonly subscribersByDeploymentId = new Map<
    string,
    Set<DeploymentLogLiveSubscriber>
  >();

  subscribe(deploymentId: string, subscriber: DeploymentLogLiveSubscriber) {
    let subscribers = this.subscribersByDeploymentId.get(deploymentId);
    if (!subscribers) {
      subscribers = new Set();
      this.subscribersByDeploymentId.set(deploymentId, subscribers);
    }

    subscribers.add(subscriber);

    return () => {
      const current = this.subscribersByDeploymentId.get(deploymentId);
      if (!current) return;

      current.delete(subscriber);
      if (current.size === 0) {
        this.subscribersByDeploymentId.delete(deploymentId);
      }
    };
  }

  publish(deploymentId: string, log: DeploymentLogRecord) {
    const subscribers = this.subscribersByDeploymentId.get(deploymentId);
    if (!subscribers) return;

    for (const subscriber of subscribers) {
      subscriber(log);
    }
  }
}
