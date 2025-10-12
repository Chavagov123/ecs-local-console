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
import { Plus, RefreshCw } from "lucide-react";

const Clusters = () => {
  const clusters = [
    {
      name: "production",
      status: "running" as const,
      services: 8,
      tasks: 16,
      containerInstances: 3,
    },
    {
      name: "staging",
      status: "running" as const,
      services: 4,
      tasks: 8,
      containerInstances: 2,
    },
    {
      name: "development",
      status: "stopped" as const,
      services: 0,
      tasks: 0,
      containerInstances: 1,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clusters</h1>
          <p className="text-muted-foreground">
            Manage your container clusters
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Cluster
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Clusters</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cluster Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Services</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right">Container Instances</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clusters.map((cluster) => (
                <TableRow key={cluster.name} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-mono font-medium">
                    {cluster.name}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={cluster.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {cluster.services}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {cluster.tasks}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {cluster.containerInstances}
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

export default Clusters;
