import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ApiError } from "@/api/client";
import { useRuntimeConfig, useUpdateRuntimeConfig } from "@/api/config";
import { useHealth } from "@/api/health";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Settings() {
  const { data: config } = useRuntimeConfig();
  const { data: health, refetch, isFetching } = useHealth();
  const update = useUpdateRuntimeConfig();

  const [endpoint, setEndpoint] = useState("");
  const [region, setRegion] = useState("");

  useEffect(() => {
    if (config) {
      setEndpoint(config.endpoint);
      setRegion(config.region);
    }
  }, [config]);

  const dirty = config && (endpoint !== config.endpoint || region !== config.region);

  async function save() {
    try {
      await update.mutateAsync({ endpoint, region });
      toast.success("Endpoint updated");
      void refetch();
    } catch (err) {
      const e = err as ApiError;
      toast.error(e.message, { description: e.hint });
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Which AWS-compatible endpoint the console talks to.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Endpoint</CardTitle>
          <CardDescription>
            LocalStack, MiniStack and Moto all listen on <code>http://localhost:4566</code>.
            Leave credentials as the dummy <code>test</code> pair for local emulators.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="endpoint">Endpoint URL</Label>
            <Input
              id="endpoint"
              className="font-mono"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              className="font-mono"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </div>

          {config && (
            <p className="text-xs text-muted-foreground">
              Credentials: <span className="font-mono">{config.credentialsMode}</span>
              {config.profile ? ` (profile ${config.profile})` : ""} · set via {config.source}
            </p>
          )}

          {config?.endpointIsRemote && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>This looks like a remote endpoint</AlertTitle>
              <AlertDescription>
                Write actions here hit a real, non-local AWS endpoint. Double-check the URL and
                credentials before creating or deleting anything.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button onClick={save} disabled={!dirty || update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} />
              Test connection
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row
            ok={!!health?.reachable}
            label="Endpoint reachable"
            detail={health?.detail}
          />
          <Row ok={!!health?.ecsAvailable} label="ECS API responding" />
          <div className="flex justify-between pt-1 text-xs text-muted-foreground">
            <span>Flavor</span>
            <span className="font-mono">
              {health?.flavor ?? "unknown"}
              {health?.version ? ` ${health.version}` : ""}
            </span>
          </div>
          {typeof health?.latencyMs === "number" && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Probe latency</span>
              <span className="font-mono">{health.latencyMs} ms</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="size-4 text-success" />
        ) : (
          <XCircle className="size-4 text-destructive" />
        )}
        {label}
      </span>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </div>
  );
}
