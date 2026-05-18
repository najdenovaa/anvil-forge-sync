-- ============================================================
-- bot_submissions: лента заявок/записей, которые бот собирает у пользователей
-- ============================================================
CREATE TABLE public.bot_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL,
  flow_id uuid NOT NULL,
  owner_id uuid,
  tg_user_id text,
  tg_chat_id text NOT NULL,
  tg_username text,
  tg_user_full_name text,
  kind text NOT NULL DEFAULT 'lead',
  status text NOT NULL DEFAULT 'new',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_node_id text,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_submissions_bot_created ON public.bot_submissions (bot_id, created_at DESC);
CREATE INDEX idx_bot_submissions_flow_created ON public.bot_submissions (flow_id, created_at DESC);
CREATE INDEX idx_bot_submissions_owner ON public.bot_submissions (owner_id);
CREATE INDEX idx_bot_submissions_status ON public.bot_submissions (status);

ALTER TABLE public.bot_submissions ENABLE ROW LEVEL SECURITY;

-- Owner-based policies (соответствует курсу на Phase 2 — owner-only)
CREATE POLICY "submissions_owner_select" ON public.bot_submissions
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "submissions_owner_insert" ON public.bot_submissions
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);

CREATE POLICY "submissions_owner_update" ON public.bot_submissions
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "submissions_owner_delete" ON public.bot_submissions
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Триггеры: owner_id из JWT и updated_at
CREATE TRIGGER trg_bot_submissions_set_owner
  BEFORE INSERT ON public.bot_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_from_jwt();

CREATE TRIGGER trg_bot_submissions_touch
  BEFORE UPDATE ON public.bot_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- bot_admin_chats: куда слать уведомления о новых заявках
-- ============================================================
CREATE TABLE public.bot_admin_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL,
  owner_id uuid,
  tg_chat_id text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, tg_chat_id)
);

CREATE INDEX idx_bot_admin_chats_bot ON public.bot_admin_chats (bot_id);
CREATE INDEX idx_bot_admin_chats_owner ON public.bot_admin_chats (owner_id);

ALTER TABLE public.bot_admin_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_chats_owner_select" ON public.bot_admin_chats
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "admin_chats_owner_insert" ON public.bot_admin_chats
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);

CREATE POLICY "admin_chats_owner_update" ON public.bot_admin_chats
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "admin_chats_owner_delete" ON public.bot_admin_chats
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER trg_bot_admin_chats_set_owner
  BEFORE INSERT ON public.bot_admin_chats
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_from_jwt();

CREATE TRIGGER trg_bot_admin_chats_touch
  BEFORE UPDATE ON public.bot_admin_chats
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();