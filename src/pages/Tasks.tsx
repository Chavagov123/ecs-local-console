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
import { RefreshCw, Terminal, Square } from "lucide-react";

const Tasks = () => {
  const tasks = [
    {
      id: "abc123def456",
      service: "web-frontend",
      cluster: "production",
      status: "running" as const,
      cpu: "512",
      memory: "1024",
      launchType: "EC2",
    },
    {
      id: "def456ghi789",
      service: "api-backend",
      cluster: "production",
      status: "running" as const,
      cpu: "1024",
      memory: "2048",
      launchType: "FARGATE",
    },
    {
      id: "ghi789jkl012",
      service: "worker-queue",
      cluster: "staging",
      status: "pending" as const,
      cpu: "256",
      memory: "512",
      launchType: "EC2",
    },
    {
      id: "jkl012mno345",
      service: "cache-service",
      cluster: "staging",
      status: "running" as const,
      cpu: "512",
      memory: "1024",
      launchType: "EC2",
    },
    {
      id: "mno345pqr678",
      service: "database-proxy",
      cluster: "production",
      status: "stopped" as const,
      cpu: "2048",
      memory: "4096",
      launchType: "FARGATE",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            View and manage container tasks
          </p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task ID</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Cluster</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Launch Type</TableHead>
                <TableHead className="text-right">CPU</TableHead>
                <TableHead className="text-right">Memory</TableHead>
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
                  <TableCell className="text-right font-mono text-sm">
                    {task.cpu}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {task.memory} MB
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Terminal className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Square className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Tasks;
