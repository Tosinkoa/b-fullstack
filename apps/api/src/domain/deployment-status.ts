export type DeploymentStatus =
  | "pending"
  | "building"
  | "deploying"
  | "running"
  | "failed";

const transitions: Record<DeploymentStatus, ReadonlyArray<DeploymentStatus>> = {
  pending: ["building", "failed"],
  building: ["deploying", "failed"],
  deploying: ["running", "failed"],
  running: ["failed"],
  failed: [],
};

export class InvalidDeploymentStatusTransitionError extends Error {
  constructor(
    public readonly from: DeploymentStatus,
    public readonly to: DeploymentStatus,
  ) {
    super(`Invalid deployment status transition: ${from} -> ${to}`);
    this.name = "InvalidDeploymentStatusTransitionError";
  }
}

export function assertValidDeploymentStatusTransition(
  from: DeploymentStatus,
  to: DeploymentStatus,
): void {
  if (from === to) return;

  const allowed = transitions[from];
  if (!allowed.includes(to)) {
    throw new InvalidDeploymentStatusTransitionError(from, to);
  }
}
