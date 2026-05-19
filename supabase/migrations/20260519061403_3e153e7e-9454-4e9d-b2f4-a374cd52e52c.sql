CREATE POLICY flows_anon_miniapp_read ON public.flows
  FOR SELECT
  TO anon
  USING (true);