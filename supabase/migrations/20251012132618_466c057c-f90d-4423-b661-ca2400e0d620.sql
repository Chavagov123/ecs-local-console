-- Create table for Docker connection configuration
CREATE TABLE IF NOT EXISTS public.docker_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  host TEXT NOT NULL DEFAULT 'localhost',
  port INTEGER NOT NULL DEFAULT 2375,
  protocol TEXT NOT NULL DEFAULT 'http',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for caching container data
CREATE TABLE IF NOT EXISTS public.containers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image TEXT,
  status TEXT,
  state TEXT,
  created BIGINT,
  labels JSONB,
  ports JSONB,
  config_id UUID REFERENCES public.docker_config(id),
  last_synced TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.docker_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.containers ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth required for local development)
CREATE POLICY "Allow public read access to docker_config"
  ON public.docker_config FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to docker_config"
  ON public.docker_config FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to docker_config"
  ON public.docker_config FOR UPDATE
  USING (true);

CREATE POLICY "Allow public read access to containers"
  ON public.containers FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to containers"
  ON public.containers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to containers"
  ON public.containers FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access to containers"
  ON public.containers FOR DELETE
  USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for docker_config
CREATE TRIGGER update_docker_config_updated_at
  BEFORE UPDATE ON public.docker_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default local Docker configuration
INSERT INTO public.docker_config (name, host, port, protocol, is_active)
VALUES ('Local Docker', 'host.docker.internal', 2375, 'http', true)
ON CONFLICT DO NOTHING;