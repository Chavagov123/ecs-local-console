import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DockerContainer {
  Id: string;
  Names: string[];
  Image: string;
  ImageID: string;
  Command: string;
  Created: number;
  State: string;
  Status: string;
  Ports: any[];
  Labels: Record<string, string>;
  SizeRw?: number;
  SizeRootFs?: number;
  HostConfig: {
    NetworkMode: string;
  };
  NetworkSettings: {
    Networks: Record<string, any>;
  };
  Mounts: any[];
}

export interface DockerStats {
  containers: {
    total: number;
    running: number;
    paused: number;
    stopped: number;
  };
  images: number;
  memoryTotal: number;
  cpuCount: number;
  dockerVersion: string;
  apiVersion: string;
  os: string;
  architecture: string;
}

export const useDockerContainers = () => {
  return useQuery({
    queryKey: ["docker-containers"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("docker-list-containers");
      
      if (error) {
        console.error("Error fetching containers:", error);
        throw error;
      }
      
      return data as { containers: DockerContainer[]; cached: boolean; dockerUrl: string };
    },
    refetchInterval: 5000, // Refetch every 5 seconds
  });
};

export const useDockerStats = () => {
  return useQuery({
    queryKey: ["docker-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("docker-get-stats");
      
      if (error) {
        console.error("Error fetching stats:", error);
        throw error;
      }
      
      return data as { stats: DockerStats };
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};

export const performContainerAction = async (containerId: string, action: "start" | "stop" | "restart") => {
  const { data, error } = await supabase.functions.invoke("docker-container-action", {
    body: { containerId, action },
  });

  if (error) {
    console.error("Error performing container action:", error);
    throw error;
  }

  return data;
};