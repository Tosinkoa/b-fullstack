import { describe, expect, it } from "vitest";

import {
  assertValidDeploymentStatusTransition,
  InvalidDeploymentStatusTransitionError,
} from "../src/domain/deployment-status.js";

describe("deployment status transitions", () => {
  it("allows building -> deploying", () => {
    expect(() =>
      assertValidDeploymentStatusTransition("building", "deploying"),
    ).not.toThrow();
  });

  it("forbids deploying -> building (backwards)", () => {
    expect(() =>
      assertValidDeploymentStatusTransition("deploying", "building"),
    ).toThrowError(InvalidDeploymentStatusTransitionError);
  });
});
