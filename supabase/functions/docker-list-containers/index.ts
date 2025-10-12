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
    console.log('Fetching Docker containers...');
    
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
      console.error('Config error:', configError);
      return new Response(
        JSON.stringify({ error: 'No active Docker configuration found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dockerConfig = config as DockerConfig;
    const dockerUrl = `${dockerConfig.protocol}://${dockerConfig.host}:${dockerConfig.port}`;
    
    console.log('Connecting to Docker at:', dockerUrl);

    // Fetch containers from Docker API
    const dockerResponse = await fetch(`${dockerUrl}/containers/json?all=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!dockerResponse.ok) {
      const errorText = await dockerResponse.text();
      console.error('Docker API error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to connect to Docker',
          details: errorText,
          dockerUrl: dockerUrl
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const containers = await dockerResponse.json();
    console.log(`Found ${containers.length} containers`);

    // Cache containers in database
    for (const container of containers) {
      const containerData = {
        id: container.Id,
        name: container.Names[0]?.replace('/', '') || 'unknown',
        image: container.Image,
        status: container.Status,
        state: container.State,
        created: container.Created,
        labels: container.Labels || {},
        ports: container.Ports || [],
        config_id: config.id,
        last_synced: new Date().toISOString(),
      };

      await supabase
        .from('containers')
        .upsert(containerData, { onConflict: 'id' });
    }

    return new Response(
      JSON.stringify({ 
        containers,
        cached: true,
        dockerUrl: dockerUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in docker-list-containers:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        hint: 'Make sure Docker is running and exposed on the configured port (default: 2375)'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});