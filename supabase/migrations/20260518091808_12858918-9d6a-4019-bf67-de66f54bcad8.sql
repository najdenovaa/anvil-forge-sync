-- Phase 1: add owner_id columns. RLS остаётся публичной до claim.

ALTER TABLE public.flows
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_flows_owner_id ON public.flows(owner_id);
CREATE INDEX IF NOT EXISTS idx_bots_owner_id  ON public.bots(owner_id);