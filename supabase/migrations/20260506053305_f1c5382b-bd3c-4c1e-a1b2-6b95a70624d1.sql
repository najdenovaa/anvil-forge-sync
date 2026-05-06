ALTER TABLE public.flows
  ADD COLUMN IF NOT EXISTS variables JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.bot_globals (
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bot_id, key)
);

ALTER TABLE public.bot_globals ENABLE ROW LEVEL SECURITY;

-- TODO(auth): replace with owner-only policies in Step 6 once auth is wired up.
DROP POLICY IF EXISTS "bot_globals_demo_all" ON public.bot_globals;
CREATE POLICY "bot_globals_demo_all" ON public.bot_globals
  FOR ALL USING (true) WITH CHECK (true);