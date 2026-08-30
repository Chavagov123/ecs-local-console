import type { ServiceDetail, TaskDefDetail } from "@ecs-local-console/shared";
import { describe, expect, it } from "vitest";
import { serviceCli, taskDefCli } from "./copy-as-cli";

const svc = {
  name: "web-svc",
  arn: "arn:aws:ecs:us-east-1:0:service/demo/web-svc",
  clusterArn: "arn:aws:ecs:us-east-1:0:cluster/demo",
  taskDefinition: "web:3",
  desiredCount: 2,
} as ServiceDetail;

describe("copy-as-cli", () => {
  it("includes --endpoint-url for a local endpoint and the right cluster/service", () => {
    const out = serviceCli(svc, "http://localhost:4566");
    expect(out).toContain("aws --endpoint-url http://localhost:4566 ecs describe-services");
    expect(out).toContain("--cluster demo --services web-svc");
    expect(out).toContain("--desired-count 2");
    expect(out).toContain("--task-definition web:3 --force-new-deployment");
  });

  it("omits --endpoint-url when none is given (real AWS)", () => {
    expect(serviceCli(svc)).toMatch(/^aws ecs describe-services/);
  });

  it("renders a task-definition register command", () => {
    const td = { family: "web", revision: 3 } as TaskDefDetail;
    expect(taskDefCli(td, "http://localhost:5001")).toContain(
      "register-task-definition --cli-input-json file://web.json",
    );
  });
});
