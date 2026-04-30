-- Bots table
CREATE TABLE public.bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('telegram', 'max')),
  bot_token_encrypted TEXT NOT NULL,
  bot_username TEXT,
  webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'error')),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bots_flow_id ON public.bots(flow_id);

ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bots_public_read" ON public.bots FOR SELECT USING (true);
CREATE POLICY "bots_public_insert" ON public.bots FOR INSERT WITH CHECK (true);
CREATE POLICY "bots_public_update" ON public.bots FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "bots_public_delete" ON public.bots FOR DELETE USING (true);

CREATE TRIGGER bots_touch_updated_at
  BEFORE UPDATE ON public.bots
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Bot sessions (per-chat state)
CREATE TABLE public.bot_sessions (
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  current_node_id TEXT,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bot_id, chat_id)
);

ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_sessions_public_read" ON public.bot_sessions FOR SELECT USING (true);
CREATE POLICY "bot_sessions_public_insert" ON public.bot_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "bot_sessions_public_update" ON public.bot_sessions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "bot_sessions_public_delete" ON public.bot_sessions FOR DELETE USING (true);

-- Bot events (audit log)
CREATE TABLE public.bot_events (
  id BIGSERIAL PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  chat_id TEXT,
  event_type TEXT NOT NULL,
  node_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_events_bot_created ON public.bot_events(bot_id, created_at DESC);

ALTER TABLE public.bot_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_events_public_read" ON public.bot_events FOR SELECT USING (true);
CREATE POLICY "bot_events_public_insert" ON public.bot_events FOR INSERT WITH CHECK (true);