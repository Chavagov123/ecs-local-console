import { Check, Copy, Terminal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRuntimeConfig } from "@/api/config";
import {
  clusterCli,
  serviceCli,
  taskCli,
  taskDefCli,
} from "@/lib/copy-as-cli";
import type {
  ServiceDetail,
  TaskDefDetail,
  TaskDetail,
} from "@ecs-local-console/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Resource =
  | { kind: "cluster"; name: string }
  | { kind: "service"; service: ServiceDetail }
  | { kind: "task"; task: TaskDetail }
  | { kind: "taskDef"; taskDef: TaskDefDetail };

export function CopyAsCli({ resource }: { resource: Resource }) {
  const { data: config } = useRuntimeConfig();
  const [copied, setCopied] = useState(false);
  const endpoint = config?.endpointIsRemote ? undefined : config?.endpoint;

  const render = (): string => {
    switch (resource.kind) {
      case "cluster":
        return clusterCli(resource.name, endpoint);
      case "service":
        return serviceCli(resource.service, endpoint);
      case "task":
        return taskCli(resource.task, endpoint);
      case "taskDef":
        return taskDefCli(resource.taskDef, endpoint);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(render());
      setCopied(true);
      toast.success("CLI command copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Terminal className="size-3.5" />
          Copy as
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={copy}>
          {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
          Copy as AWS CLI
        </DropdownMenuItem>
        <DropdownMenuItem disabled>Copy as Terraform (soon)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
