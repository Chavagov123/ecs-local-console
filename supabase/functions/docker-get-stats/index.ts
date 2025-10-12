import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DockerConfig {
  host: string;
  port: number;
  protocol: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching Docker stats...');

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get active Docker configuration
    const { data: config, error: configError } = await supabase
      .from('docker_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: 'No active Docker configuration found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dockerConfig = config as DockerConfig;
    const dockerUrl = `${dockerConfig.protocol}://${dockerConfig.host}:${dockerConfig.port}`;

    // Fetch system info from Docker
    const [infoResponse, versionResponse] = await Promise.all([
      fetch(`${dockerUrl}/info`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }),
      fetch(`${dockerUrl}/version`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }),
    ]);

    if (!infoResponse.ok || !versionResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Docker system info' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    return new Response(
      JSON.stringify({ stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in docker-get-stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        hint: 'Make sure Docker is running and exposed on the configured port'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});