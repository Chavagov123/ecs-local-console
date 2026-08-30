/**
 * A concrete, RHF-navigable shape for the task-definition form. The shared zod
 * schema is `.passthrough()` (so the JSON editor is always an escape hatch),
 * which gives its inferred type index signatures that break react-hook-form's
 * field-path inference — hence this hand-written mirror for the Form tab.
 */

export interface PortMappingForm {
  containerPort?: number;
  hostPort?: number;
  protocol?: "tcp" | "udp";
}

export interface KeyValueForm {
  name: string;
  value: string;
}

export interface LogConfigForm {
  logDriver: string;
  options?: Record<string, string>;
}

export interface ContainerForm {
  name: string;
  image: string;
  essential?: boolean;
  cpu?: number;
  memory?: number;
  command?: string[];
  environment?: KeyValueForm[];
  portMappings?: PortMappingForm[];
  logConfiguration?: LogConfigForm;
}

export interface TaskDefForm {
  family: string;
  requiresCompatibilities?: ("EC2" | "FARGATE" | "EXTERNAL")[];
  networkMode?: "bridge" | "host" | "awsvpc" | "none";
  cpu?: string;
  memory?: string;
  taskRoleArn?: string;
  executionRoleArn?: string;
  containerDefinitions: ContainerForm[];
}
