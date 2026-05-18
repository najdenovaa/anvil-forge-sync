-- =========================================================
-- bot_broadcasts
-- =========================================================
CREATE TABLE public.bot_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL,
  flow_id uuid NOT NULL,
  owner_id uuid,
  text text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_count integer NOT NULL DEFAULT 0,
  fail_count integer NOT NULL DEFAULT 0,
  recipients_total integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX bot_broadcasts_bot_id_idx ON public.bot_broadcasts (bot_id, created_at DESC);
CREATE INDEX bot_broadcasts_owner_idx ON public.bot_broadcasts (owner_id);

ALTER TABLE public.bot_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY broadcasts_owner_select ON public.bot_broadcasts
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY broadcasts_owner_insert ON public.bot_broadcasts
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);
CREATE POLICY broadcasts_owner_update ON public.bot_broadcasts
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY broadcasts_owner_delete ON public.bot_broadcasts
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TRIGGER bot_broadcasts_set_owner
  BEFORE INSERT ON public.bot_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_from_jwt();

CREATE TRIGGER bot_broadcasts_touch
  BEFORE UPDATE ON public.bot_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- bot_globals: add owner_id + label, tighten RLS
-- =========================================================
ALTER TABLE public.bot_globals
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();

-- Drop legacy demo-all policy
DROP POLICY IF EXISTS bot_globals_demo_all ON public.bot_globals;

CREATE POLICY bot_globals_owner_select ON public.bot_globals
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY bot_globals_owner_insert ON public.bot_globals
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);
CREATE POLICY bot_globals_owner_update ON public.bot_globals
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY bot_globals_owner_delete ON public.bot_globals
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

DROP TRIGGER IF EXISTS bot_globals_set_owner ON public.bot_globals;
CREATE TRIGGER bot_globals_set_owner
  BEFORE INSERT ON public.bot_globals
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_from_jwt();
