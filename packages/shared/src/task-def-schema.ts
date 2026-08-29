import { z } from "zod";

/**
 * A deliberately permissive schema for the `RegisterTaskDefinition` request body.
 * It validates the fields the form UI cares about and lets everything else through
 * (`.passthrough()`), so the raw-JSON editor is always a viable escape hatch and
 * the emulator/AWS remains the final authority on validity.
 */

const keyValue = z.object({ name: z.string(), value: z.string() }).passthrough();

const portMapping = z
  .object({
    containerPort: z.number().int().min(0).max(65535).optional(),
    hostPort: z.number().int().min(0).max(65535).optional(),
    protocol: z.enum(["tcp", "udp"]).optional(),
    name: z.string().optional(),
    appProtocol: z.enum(["http", "http2", "grpc"]).optional(),
  })
  .passthrough();

const logConfiguration = z
  .object({
    logDriver: z.string(),
    options: z.record(z.string()).optional(),
    secretOptions: z.array(z.any()).optional(),
  })
  .passthrough();

const healthCheck = z
  .object({
    command: z.array(z.string()).min(1),
    interval: z.number().int().optional(),
    timeout: z.number().int().optional(),
    retries: z.number().int().optional(),
    startPeriod: z.number().int().optional(),
  })
  .passthrough();

export const containerDefinitionSchema = z
  .object({
    name: z.string().min(1, "Container name is required"),
    image: z.string().min(1, "Image is required"),
    essential: z.boolean().optional(),
    cpu: z.number().int().nonnegative().optional(),
    memory: z.number().int().positive().optional(),
    memoryReservation: z.number().int().positive().optional(),
    command: z.array(z.string()).optional(),
    entryPoint: z.array(z.string()).optional(),
    workingDirectory: z.string().optional(),
    environment: z.array(keyValue).optional(),
    secrets: z.array(z.object({ name: z.string(), valueFrom: z.string() }).passthrough()).optional(),
    portMappings: z.array(portMapping).optional(),
    logConfiguration: logConfiguration.optional(),
    healthCheck: healthCheck.optional(),
    dependsOn: z
      .array(
        z
          .object({
            containerName: z.string(),
            condition: z.enum(["START", "COMPLETE", "SUCCESS", "HEALTHY"]),
          })
          .passthrough(),
      )
      .optional(),
    mountPoints: z.array(z.any()).optional(),
    ulimits: z.array(z.any()).optional(),
  })
  .passthrough();

export const NETWORK_MODES = ["bridge", "host", "awsvpc", "none"] as const;
export const LAUNCH_COMPAT = ["EC2", "FARGATE", "EXTERNAL"] as const;

export const taskDefinitionSchema = z
  .object({
    family: z
      .string()
      .min(1, "Family is required")
      .max(255)
      .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, hyphens and underscores only"),
    containerDefinitions: z.array(containerDefinitionSchema).min(1, "At least one container"),
    networkMode: z.enum(NETWORK_MODES).optional(),
    requiresCompatibilities: z.array(z.enum(LAUNCH_COMPAT)).optional(),
    cpu: z.string().optional(),
    memory: z.string().optional(),
    taskRoleArn: z.string().optional(),
    executionRoleArn: z.string().optional(),
    volumes: z.array(z.any()).optional(),
    placementConstraints: z.array(z.any()).optional(),
    runtimePlatform: z.record(z.any()).optional(),
    tags: z.array(keyValue).optional(),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    if (val.requiresCompatibilities?.includes("FARGATE")) {
      if (val.networkMode && val.networkMode !== "awsvpc") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["networkMode"],
          message: "Fargate requires networkMode 'awsvpc'",
        });
      }
      if (!val.cpu || !val.memory) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cpu"],
          message: "Fargate requires task-level cpu and memory",
        });
      }
    }
  });

export type TaskDefinitionInput = z.infer<typeof taskDefinitionSchema>;
export type ContainerDefinitionInput = z.infer<typeof containerDefinitionSchema>;

/** Fields AWS returns on Describe that are illegal to send back on Register. */
export const READ_ONLY_TASK_DEF_FIELDS = [
  "taskDefinitionArn",
  "revision",
  "status",
  "requiresAttributes",
  "compatibilities",
  "registeredAt",
  "registeredBy",
  "deregisteredAt",
] as const;

/** Strip read-only fields so a `describe-task-definition` blob can be re-registered. */
export function stripReadOnlyTaskDefFields<T extends Record<string, unknown>>(input: T): Partial<T> {
  const copy: Record<string, unknown> = { ...input };
  for (const f of READ_ONLY_TASK_DEF_FIELDS) delete copy[f];
  if (copy.taskDefinition && typeof copy.taskDefinition === "object") {
    return stripReadOnlyTaskDefFields(copy.taskDefinition as T);
  }
  return copy as Partial<T>;
}
