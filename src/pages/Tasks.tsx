import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Terminal, Square, Play, AlertCircle } from "lucide-react";
import { useDockerContainers, performContainerAction } from "@/hooks/useDockerContainers";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const Tasks = () => {
  const { data: containerData, isLoading, error, refetch } = useDockerContainers();
  const queryClient = useQueryClient();
  const containers = containerData?.containers || [];

  const handleContainerAction = async (containerId: string, action: "start" | "stop" | "restart") => {
    try {
      await performContainerAction(containerId, action);
      toast.success(`Container ${action}ed successfully`);
      queryClient.invalidateQueries({ queryKey: ["docker-containers"] });
    } catch (error) {
      toast.error(`Failed to ${action} container`);
      console.error(error);
    }
  };

  const tasks = containers.map(container => ({
    id: container.Id.substring(0, 12),
    service: container.Names[0]?.replace('/', '') || 'unknown',
    cluster: 'local',
    status: container.State as "running" | "pending" | "stopped",
    image: container.Image,
    launchType: 'Docker',
    fullId: container.Id,
  }));

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">View and manage container tasks</p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to connect to Docker. Make sure Docker is running and exposed on port 2375.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            View and manage container tasks
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Containers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No containers found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Container ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Cluster</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-mono text-sm">
                      {task.id}
                    </TableCell>
                    <TableCell className="font-mono">
                      {task.service}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {task.image}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {task.cluster}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={task.status} />
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-muted">
                        {task.launchType}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {task.status === "running" ? (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleContainerAction(task.fullId, "stop")}
                          >
                            <Square className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleContainerAction(task.fullId, "start")}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Tasks;
