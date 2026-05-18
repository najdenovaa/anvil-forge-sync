ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS owner_tg_username text,
  ADD COLUMN IF NOT EXISTS owner_tg_user_id text;

CREATE INDEX IF NOT EXISTS idx_bots_owner_tg_user_id ON public.bots(owner_tg_user_id);