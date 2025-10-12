import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const Settings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your local ECS environment
        </p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Docker Configuration</CardTitle>
            <CardDescription>
              Configure connection to your local Docker daemon
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="docker-host">Docker Host</Label>
              <Input
                id="docker-host"
                placeholder="unix:///var/run/docker.sock"
                defaultValue="unix:///var/run/docker.sock"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-version">API Version</Label>
              <Input
                id="api-version"
                placeholder="1.41"
                defaultValue="1.41"
                className="font-mono"
              />
            </div>
            <Button>Test Connection</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auto-refresh</CardTitle>
            <CardDescription>
              Automatically refresh container status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Auto-refresh</Label>
                <p className="text-sm text-muted-foreground">
                  Refresh data every 30 seconds
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Display Options</CardTitle>
            <CardDescription>
              Customize how information is displayed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Task IDs</Label>
                <p className="text-sm text-muted-foreground">
                  Display full task identifiers
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Monospace Font</Label>
                <p className="text-sm text-muted-foreground">
                  Use monospace font for technical data
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
