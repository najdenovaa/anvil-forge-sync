import { supabase } from "@/integrations/supabase/client";
import type { Edge, Node } from "reactflow";
import type { AnvlMiniAppState, AnvlPreviewState } from "./anvl-blueprint";

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
    currentVersion: (row.current_version as number) ?? 1,
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
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
  const { data, error } = await (supabase as any)
    .from("flows")
    .upsert(
      {
        slug: payload.slug,
        title: payload.title ?? "Untitled flow",
        platform: payload.platform ?? "telegram",
        miniapp_enabled: payload.miniappEnabled ?? false,
        nodes: payload.nodes,
        edges: payload.edges,
        preview: payload.preview,
        miniapp: payload.miniapp,
        generated_code: payload.generatedCode,
      },
      { onConflict: "slug" },
    )
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
