
CREATE TABLE IF NOT EXISTS public.bot_user_state (
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  tg_user_id text NOT NULL,
  vars jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (bot_id, tg_user_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_user_state_bot ON public.bot_user_state(bot_id);

ALTER TABLE public.bot_user_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_user_state_public_read"
  ON public.bot_user_state FOR SELECT
  USING (true);

CREATE POLICY "bot_user_state_public_insert"
  ON public.bot_user_state FOR INSERT
  WITH CHECK (true);

CREATE POLICY "bot_user_state_public_update"
  ON public.bot_user_state FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "bot_user_state_public_delete"
  ON public.bot_user_state FOR DELETE
  USING (true);

CREATE TRIGGER trg_bot_user_state_touch
  BEFORE UPDATE ON public.bot_user_state
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
