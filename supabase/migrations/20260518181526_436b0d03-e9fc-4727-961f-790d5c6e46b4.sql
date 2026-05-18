-- Phase 2: bind orphans to the sole owner and lock down flows/bots with owner-scoped RLS
DO $$
DECLARE
  v_owner uuid := 'e5908d57-7789-4d38-baad-e076c3f92ce6';
BEGIN
  UPDATE public.flows SET owner_id = v_owner WHERE owner_id IS NULL;
  UPDATE public.bots  SET owner_id = v_owner WHERE owner_id IS NULL;
END $$;

-- ===== flows =====
DROP POLICY IF EXISTS flows_public_read   ON public.flows;
DROP POLICY IF EXISTS flows_public_insert ON public.flows;
DROP POLICY IF EXISTS flows_public_update ON public.flows;
DROP POLICY IF EXISTS flows_public_delete ON public.flows;

CREATE POLICY flows_owner_select ON public.flows
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY flows_owner_insert ON public.flows
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);
CREATE POLICY flows_owner_update ON public.flows
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY flows_owner_delete ON public.flows
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

DROP TRIGGER IF EXISTS flows_set_owner ON public.flows;
CREATE TRIGGER flows_set_owner BEFORE INSERT ON public.flows
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_from_jwt();

-- ===== bots =====
DROP POLICY IF EXISTS bots_public_read   ON public.bots;
DROP POLICY IF EXISTS bots_public_insert ON public.bots;
DROP POLICY IF EXISTS bots_public_update ON public.bots;
DROP POLICY IF EXISTS bots_public_delete ON public.bots;

CREATE POLICY bots_owner_select ON public.bots
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY bots_owner_insert ON public.bots
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);
CREATE POLICY bots_owner_update ON public.bots
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY bots_owner_delete ON public.bots
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

DROP TRIGGER IF EXISTS bots_set_owner ON public.bots;
CREATE TRIGGER bots_set_owner BEFORE INSERT ON public.bots
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_from_jwt();

-- ===== flow_versions: gate by parent flow ownership =====
DROP POLICY IF EXISTS flow_versions_public_read   ON public.flow_versions;
DROP POLICY IF EXISTS flow_versions_public_insert ON public.flow_versions;

CREATE POLICY flow_versions_owner_select ON public.flow_versions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flows f WHERE f.id = flow_versions.flow_id AND f.owner_id = auth.uid()));
CREATE POLICY flow_versions_owner_insert ON public.flow_versions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.flows f WHERE f.id = flow_versions.flow_id AND f.owner_id = auth.uid()));
