import { supabase } from "@/integrations/supabase/client";
import type { Edge, Node } from "reactflow";
import type { AnvlMiniAppState, AnvlPreviewState } from "./anvl-blueprint";
import type { VariableDef } from "./anvl-types";

export interface FlowSnapshot {
  id: string;
  slug: string;
  title: string;
  platform: string;
  miniappEnabled: boolean;
  nodes: Node[];
  edges: Edge[];
  preview: Partial<AnvlPreviewState>;
  miniapp: Partial<AnvlMiniAppState>;
  generatedCode: string;
  variables: VariableDef[];
  currentVersion: number;
  updatedAt: string;
}

export interface FlowSavePayload {
  slug: string;
  title?: string;
  platform?: string;
  miniappEnabled?: boolean;
  nodes: Node[];
  edges: Edge[];
  preview: Partial<AnvlPreviewState>;
  miniapp: Partial<AnvlMiniAppState>;
  generatedCode: string;
  variables?: VariableDef[];
  /** Owner user id — written only on initial INSERT; ignored on updates by Postgres
   *  (upsert sends it but RLS / app logic doesn't change ownership later). */
  ownerId?: string | null;
}

function rowToSnapshot(row: Record<string, unknown>): FlowSnapshot {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: (row.title as string) ?? "Untitled flow",
    platform: (row.platform as string) ?? "telegram",
    miniappEnabled: !!row.miniapp_enabled,
    nodes: (row.nodes as Node[]) ?? [],
    edges: (row.edges as Edge[]) ?? [],
    preview: (row.preview as Partial<AnvlPreviewState>) ?? {},
    miniapp: (row.miniapp as Partial<AnvlMiniAppState>) ?? {},
    generatedCode: (row.generated_code as string) ?? "",
    variables: (row.variables as VariableDef[]) ?? [],
    currentVersion: (row.current_version as number) ?? 1,
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

export interface FlowVersionRow {
  id: string;
  flowId: string;
  version: number;
  note: string | null;
  createdAt: string;
}

export interface FlowVersionFull extends FlowVersionRow {
  nodes: Node[];
  edges: Edge[];
  preview: Partial<AnvlPreviewState>;
  miniapp: Partial<AnvlMiniAppState>;
  generatedCode: string;
}

/** List all flows ordered by recently updated. */
export async function listFlows(): Promise<FlowSnapshot[]> {
  const { data, error } = await (supabase as any)
    .from("flows")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data as Record<string, unknown>[]) ?? []).map(rowToSnapshot);
}

/** Delete a flow by id (cascade removes versions via FK). */
export async function deleteFlow(id: string): Promise<void> {
  const { error } = await (supabase as any).from("flows").delete().eq("id", id);
  if (error) throw error;
}

/** List versions for a flow (lightweight: no payload). */
export async function listFlowVersions(flowId: string): Promise<FlowVersionRow[]> {
  const { data, error } = await (supabase as any)
    .from("flow_versions")
    .select("id, flow_id, version, note, created_at")
    .eq("flow_id", flowId)
    .order("version", { ascending: false });
  if (error) throw error;
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    id: r.id as string,
    flowId: r.flow_id as string,
    version: r.version as number,
    note: (r.note as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

/** Fetch a single version with full payload for rollback. */
export async function getFlowVersion(versionId: string): Promise<FlowVersionFull | null> {
  const { data, error } = await (supabase as any)
    .from("flow_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: r.id as string,
    flowId: r.flow_id as string,
    version: r.version as number,
    note: (r.note as string | null) ?? null,
    createdAt: r.created_at as string,
    nodes: (r.nodes as Node[]) ?? [],
    edges: (r.edges as Edge[]) ?? [],
    preview: (r.preview as Partial<AnvlPreviewState>) ?? {},
    miniapp: (r.miniapp as Partial<AnvlMiniAppState>) ?? {},
    generatedCode: (r.generated_code as string) ?? "",
  };
}

/** Load flow by slug, or return null if it doesn't exist yet. */
export async function loadFlowBySlug(slug: string): Promise<FlowSnapshot | null> {
  const { data, error } = await (supabase as any)
    .from("flows")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return rowToSnapshot(data);
}

/** Upsert the flow (create on first save, update on subsequent saves). */
export async function upsertFlow(payload: FlowSavePayload): Promise<FlowSnapshot> {
  const row: Record<string, unknown> = {
    slug: payload.slug,
    title: payload.title ?? "Untitled flow",
    platform: payload.platform ?? "telegram",
    miniapp_enabled: payload.miniappEnabled ?? false,
    nodes: payload.nodes,
    edges: payload.edges,
    preview: payload.preview,
    miniapp: payload.miniapp,
    generated_code: payload.generatedCode,
    variables: payload.variables ?? [],
  };
  // Only attach owner_id when explicitly provided — undefined would clobber
  // existing ownership on update via upsert.
  if (payload.ownerId !== undefined) row.owner_id = payload.ownerId;

  const { data, error } = await (supabase as any)
    .from("flows")
    .upsert(row, { onConflict: "slug" })
    .select("*")
    .single();

  if (error) throw error;
  return rowToSnapshot(data);
}

/** Snapshot the current flow into flow_versions. Returns the new version number. */
export async function createFlowVersion(
  flowId: string,
  payload: Omit<FlowSavePayload, "slug">,
  note?: string,
): Promise<number> {
  // Find the next version number
  const { data: latest, error: latestErr } = await (supabase as any)
    .from("flow_versions")
    .select("version")
    .eq("flow_id", flowId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestErr) throw latestErr;
  const nextVersion = ((latest?.version as number | undefined) ?? 0) + 1;

  const { error: insertErr } = await (supabase as any).from("flow_versions").insert({
    flow_id: flowId,
    version: nextVersion,
    nodes: payload.nodes,
    edges: payload.edges,
    preview: payload.preview,
    miniapp: payload.miniapp,
    generated_code: payload.generatedCode,
    note: note ?? null,
  });
  if (insertErr) throw insertErr;

  // Bump current_version on flows
  const { error: bumpErr } = await (supabase as any)
    .from("flows")
    .update({ current_version: nextVersion })
    .eq("id", flowId);
  if (bumpErr) throw bumpErr;

  return nextVersion;
}
