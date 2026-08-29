import { describe, expect, it } from "vitest";
import { statusTone, taskIsTransitioning } from "./ecs-enums.js";
import { stripReadOnlyTaskDefFields, taskDefinitionSchema } from "./task-def-schema.js";

describe("statusTone", () => {
  it("maps known task states", () => {
    expect(statusTone("RUNNING", "task")).toBe("success");
    expect(statusTone("provisioning", "task")).toBe("warning");
    expect(statusTone("STOPPED", "task")).toBe("muted");
  });
  it("maps deployment rollout states", () => {
    expect(statusTone("IN_PROGRESS", "deployment")).toBe("warning");
    expect(statusTone("FAILED", "deployment")).toBe("danger");
  });
  it("falls back to muted for unknown values", () => {
    expect(statusTone("WAT", "service")).toBe("muted");
    expect(statusTone(undefined, "task")).toBe("muted");
  });
});

describe("taskIsTransitioning", () => {
  it("is true when last != desired", () => {
    expect(taskIsTransitioning("PENDING", "RUNNING")).toBe(true);
    expect(taskIsTransitioning("RUNNING", "RUNNING")).toBe(false);
  });
});

describe("task definition schema", () => {
  it("accepts a minimal valid task def", () => {
    const result = taskDefinitionSchema.safeParse({
      family: "web",
      containerDefinitions: [{ name: "app", image: "nginx:latest" }],
    });
    expect(result.success).toBe(true);
  });
  it("rejects a Fargate task def without cpu/memory", () => {
    const result = taskDefinitionSchema.safeParse({
      family: "web",
      requiresCompatibilities: ["FARGATE"],
      networkMode: "awsvpc",
      containerDefinitions: [{ name: "app", image: "nginx" }],
    });
    expect(result.success).toBe(false);
  });
  it("strips read-only fields from a describe blob", () => {
    const stripped = stripReadOnlyTaskDefFields({
      family: "web",
      revision: 3,
      taskDefinitionArn: "arn:...",
      status: "ACTIVE",
      containerDefinitions: [],
    });
    expect(stripped).not.toHaveProperty("revision");
    expect(stripped).not.toHaveProperty("taskDefinitionArn");
    expect(stripped).toHaveProperty("family", "web");
  });
});
