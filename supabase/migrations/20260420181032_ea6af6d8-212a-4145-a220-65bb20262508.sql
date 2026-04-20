-- Flow storage with versioning
CREATE TABLE public.flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Untitled flow',
  platform TEXT NOT NULL DEFAULT 'telegram',
  miniapp_enabled BOOLEAN NOT NULL DEFAULT false,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  preview JSONB NOT NULL DEFAULT '{}'::jsonb,
  miniapp JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_code TEXT NOT NULL DEFAULT '',
  current_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.flow_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  version INT NOT NULL,
  nodes JSONB NOT NULL,
  edges JSONB NOT NULL,
  preview JSONB NOT NULL DEFAULT '{}'::jsonb,
  miniapp JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_code TEXT NOT NULL DEFAULT '',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flow_id, version)
);

CREATE INDEX idx_flow_versions_flow_id ON public.flow_versions(flow_id, version DESC);

-- Public workspace: no auth required for the demo. RLS open for anon.
ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flows_public_read" ON public.flows FOR SELECT USING (true);
CREATE POLICY "flows_public_insert" ON public.flows FOR INSERT WITH CHECK (true);
CREATE POLICY "flows_public_update" ON public.flows FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "flows_public_delete" ON public.flows FOR DELETE USING (true);

CREATE POLICY "flow_versions_public_read" ON public.flow_versions FOR SELECT USING (true);
CREATE POLICY "flow_versions_public_insert" ON public.flow_versions FOR INSERT WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_flows_touch
BEFORE UPDATE ON public.flows
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();