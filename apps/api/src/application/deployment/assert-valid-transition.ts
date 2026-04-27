import {
  assertValidDeploymentStatusTransition,
  type DeploymentStatus,
} from "../../domain/deployment-status.js";

/**
 * Application-level guardrail so pipeline code doesn't "accidentally" skip domain rules.
 * When we add status updates to the repository, route them through here.
 */
export function assertDeploymentPipelineStatusTransition(
  from: DeploymentStatus,
  to: DeploymentStatus,
): void {
  assertValidDeploymentStatusTransition(from, to);
}
