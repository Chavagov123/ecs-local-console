import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Boxes, Container, Activity, HardDrive, AlertCircle } from "lucide-react";
import { useDockerContainers, useDockerStats } from "@/hooks/useDockerContainers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

const Dashboard = () => {
  const { data: containerData, isLoading: containersLoading, error: containersError } = useDockerContainers();
  const { data: statsData, isLoading: statsLoading } = useDockerStats();

  const containers = containerData?.containers || [];
  const stats = statsData?.stats;

  const runningContainers = containers.filter(c => c.State === "running").length;
  const totalContainers = containers.length;

  const metrics = [
    { title: "Total Containers", value: stats?.containers.total ?? totalContainers, icon: Boxes, trend: `${runningContainers} running` },
    { title: "Running", value: stats?.containers.running ?? runningContainers, icon: Activity, trend: "Active now" },
    { title: "Images", value: stats?.images ?? 0, icon: Container, trend: "Total images" },
    { title: "CPU Cores", value: stats?.cpuCount ?? 0, icon: HardDrive, trend: "Available" },
  ];

  const recentServices = containers.slice(0, 4).map(container => ({
    name: container.Names[0]?.replace('/', '') || 'unknown',
    cluster: 'local',
    status: container.State || 'unknown',
    tasks: container.State === "running" ? 1 : 0,
  }));

  if (containersError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your local Docker environment
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to connect to Docker. Make sure Docker is running and exposed on port 2375.
            <br />
            Run: <code className="bg-muted px-1 py-0.5 rounded">docker run -d -p 2375:2375 -v /var/run/docker.sock:/var/run/docker.sock alpine/socat TCP-LISTEN:2375,reuseaddr,fork UNIX-CONNECT:/var/run/docker.sock</code>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your local Docker environment
        </p>
        {containerData?.dockerUrl && (
          <p className="text-xs text-muted-foreground mt-1">
            Connected to: {containerData.dockerUrl}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {containersLoading || statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Containers</CardTitle>
        </CardHeader>
        <CardContent>
          {containersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentServices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No containers found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Container Name</TableHead>
                  <TableHead>Cluster</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Running Tasks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentServices.map((service) => (
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
                    <TableCell className="text-right font-mono">
                      {service.tasks}
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

export default Dashboard;
