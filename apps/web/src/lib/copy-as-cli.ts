/**
 * Render `aws ecs …` commands equivalent to what the console is showing, so a
 * reader can reproduce or script the same call. `--endpoint-url` is included so
 * the command works against the same emulator the console is pointed at.
 */
import type {
  ServiceDetail,
  TaskDefDetail,
  TaskDetail,
} from "@ecs-local-console/shared";

function base(endpoint: string | undefined): string {
  return endpoint ? `aws --endpoint-url ${endpoint} ecs` : "aws ecs";
}

function clusterName(arn: string): string {
  return arn.includes("/") ? arn.slice(arn.lastIndexOf("/") + 1) : arn;
}

export function clusterCli(cluster: string, endpoint?: string): string {
  return `${base(endpoint)} describe-clusters --clusters ${cluster} \\
  --include STATISTICS TAGS SETTINGS`;
}

export function serviceCli(svc: ServiceDetail, endpoint?: string): string {
  const cluster = clusterName(svc.clusterArn);
  return [
    `${base(endpoint)} describe-services --cluster ${cluster} --services ${svc.name}`,
    ``,
    `# scale it`,
    `${base(endpoint)} update-service --cluster ${cluster} --service ${svc.name} \\`,
    `  --desired-count ${svc.desiredCount}`,
    ``,
    `# roll a new revision`,
    `${base(endpoint)} update-service --cluster ${cluster} --service ${svc.name} \\`,
    `  --task-definition ${svc.taskDefinition} --force-new-deployment`,
  ].join("\n");
}

export function taskCli(task: TaskDetail, endpoint?: string): string {
  const cluster = clusterName(task.clusterArn);
  return [
    `${base(endpoint)} describe-tasks --cluster ${cluster} --tasks ${task.taskId}`,
    ``,
    `# stop it`,
    `${base(endpoint)} stop-task --cluster ${cluster} --task ${task.taskId} \\`,
    `  --reason "stopped from the CLI"`,
  ].join("\n");
}

export function taskDefCli(td: TaskDefDetail, endpoint?: string): string {
  return [
    `${base(endpoint)} describe-task-definition --task-definition ${td.family}:${td.revision}`,
    ``,
    `# register the next revision from a file`,
    `${base(endpoint)} register-task-definition --cli-input-json file://${td.family}.json`,
  ].join("\n");
}
