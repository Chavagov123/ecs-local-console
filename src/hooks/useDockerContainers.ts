import { useQuery } from "@tanstack/react-query";

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

export interface DockerSwarmCluster {
  ID: string;
  Version: {
    Index: number;
  };
  CreatedAt: string;
  UpdatedAt: string;
  Spec: {
    Name: string;
    Labels: Record<string, string>;
    Orchestration: {
      TaskHistoryRetentionLimit: number;
    };
    Raft: {
      SnapshotInterval: number;
      KeepOldSnapshots: number;
      LogEntriesForSlowFollowers: number;
      ElectionTick: number;
      HeartbeatTick: number;
    };
    Dispatcher: {
      HeartbeatPeriod: number;
    };
    CAConfig: {
      NodeCertExpiry: number;
      ExternalCAs: any[];
      SigningCACert: string;
      SigningCAKey: string;
      ForceRotate: number;
    };
    EncryptionConfig: {
      AutoLockManagers: boolean;
    };
    TaskDefaults: {
      LogDriver: {
        Name: string;
        Options: Record<string, string>;
      };
    };
  };
  TLSInfo: {
    TrustRoot: string;
    CertIssuer: string;
    CertIssuerPublicKey: string;
  };
  RootRotationInProgress: boolean;
  DataPathPort: number;
  DefaultAddrPool: string[];
  SubnetSize: number;
}

export interface DockerSwarmNode {
  ID: string;
  Version: {
    Index: number;
  };
  CreatedAt: string;
  UpdatedAt: string;
  Spec: {
    Name: string;
    Labels: Record<string, string>;
    Role: 'worker' | 'manager';
    Availability: 'active' | 'pause' | 'drain';
  };
  Description: {
    Hostname: string;
    Platform: {
      Architecture: string;
      OS: string;
    };
    Resources: {
      NanoCPUs: number;
      MemoryBytes: number;
      GenericResources: any[];
    };
    Engine: {
      EngineVersion: string;
      Plugins: any[];
    };
    TLSInfo: {
      TrustRoot: string;
      CertIssuer: string;
      CertIssuerPublicKey: string;
    };
  };
  Status: {
    State: 'unknown' | 'down' | 'ready' | 'disconnected';
    Message: string;
    Addr: string;
  };
  ManagerStatus?: {
    Leader: boolean;
    Reachability: 'unknown' | 'unreachable' | 'reachable';
    Addr: string;
  };
}

export interface DockerSwarmService {
  ID: string;
  Version: {
    Index: number;
  };
  CreatedAt: string;
  UpdatedAt: string;
  Spec: {
    Name: string;
    Labels: Record<string, string>;
    TaskTemplate: {
      ContainerSpec: {
        Image: string;
        Labels: Record<string, string>;
        Command: string[];
        Args: string[];
        Env: string[];
        Dir: string;
        User: string;
        Groups: string[];
        TTY: boolean;
        OpenStdin: boolean;
        ReadOnly: boolean;
        Mounts: any[];
        StopGracePeriod: number;
        HealthCheck: any;
        Hostname: string;
        DNSConfig: any;
        Secrets: any[];
        Configs: any[];
        Isolation: string;
      };
      Resources: {
        Limits: {
          NanoCPUs: number;
          MemoryBytes: number;
        };
        Reservations: {
          NanoCPUs: number;
          MemoryBytes: number;
        };
      };
      RestartPolicy: {
        Condition: string;
        Delay: number;
        MaxAttempts: number;
        Window: number;
      };
      Placement: {
        Constraints: string[];
        Preferences: any[];
        Platforms: any[];
      };
      ForceUpdate: number;
      Runtime: string;
      Networks: any[];
      LogDriver: {
        Name: string;
        Options: Record<string, string>;
      };
    };
    Mode: {
      Replicated: {
        Replicas: number;
      };
    };
    UpdateConfig: {
      Parallelism: number;
      Delay: number;
      FailureAction: string;
      Monitor: number;
      MaxFailureRatio: number;
      Order: string;
    };
    RollbackConfig: {
      Parallelism: number;
      Delay: number;
      FailureAction: string;
      Monitor: number;
      MaxFailureRatio: number;
      Order: string;
    };
    Networks: any[];
    EndpointSpec: {
      Mode: string;
      Ports: any[];
    };
  };
  Endpoint: {
    Spec: {
      Mode: string;
      Ports: any[];
    };
    Ports: any[];
    VirtualIPs: any[];
  };
  UpdateStatus?: {
    State: string;
    StartedAt: string;
    CompletedAt: string;
    Message: string;
  };
}

