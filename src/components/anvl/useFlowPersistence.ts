import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Edge, Node } from "reactflow";
import {
  createFlowVersion,
  loadFlowBySlug,
  upsertFlow,
  type FlowSavePayload,
  type FlowSnapshot,
} from "@/lib/anvl-flow-storage";
import type { AnvlMiniAppState, AnvlPreviewState } from "@/lib/anvl-blueprint";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseFlowPersistenceArgs {
  slug: string;
  nodes: Node[];
  edges: Edge[];
  preview: Partial<AnvlPreviewState>;
  miniapp: Partial<AnvlMiniAppState>;
  generatedCode: string;
  /** Called once after the initial load — used to hydrate the workspace state. */
  onHydrate: (snapshot: FlowSnapshot) => void;
  /** Disable persistence (e.g. while still on landing). */
  enabled?: boolean;
}

const AUTOSAVE_DEBOUNCE_MS = 1200;
const VERSION_INTERVAL_MS = 30_000;

export function useFlowPersistence({
  slug,
  nodes,
  edges,
  preview,
  miniapp,
  generatedCode,
  onHydrate,
  enabled = true,
}: UseFlowPersistenceArgs) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const hydratedRef = useRef(false);
  const lastVersionAtRef = useRef<number>(0);
  const debounceRef = useRef<number | null>(null);
  const flowIdRef = useRef<string | null>(null);

  const queryKey = useMemo(() => ["anvl-flow", slug] as const, [slug]);

  // Initial load
  const { data: snapshot } = useQuery({
    queryKey,
    queryFn: () => loadFlowBySlug(slug),
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!snapshot || hydratedRef.current) return;
    flowIdRef.current = snapshot.id;
    hydratedRef.current = true;
    onHydrate(snapshot);
  }, [snapshot, onHydrate]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: FlowSavePayload) => {
      const saved = await upsertFlow(payload);
      flowIdRef.current = saved.id;

      // Snapshot a version every VERSION_INTERVAL_MS
      const now = Date.now();
      if (now - lastVersionAtRef.current > VERSION_INTERVAL_MS) {
        try {
          await createFlowVersion(saved.id, {
            nodes: payload.nodes,
            edges: payload.edges,
            preview: payload.preview,
            miniapp: payload.miniapp,
            generatedCode: payload.generatedCode,
          });
          lastVersionAtRef.current = now;
        } catch (err) {
          // Don't fail the save if versioning fails
          console.warn("Failed to create flow version:", err);
        }
      }
      return saved;
    },
    onMutate: () => setStatus("saving"),
    onSuccess: (saved) => {
      setStatus("saved");
      setLastSavedAt(new Date());
      queryClient.setQueryData(queryKey, saved);
    },
    onError: (err) => {
      console.error("Flow autosave failed:", err);
      setStatus("error");
    },
  });

  // Debounced autosave whenever inputs change (after hydration)
  useEffect(() => {
    if (!enabled) return;
    if (!hydratedRef.current && snapshot !== null) return;

    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      saveMutation.mutate({
        slug,
        nodes,
        edges,
        preview,
        miniapp,
        generatedCode,
      });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, slug, nodes, edges, preview, miniapp, generatedCode, snapshot]);

  return {
    status,
    lastSavedAt,
    snapshot,
    flowId: flowIdRef.current,
    /** Force a snapshot version right now. */
    snapshotNow: async (note?: string) => {
      if (!flowIdRef.current) return;
      await createFlowVersion(
        flowIdRef.current,
        { nodes, edges, preview, miniapp, generatedCode },
        note,
      );
      lastVersionAtRef.current = Date.now();
    },
  };
}
