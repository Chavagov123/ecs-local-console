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
import { Plus, RefreshCw, Play, Square } from "lucide-react";

const Services = () => {
  const services = [
    {
      name: "web-frontend",
      cluster: "production",
      status: "running" as const,
      desiredTasks: 5,
      runningTasks: 5,
      launchType: "EC2",
    },
    {
      name: "api-backend",
      cluster: "production",
      status: "running" as const,
      desiredTasks: 3,
      runningTasks: 3,
      launchType: "FARGATE",
    },
    {
      name: "worker-queue",
      cluster: "staging",
      status: "pending" as const,
      desiredTasks: 2,
      runningTasks: 1,
      launchType: "EC2",
    },
    {
      name: "database-proxy",
      cluster: "production",
      status: "stopped" as const,
      desiredTasks: 0,
      runningTasks: 0,
      launchType: "FARGATE",
    },
    {
      name: "cache-service",
      cluster: "staging",
      status: "running" as const,
      desiredTasks: 2,
      runningTasks: 2,
      launchType: "EC2",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Services</h1>
          <p className="text-muted-foreground">
            Manage and monitor your ECS services
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Service
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Services</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service Name</TableHead>
                <TableHead>Cluster</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Launch Type</TableHead>
                <TableHead className="text-right">Desired</TableHead>
                <TableHead className="text-right">Running</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.name}>
                  <TableCell className="font-mono font-medium">
                    {service.name}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {service.cluster}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={service.status} />
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-muted">
                      {service.launchType}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {service.desiredTasks}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {service.runningTasks}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Play className="h-4 w-4" />
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

export default Services;
