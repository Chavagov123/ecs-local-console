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
    const { containerId, action } = await req.json();
    
    if (!containerId || !action) {
      return new Response(
        JSON.stringify({ error: 'containerId and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['start', 'stop', 'restart'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Must be start, stop, or restart' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Performing ${action} on container ${containerId}`);

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

    // Perform action on Docker container
    const dockerResponse = await fetch(
      `${dockerUrl}/containers/${containerId}/${action}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!dockerResponse.ok) {
      const errorText = await dockerResponse.text();
      console.error('Docker API error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: `Failed to ${action} container`,
          details: errorText
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully performed ${action} on container ${containerId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Container ${action}ed successfully`,
        containerId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in docker-container-action:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});