const DOCKER_URL = "http://localhost:2376";

// Fallback function to check if Docker API is accessible
const checkDockerAPI = async () => {
  try {
    const response = await fetch(`${DOCKER_URL}/version`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

export const useDockerContainers = () => {
  return useQuery({
    queryKey: ["docker-containers"],
    queryFn: async () => {
      try {
        const response = await fetch(`${DOCKER_URL}/containers/json?all=true`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to connect to Docker API on port 2375. Please ensure Docker Desktop is running and the API is exposed. Error: ${errorText}`);
        }

        const containers = await response.json();
        
        return { 
          containers, 
          cached: false, 
          dockerUrl: DOCKER_URL 
        };
      } catch (error) {
        console.error("Error fetching containers:", error);
        throw error;
      }
    },
    refetchInterval: 5000, // Refetch every 5 seconds
  });
};

export const useDockerStats = () => {
  return useQuery({
    queryKey: ["docker-stats"],
    queryFn: async () => {
      try {
        const [infoResponse, versionResponse] = await Promise.all([
          fetch(`${DOCKER_URL}/info`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch(`${DOCKER_URL}/version`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
        ]);

        if (!infoResponse.ok || !versionResponse.ok) {
          throw new Error('Failed to fetch Docker system info');
        }

        const info = await infoResponse.json();
        const version = await versionResponse.json();

        const stats = {
          containers: {
            total: info.Containers || 0,
            running: info.ContainersRunning || 0,
            paused: info.ContainersPaused || 0,
            stopped: info.ContainersStopped || 0,
          },
          images: info.Images || 0,
          memoryTotal: info.MemTotal || 0,
          cpuCount: info.NCPU || 0,
          dockerVersion: version.Version || 'unknown',
          apiVersion: version.ApiVersion || 'unknown',
          os: info.OperatingSystem || 'unknown',
          architecture: info.Architecture || 'unknown',
        };

        return { stats };
      } catch (error) {
        console.error("Error fetching stats:", error);
        throw error;
      }
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};

export const performContainerAction = async (containerId: string, action: "start" | "stop" | "restart") => {
  try {
    const response = await fetch(`${DOCKER_URL}/containers/${containerId}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to ${action} container: ${errorText}`);
    }

    return {
      success: true,
      message: `Container ${action}ed successfully`,
      containerId
    };
  } catch (error) {
    console.error("Error performing container action:", error);
    throw error;
  }
};

// Docker Swarm Hooks
export const useDockerSwarmInfo = () => {
  return useQuery({
    queryKey: ["docker-swarm-info"],
    queryFn: async () => {
      try {
        const response = await fetch(`${DOCKER_URL}/swarm`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          if (response.status === 406) {
            return { swarm: null, error: "Docker Swarm not initialized" };
          }
          if (response.status === 503) {
            return { swarm: null, error: "Docker Swarm not initialized or unavailable" };
          }
          throw new Error('Failed to fetch Swarm info');
        }

        const swarm = await response.json();
        return { swarm, error: null };
      } catch (error) {
        console.error("Error fetching Swarm info:", error);
        return { swarm: null, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },
    refetchInterval: 10000,
    retry: false, // Don't retry on errors to avoid spam
  });
};

// Check if Swarm is already initialized
export const checkSwarmStatus = async () => {
  try {
    const response = await fetch(`${DOCKER_URL}/swarm`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const swarm = await response.json();
      return { isInitialized: true, swarm };
    } else if (response.status === 406 || response.status === 503) {
      return { isInitialized: false, swarm: null };
    } else {
      throw new Error(`Unexpected response: ${response.status}`);
    }
  } catch (error) {
    console.error("Error checking Swarm status:", error);
    return { isInitialized: false, swarm: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const useDockerSwarmNodes = () => {
  return useQuery({
    queryKey: ["docker-swarm-nodes"],
    queryFn: async () => {
      try {
        const response = await fetch(`${DOCKER_URL}/nodes`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          if (response.status === 503) {
            return { nodes: [], error: "Docker Swarm not initialized or unavailable" };
          }
          if (response.status === 406) {
            return { nodes: [], error: "Docker Swarm not initialized" };
          }
          throw new Error(`Failed to fetch Swarm nodes: ${response.status}`);
        }

        const nodes = await response.json();
        return { nodes, error: null };
      } catch (error) {
        console.error("Error fetching Swarm nodes:", error);
        return { nodes: [], error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },
    refetchInterval: 10000,
    retry: false, // Don't retry on errors to avoid spam
  });
};

export const useDockerSwarmServices = () => {
  return useQuery({
    queryKey: ["docker-swarm-services"],
    queryFn: async () => {
      try {
        const response = await fetch(`${DOCKER_URL}/services`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          if (response.status === 503) {
            return { services: [], error: "Docker Swarm not initialized or unavailable" };
          }
          if (response.status === 406) {
            return { services: [], error: "Docker Swarm not initialized" };
          }
          throw new Error(`Failed to fetch Swarm services: ${response.status}`);
        }

        const services = await response.json();
        return { services, error: null };
      } catch (error) {
        console.error("Error fetching Swarm services:", error);
        return { services: [], error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },
    refetchInterval: 5000,
    retry: false, // Don't retry on errors to avoid spam
  });
};

// Swarm Actions
export const initializeSwarm = async (advertiseAddr?: string, listenAddr?: string) => {
  try {
    // Default to localhost with default Swarm port if no addresses provided
    const defaultAdvertiseAddr = advertiseAddr || '127.0.0.1:2377';
    const defaultListenAddr = listenAddr || '0.0.0.0:2377';

    const body = {
      AdvertiseAddr: defaultAdvertiseAddr,
      ListenAddr: defaultListenAddr,
    };

    const response = await fetch(`${DOCKER_URL}/swarm/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorData = JSON.parse(errorText);
      
      if (errorData.message && errorData.message.includes("already part of a swarm")) {
        return {
          success: true,
          message: 'Swarm is already initialized',
          joinToken: null
        };
      }
      
      throw new Error(`Failed to initialize Swarm: ${errorText}`);
    }

    const result = await response.text();
    return {
      success: true,
      message: 'Swarm initialized successfully',
      joinToken: result
    };
  } catch (error) {
    console.error("Error initializing Swarm:", error);
    throw error;
  }
};

export const joinSwarm = async (remoteAddrs: string[], joinToken: string, advertiseAddr?: string, listenAddr?: string) => {
  try {
    const body: any = {
      RemoteAddrs: remoteAddrs,
      JoinToken: joinToken,
      AdvertiseAddr: advertiseAddr || '127.0.0.1:2377',
      ListenAddr: listenAddr || '0.0.0.0:2377',
    };

    const response = await fetch(`${DOCKER_URL}/swarm/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to join Swarm: ${errorText}`);
    }

    return {
      success: true,
      message: 'Successfully joined Swarm'
    };
  } catch (error) {
    console.error("Error joining Swarm:", error);
    throw error;
  }
};

export const leaveSwarm = async (force: boolean = false) => {
  try {
    const response = await fetch(`${DOCKER_URL}/swarm/leave?force=${force}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to leave Swarm: ${errorText}`);
    }

    return {
      success: true,
      message: 'Successfully left Swarm'
    };
  } catch (error) {
    console.error("Error leaving Swarm:", error);
    throw error;
  }
};

export const createSwarmService = async (serviceSpec: Partial<DockerSwarmService['Spec']>) => {
  try {
    const response = await fetch(`${DOCKER_URL}/services/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serviceSpec),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create service: ${errorText}`);
    }

    const result = await response.json();
    return {
      success: true,
      message: 'Service created successfully',
      serviceId: result.ID
    };
  } catch (error) {
    console.error("Error creating service:", error);
    throw error;
  }
};

export const removeSwarmService = async (serviceId: string) => {
  try {
    const response = await fetch(`${DOCKER_URL}/services/${serviceId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to remove service: ${errorText}`);
    }

    return {
      success: true,
      message: 'Service removed successfully'
    };
  } catch (error) {
    console.error("Error removing service:", error);
    throw error;
  }
};

export const scaleSwarmService = async (serviceId: string, replicas: number) => {
  try {
    // First get the current service spec
    const getResponse = await fetch(`${DOCKER_URL}/services/${serviceId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!getResponse.ok) {
      throw new Error('Failed to fetch service details');
    }

    const service = await getResponse.json();
    const currentSpec = service.Spec;
    const version = service.Version?.Index;

    console.log('Service version info:', { version, type: typeof version });

    // Handle different version formats
    let versionNumber: number | null = null;
    
    if (typeof version === 'number' && version > 0) {
      versionNumber = version;
    } else if (typeof version === 'string' && version.trim() !== '') {
      const parsed = parseInt(version.trim());
      if (!isNaN(parsed) && parsed > 0) {
        versionNumber = parsed;
      }
    }

    // If we have a valid version, use it
    if (versionNumber !== null) {
      console.log('Using version number:', versionNumber);
      
      const updatedSpec = {
        ...currentSpec,
        Mode: {
          Replicated: {
            Replicas: replicas
          }
        }
      };

      const response = await fetch(`${DOCKER_URL}/services/${serviceId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updatedSpec,
          Version: versionNumber
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to scale service: ${errorText}`);
      }

      return {
        success: true,
        message: `Service scaled to ${replicas} replicas`
      };
    } else {
      // No valid version available, try alternative approach
      console.warn('No valid service version available, trying alternative scaling method');
      
      // Try to get the service info again to see if we can get a different version format
      const retryResponse = await fetch(`${DOCKER_URL}/services/${serviceId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (retryResponse.ok) {
        const retryService = await retryResponse.json();
        console.log('Retry service version:', retryService.Version);
        
        // Try with the retry version
        const retryVersion = retryService.Version?.Index;
        if (typeof retryVersion === 'number' && retryVersion > 0) {
          const updatedSpec = {
            ...currentSpec,
            Mode: {
              Replicated: {
                Replicas: replicas
              }
            }
          };

          const response = await fetch(`${DOCKER_URL}/services/${serviceId}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...updatedSpec,
              Version: retryVersion
            }),
          });

          if (response.ok) {
            return {
              success: true,
              message: `Service scaled to ${replicas} replicas`
            };
          }
        }
      }
      
      // If all else fails, try without version (some Docker versions allow this)
      console.warn('Attempting to scale without version check');
      const response = await fetch(`${DOCKER_URL}/services/${serviceId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...currentSpec,
          Mode: {
            Replicated: {
              Replicas: replicas
            }
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to scale service: ${errorText}`);
      }

      return {
        success: true,
        message: `Service scaled to ${replicas} replicas`
      };
    }
  } catch (error) {
    console.error("Error scaling service:", error);
    throw error;
  }
};

// Alternative scaling method using service name instead of ID
export const scaleSwarmServiceByName = async (serviceName: string, replicas: number) => {
  try {
    // Get all services to find the one with matching name
    const servicesResponse = await fetch(`${DOCKER_URL}/services`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!servicesResponse.ok) {
      throw new Error('Failed to fetch services');
    }

    const services = await servicesResponse.json();
    const service = services.find((s: any) => s.Spec?.Name === serviceName);

    if (!service) {
      throw new Error(`Service with name '${serviceName}' not found`);
    }

    // Use the regular scaling method with the found service ID
    return await scaleSwarmService(service.ID, replicas);
  } catch (error) {
    console.error("Error scaling service by name:", error);
    throw error;
  }
};

// Direct scaling method that bypasses version issues
export const scaleSwarmServiceDirect = async (serviceId: string, replicas: number) => {
  try {
    console.log(`Attempting direct scaling for service ${serviceId} to ${replicas} replicas`);
    
    // Try a minimal update request without version
    const response = await fetch(`${DOCKER_URL}/services/${serviceId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Mode: {
          Replicated: {
            Replicas: replicas
          }
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Direct scaling failed:', errorText);
      throw new Error(`Failed to scale service: ${errorText}`);
    }

    return {
      success: true,
      message: `Service scaled to ${replicas} replicas`
    };
  } catch (error) {
    console.error("Error in direct scaling:", error);
    throw error;
  }
};