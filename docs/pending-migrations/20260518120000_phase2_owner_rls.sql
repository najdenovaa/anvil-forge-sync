-- Phase 2: переключаем RLS с публичной на owner-based.
-- ВАЖНО: применить только после того как все orphan flows и bots
-- привязаны к owner-у. Иначе они станут невидимы.
-- Проверка перед запуском (должно вернуть 0):
--   SELECT count(*) FROM public.flows WHERE owner_id IS NULL;
--   SELECT count(*) FROM public.bots  WHERE owner_id IS NULL;
--
-- НЕ применяется автоматически — лежит вне supabase/migrations/.
-- Запускать вручную через SQL Editor в Supabase Dashboard.

DROP POLICY IF EXISTS "flows_public_read"   ON public.flows;
DROP POLICY IF EXISTS "flows_public_insert" ON public.flows;
DROP POLICY IF EXISTS "flows_public_update" ON public.flows;
DROP POLICY IF EXISTS "flows_public_delete" ON public.flows;

DROP POLICY IF EXISTS "bots_public_read"   ON public.bots;
DROP POLICY IF EXISTS "bots_public_insert" ON public.bots;
DROP POLICY IF EXISTS "bots_public_update" ON public.bots;
DROP POLICY IF EXISTS "bots_public_delete" ON public.bots;

CREATE POLICY "flows_owner_select" ON public.flows
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "flows_owner_insert" ON public.flows
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "flows_owner_update" ON public.flows
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "flows_owner_delete" ON public.flows
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "bots_owner_select" ON public.bots
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "bots_owner_insert" ON public.bots
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "bots_owner_update" ON public.bots
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "bots_owner_delete" ON public.bots
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Public anon SELECT на flows — для Mini App route /m/$flowId.
-- TODO: ужесточить через VIEW или RPC которые отдают только поле miniapp.
CREATE POLICY "flows_public_miniapp_read" ON public.flows
  FOR SELECT TO anon USING (true);
