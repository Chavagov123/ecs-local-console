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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Terminal, Square, Play, AlertCircle, Plus, Container as ContainerIcon, Trash2 } from "lucide-react";
import { useDockerContainers, performContainerAction } from "@/hooks/useDockerContainers";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";

const Tasks = () => {
  const { data: containerData, isLoading, error, refetch } = useDockerContainers();
  const queryClient = useQueryClient();
  const containers = containerData?.containers || [];

  // Create task dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [containerImage, setContainerImage] = useState("");
  const [containerName, setContainerName] = useState("");
  const [command, setCommand] = useState("");
  const [workingDir, setWorkingDir] = useState("");
  const [environmentVars, setEnvironmentVars] = useState("");
  const [ports, setPorts] = useState("3000:80");
  const [memory, setMemory] = useState("512");
  const [cpu, setCpu] = useState("1024");
  const [restartPolicy, setRestartPolicy] = useState("unless-stopped");
  const [networkMode, setNetworkMode] = useState("bridge");

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

  const handleDeleteContainer = async (containerId: string) => {
    try {
      // First stop the container if it's running
      const stopResponse = await fetch(`http://localhost:2376/containers/${containerId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Then remove the container
      const deleteResponse = await fetch(`http://localhost:2376/containers/${containerId}?force=true`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        throw new Error(`Failed to delete container: ${errorText}`);
      }

      toast.success('Container deleted successfully');
      queryClient.invalidateQueries({ queryKey: ["docker-containers"] });
    } catch (error) {
      toast.error('Failed to delete container');
      console.error(error);
    }
  };

  const handleCreateTask = async () => {
    try {
      if (!taskName || !containerImage) {
        toast.error("Please provide task name and container image");
        return;
      }

      // Parse environment variables
      const envVars = environmentVars
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [key, ...valueParts] = line.split('=');
          return { key: key.trim(), value: valueParts.join('=').trim() };
        });

      // Parse port mappings
      const portMappings = ports
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [hostPort, containerPort] = line.split(':');
          return { hostPort: parseInt(hostPort), containerPort: parseInt(containerPort) };
        });

      // Create container configuration
      const containerConfig = {
        Image: containerImage,
        Cmd: command ? command.split(' ') : undefined,
        WorkingDir: workingDir || undefined,
        Env: envVars.length > 0 ? envVars.map(env => `${env.key}=${env.value}`) : undefined,
        ExposedPorts: portMappings.length > 0 ? 
          portMappings.reduce((acc, port) => ({ ...acc, [`${port.containerPort}/tcp`]: {} }), {}) : undefined,
        HostConfig: {
          Memory: memory ? parseInt(memory) * 1024 * 1024 : undefined, // Convert MB to bytes
          CpuShares: cpu ? parseInt(cpu) : undefined,
          RestartPolicy: { Name: restartPolicy },
          NetworkMode: networkMode,
          PortBindings: portMappings.length > 0 ?
            portMappings.reduce((acc, port) => ({
              ...acc,
              [`${port.containerPort}/tcp`]: [{ HostPort: port.hostPort.toString() }]
            }), {}) : undefined
        }
      };

      // Remove undefined values to avoid API issues
      const cleanConfig = JSON.parse(JSON.stringify(containerConfig, (key, value) => {
        return value === undefined ? undefined : value;
      }));

      console.log('Creating container with config:', cleanConfig);
      console.log('Container name:', containerName || taskName);

      // Create the container
      const createResponse = await fetch(`http://localhost:2376/containers/create?name=${encodeURIComponent(containerName || taskName)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanConfig),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create container: ${errorText}`);
      }

      const createResult = await createResponse.json();
      const containerId = createResult.Id;

      // Start the container
      const startResponse = await fetch(`http://localhost:2376/containers/${containerId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!startResponse.ok) {
        const errorText = await startResponse.text();
        let errorMessage = `Failed to start container: ${errorText}`;
        
        // Check for common port binding errors
        if (errorText.includes('bind: Only one usage of each socket address')) {
          errorMessage = `Port conflict detected. The specified port is already in use. Please choose a different port mapping (e.g., 3001:80 instead of 3000:80).`;
        } else if (errorText.includes('ports are not available')) {
          errorMessage = `Port mapping error. Please check that the host port is available and not already in use.`;
        }
        
        throw new Error(errorMessage);
      }

      toast.success(`Task "${taskName}" created and started successfully`);
      setIsCreateDialogOpen(false);
      
      // Reset form
      setTaskName("");
      setContainerImage("");
      setContainerName("");
      setCommand("");
      setWorkingDir("");
      setEnvironmentVars("");
      setPorts("3000:80");
      setMemory("512");
      setCpu("1024");
      setRestartPolicy("unless-stopped");
      setNetworkMode("bridge");

      // Refresh the containers list
      queryClient.invalidateQueries({ queryKey: ["docker-containers"] });
    } catch (error) {
      toast.error("Failed to create task");
      console.error(error);
    }
  };

  const tasks = containers.map(container => ({
    id: container.Id.substring(0, 12),
    service: container.Names[0]?.replace('/', '') || 'unknown',
    cluster: 'local',
    status: container.State || 'unknown',
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
        <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Create a new container task with custom configuration
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="container">Container</TabsTrigger>
                  <TabsTrigger value="networking">Networking</TabsTrigger>
                  <TabsTrigger value="resources">Resources</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="taskName">Task Name *</Label>
                      <Input
                        id="taskName"
                        placeholder="my-task"
                        value={taskName}
                        onChange={(e) => setTaskName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="containerImage">Container Image *</Label>
                      <Input
                        id="containerImage"
                        placeholder="nginx:latest"
                        value={containerImage}
                        onChange={(e) => setContainerImage(e.target.value)}
                      />
                      <p className="text-sm text-muted-foreground">
                        Popular images: nginx:latest, node:18, python:3.9, postgres:15
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="containerName">Container Name</Label>
                    <Input
                      id="containerName"
                      placeholder="my-container"
                      value={containerName}
                      onChange={(e) => setContainerName(e.target.value)}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="container" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="command">Command</Label>
                    <Input
                      id="command"
                      placeholder="nginx -g 'daemon off;'"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workingDir">Working Directory</Label>
                    <Input
                      id="workingDir"
                      placeholder="/app"
                      value={workingDir}
                      onChange={(e) => setWorkingDir(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="environmentVars">Environment Variables</Label>
                    <Textarea
                      id="environmentVars"
                      placeholder="KEY1=value1&#10;KEY2=value2"
                      value={environmentVars}
                      onChange={(e) => setEnvironmentVars(e.target.value)}
                      rows={4}
                    />
                    <p className="text-sm text-muted-foreground">
                      One environment variable per line in KEY=value format
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="networking" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="networkMode">Network Mode</Label>
                    <Select value={networkMode} onValueChange={setNetworkMode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bridge">Bridge</SelectItem>
                        <SelectItem value="host">Host</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ports">Port Mappings</Label>
                    <Textarea
                      id="ports"
                      placeholder="3000:80&#10;3001:3000"
                      value={ports}
                      onChange={(e) => setPorts(e.target.value)}
                      rows={4}
                    />
                    <p className="text-sm text-muted-foreground">
                      One port mapping per line in hostPort:containerPort format
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="resources" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="memory">Memory (MB)</Label>
                      <Input
                        id="memory"
                        type="number"
                        placeholder="512"
                        value={memory}
                        onChange={(e) => setMemory(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cpu">CPU Shares</Label>
                      <Input
                        id="cpu"
                        type="number"
                        placeholder="1024"
                        value={cpu}
                        onChange={(e) => setCpu(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="restartPolicy">Restart Policy</Label>
                    <Select value={restartPolicy} onValueChange={setRestartPolicy}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="always">Always</SelectItem>
                        <SelectItem value="unless-stopped">Unless Stopped</SelectItem>
                        <SelectItem value="on-failure">On Failure</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTask}>
                  <ContainerIcon className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
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
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteContainer(task.fullId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
