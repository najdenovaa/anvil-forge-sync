CREATE OR REPLACE FUNCTION public.set_owner_from_jwt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_flows_set_owner ON public.flows;
CREATE TRIGGER trg_flows_set_owner
  BEFORE INSERT ON public.flows
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_from_jwt();

DROP TRIGGER IF EXISTS trg_bots_set_owner ON public.bots;
CREATE TRIGGER trg_bots_set_owner
  BEFORE INSERT ON public.bots
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_from_jwt();