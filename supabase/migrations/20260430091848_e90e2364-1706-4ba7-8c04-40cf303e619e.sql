ALTER TABLE public.bot_sessions
  ADD COLUMN IF NOT EXISTS last_reply_keyboard JSONB NOT NULL DEFAULT '[]'::jsonb;