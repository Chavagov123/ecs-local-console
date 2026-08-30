/**
 * Owns the single `EventSource` to `GET /api/events`. Pages declare which
 * clusters they care about via {@link useRegisterEventClusters}; the provider
 * unions those, debounces, and (re)connects. `change` frames invalidate the
 * matching react-query keys; `snapshot` frames are stashed for the gauge.
 *
 * When the stream can't stay open the provider reports `status: "polling"` and
 * the existing `refetchInterval` logic on the service queries keeps the UI live
 * — there is no code path that depends on SSE being connected.
 */
import type {
  ChangeEvent,
  ClusterSnapshot,
  HelloEvent,
} from "@ecs-local-console/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { qk } from "@/api/keys";

export type StreamStatus = "connecting" | "open" | "polling";

const RING_CAP = 200;

interface EventStreamValue {
  status: StreamStatus;
  events: (cluster: string) => ChangeEvent[];
  snapshot: (cluster: string) => ClusterSnapshot | undefined;
  registerClusters: (clusters: string[]) => () => void;
}

const EventStreamContext = createContext<EventStreamValue | null>(null);

export function EventStreamProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [, forceRender] = useState(0);

  const ringRef = useRef<Map<string, ChangeEvent[]>>(new Map());
  const snapRef = useRef<Map<string, ClusterSnapshot>>(new Map());
  const refCounts = useRef<Map<string, number>>(new Map());
  const esRef = useRef<EventSource | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const clusterKeyRef = useRef<string>("");

  const bump = useCallback(() => forceRender((n) => n + 1), []);

  const pushEvent = useCallback(
    (e: ChangeEvent) => {
      const list = ringRef.current.get(e.cluster) ?? [];
      if (list.some((x) => x.id === e.id)) return;
      const next = [e, ...list].slice(0, RING_CAP);
      ringRef.current.set(e.cluster, next);
      bump();

      const c = e.cluster;
      if (e.type.startsWith("task.")) {
        void qc.invalidateQueries({ queryKey: qk.tasks(c) });
        void qc.invalidateQueries({ queryKey: qk.allTasks() });
        void qc.invalidateQueries({ queryKey: qk.cluster(c) });
        if (e.service) {
          void qc.invalidateQueries({ queryKey: qk.service(c, e.service) });
          void qc.invalidateQueries({ queryKey: qk.serviceTasks(c, e.service) });
        }
      } else {
        const svc = e.service ?? e.resource;
        void qc.invalidateQueries({ queryKey: qk.service(c, svc) });
        void qc.invalidateQueries({ queryKey: qk.services(c) });
        void qc.invalidateQueries({ queryKey: qk.cluster(c) });
      }
    },
    [qc, bump],
  );

  const connect = useCallback(() => {
    const clusters = [...refCounts.current.entries()]
      .filter(([, n]) => n > 0)
      .map(([c]) => c)
      .sort();
    const key = clusters.join(",");
    if (key === clusterKeyRef.current && esRef.current) return;
    clusterKeyRef.current = key;

    esRef.current?.close();
    esRef.current = null;

    if (clusters.length === 0) {
      setStatus("connecting");
      return;
    }

    const params = new URLSearchParams();
    for (const c of clusters) params.append("cluster", c);
    const es = new EventSource(`/api/events?${params.toString()}`);
    esRef.current = es;
    setStatus("connecting");

    es.addEventListener("hello", (ev) => {
      setStatus("open");
      try {
        const hello = JSON.parse((ev as MessageEvent).data) as HelloEvent;
        for (const snap of hello.clusters) snapRef.current.set(snap.cluster, snap);
        bump();
      } catch {
        /* ignore malformed frame */
      }
    });
    es.addEventListener("snapshot", (ev) => {
      try {
        const snap = JSON.parse((ev as MessageEvent).data) as ClusterSnapshot;
        snapRef.current.set(snap.cluster, snap);
        bump();
      } catch {
        /* ignore */
      }
    });
    es.addEventListener("change", (ev) => {
      try {
        pushEvent(JSON.parse((ev as MessageEvent).data) as ChangeEvent);
      } catch {
        /* ignore */
      }
    });
    es.onopen = () => setStatus("open");
    es.onerror = () => {
      // EventSource reconnects itself (server sends `retry:`). Until it does,
      // the queries fall back to polling.
      setStatus((s) => (s === "open" ? "polling" : "polling"));
    };
  }, [bump, pushEvent]);

  const scheduleConnect = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(connect, 300);
  }, [connect]);

  const registerClusters = useCallback(
    (clusters: string[]) => {
      for (const c of clusters) {
        refCounts.current.set(c, (refCounts.current.get(c) ?? 0) + 1);
      }
      scheduleConnect();
      return () => {
        for (const c of clusters) {
          const n = (refCounts.current.get(c) ?? 1) - 1;
          if (n <= 0) refCounts.current.delete(c);
          else refCounts.current.set(c, n);
        }
        scheduleConnect();
      };
    },
    [scheduleConnect],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  const value = useMemo<EventStreamValue>(
    () => ({
      status,
      events: (cluster) => ringRef.current.get(cluster) ?? [],
      snapshot: (cluster) => snapRef.current.get(cluster),
      registerClusters,
    }),
    [status, registerClusters],
  );

  return <EventStreamContext.Provider value={value}>{children}</EventStreamContext.Provider>;
}

export function useEventStream(): EventStreamValue {
  const ctx = useContext(EventStreamContext);
  if (!ctx) {
    // Allows components (and tests) to render outside a provider without crashing.
    return {
      status: "polling",
      events: () => [],
      snapshot: () => undefined,
      registerClusters: () => () => {},
    };
  }
  return ctx;
}

/** Declare that the current page wants live events for `clusters`. */
export function useRegisterEventClusters(clusters: string[]): void {
  const { registerClusters } = useEventStream();
  const key = clusters.filter(Boolean).sort().join(",");
  useEffect(() => {
    if (!key) return;
    return registerClusters(key.split(","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
