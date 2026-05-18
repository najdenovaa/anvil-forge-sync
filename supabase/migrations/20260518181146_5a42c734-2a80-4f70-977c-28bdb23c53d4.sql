ALTER TABLE public.bot_submissions
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

ALTER TABLE public.bot_submissions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_submissions;