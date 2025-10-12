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
import { Boxes, Container, Activity, HardDrive } from "lucide-react";

const Dashboard = () => {
  const metrics = [
    { title: "Total Clusters", value: 3, icon: Boxes, trend: "2 active" },
    { title: "Running Services", value: 12, icon: Activity, trend: "+2 this week" },
    { title: "Active Tasks", value: 24, icon: Container, trend: "8 pending" },
    { title: "CPU Usage", value: "45%", icon: HardDrive, trend: "Average across clusters" },
  ];

  const recentServices = [
    { name: "web-frontend", cluster: "production", status: "running" as const, tasks: 5 },
    { name: "api-backend", cluster: "production", status: "running" as const, tasks: 3 },
    { name: "worker-queue", cluster: "staging", status: "pending" as const, tasks: 2 },
    { name: "database-proxy", cluster: "production", status: "stopped" as const, tasks: 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your local ECS environment
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Services</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service Name</TableHead>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
