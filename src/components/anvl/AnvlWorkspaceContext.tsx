import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Edge, Node } from "reactflow";
import type {
  AnvlBlueprint,
  AnvlMiniAppState,
  AnvlPreviewState,
  MiniAppCart,
  MiniAppHero,
  MiniAppItem,
  MiniAppPlanCard,
  MiniAppStat,
  MiniAppTabSpec,
} from "@/lib/anvl-blueprint";
import type { VariableDef } from "@/lib/anvl-types";
import { lintFlow, type LintIssue } from "@/lib/flow-linter";
import { useFlowPersistence, type SaveStatus } from "./useFlowPersistence";
import type { FlowSnapshot, FlowVersionFull } from "@/lib/anvl-flow-storage";
import { autoLayout } from "@/lib/anvl-autolayout";
import { usePlatform } from "./PlatformContext";

const DEFAULT_FLOW_SLUG = "default";

const initialNodes: Node[] = [
  {
    id: "1",
    type: "anvl",
    position: { x: 40, y: 120 },
    data: {
      kind: "trigger.command",
      titleKey: "canvas.start.title",
      previewKey: "canvas.start.preview",
    },
  },
  {
    id: "2",
    type: "anvl",
    position: { x: 320, y: 80 },
    data: {
      kind: "message.text",
      titleKey: "canvas.welcome.title",
      previewKey: "canvas.welcome.preview",
    },
  },
  {
    id: "3",
    type: "anvl",
    position: { x: 320, y: 240 },
    data: {
      kind: "keyboard.inline",
      titleKey: "canvas.menu.title",
      previewKey: "canvas.menu.preview",
    },
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  { id: "e1-3", source: "1", target: "3", animated: true },
];

type MenuButton = { label: string; action: string };

function parseMenuButtons(raw: unknown): MenuButton[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((b: any) => ({
        label: String(b?.label ?? b?.text ?? b?.title ?? "").trim(),
        action: String(b?.action ?? b?.callback_data ?? b?.value ?? "").trim(),
      }))
      .filter((b) => b.label);
  }
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      return parseMenuButtons(JSON.parse(s));
    } catch {
      /* fallthrough */
    }
  }
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, action] = line.split("|").map((p) => p.trim());
      return { label, action: action || label };
    });
}

function serializeMenuButtons(buttons: MenuButton[]): string {
  return JSON.stringify(buttons);
}

interface WorkspaceCtx {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  preview: Partial<AnvlPreviewState>;
  miniApp: Partial<AnvlMiniAppState>;
  generatedCode: string;
  setGeneratedCode: React.Dispatch<React.SetStateAction<string>>;
  variables: VariableDef[];
  setVariables: React.Dispatch<React.SetStateAction<VariableDef[]>>;
  applyBlueprint: (blueprint: AnvlBlueprint) => void;
  /** Tool-calling primitives — incremental mutations from the AI agent. */
  addAiNode: (id: string, kind: string, title: string, preview: string) => void;
  connectAiNodes: (from: string, to: string, sourceHandle?: string) => void;
  updateAiNodeParam: (id: string, key: string, value: string) => void;
  removeAiNode: (id: string) => void;
  removeAiEdge: (from: string, to: string, sourceHandle?: string) => void;
  renameAiNode: (id: string, label: string) => void;
  addMenuSection: (args: {
    menu_id: string;
    menu_msg_id: string;
    button_label: string;
    callback_data: string;
    content_kind: "text" | "photo";
    content: string;
    section_id: string;
    back_label?: string;
  }) => void;
  removeMenuSection: (args: { menu_id: string; section_msg_id: string }) => void;
  updateMenuSection: (args: {
    menu_id: string;
    section_msg_id: string;
    new_button_label?: string;
    new_content?: string;
  }) => void;
  /**
   * Atomically create a webapp-data handler: a `trigger.webapp_data` node
   * filtering on `action`, plus a `message.text` reply, plus an edge between
   * them. Used by the architect to wire up Mini App → bot response in one
   * shot (e.g. user submits a cart, bot replies "Thanks for your order…").
   */
  addWebappHandler: (args: { handler_id: string; action: string; response_text: string }) => void;
  serializeCanvas: () => {
    nodes: { id: string; kind: string; label: string; params: Record<string, string> }[];
    edges: { from: string; to: string; sourceHandle: string | null }[];
    variables: VariableDef[];
  };
  mergePreview: (patch: Partial<AnvlPreviewState>) => void;
  mergeMiniApp: (patch: Partial<AnvlMiniAppState>) => void;
  initMiniApp: (args: {
    title: string;
    subtitle?: string;
    accent?: AnvlMiniAppState["accent"];
    accentHex?: string;
    layout?: AnvlMiniAppState["layout"];
    itemsLabel?: string;
    theme?: "light" | "dark";
  }) => void;
  setMiniAppHero: (hero: MiniAppHero) => void;
  setMiniAppStats: (stats: MiniAppStat[]) => void;
  setMiniAppTabs: (tabs: MiniAppTabSpec[]) => void;
  addMiniAppItem: (item: MiniAppItem) => void;
  addMiniAppPlan: (plan: MiniAppPlanCard) => void;
  clearMiniAppItems: () => void;
  clearMiniAppPlans: () => void;
  setMiniAppCart: (cart: Partial<MiniAppCart>) => void;
  resetAiCanvas: () => void;
  relayoutCanvas: () => void;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  snapshotNow: (note?: string) => Promise<void>;
  flowId: string | null;
  slug: string;
  rollbackToVersion: (version: FlowVersionFull) => void;
  lintIssues: LintIssue[];
}

const Ctx = createContext<WorkspaceCtx | null>(null);

export function AnvlWorkspaceProvider({
  children,
  slug = DEFAULT_FLOW_SLUG,
  persist = true,
  autoCreate = false,
  onFlowCreated,
}: {
  children: ReactNode;
  slug?: string;
  persist?: boolean;
  autoCreate?: boolean;
  onFlowCreated?: (slug: string) => void;
}) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [preview, setPreview] = useState<Partial<AnvlPreviewState>>({});
  const [miniApp, setMiniApp] = useState<Partial<AnvlMiniAppState>>({});
  const [generatedCode, setGeneratedCode] = useState("");
  const [variables, setVariables] = useState<VariableDef[]>([]);
  const { miniAppEnabled, setMiniAppEnabled } = usePlatform();
  const hydratedSlugRef = useRef<string | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const applyBlueprint = useCallback((blueprint: AnvlBlueprint) => {
    if (blueprint.nodes?.length) {
      const nextNodes: Node[] = blueprint.nodes.map((node, index) => ({
        id: `ai-${index + 1}`,
        type: "anvl",
        position: {
          x: 40 + Math.floor(index / 2) * 280,
          y: 90 + (index % 2) * 170,
        },
        data: {
          kind: node.kind,
          title: node.title,
          preview: node.preview,
        },
      }));

      const nextEdges: Edge[] = (
        blueprint.edges?.length
          ? blueprint.edges
          : nextNodes.slice(1).map((_, index) => ({ from: index, to: index + 1 }))
      )
        .filter((edge) => nextNodes[edge.from] && nextNodes[edge.to])
        .map((edge, index) => ({
          id: `ai-edge-${index + 1}`,
          source: nextNodes[edge.from].id,
          target: nextNodes[edge.to].id,
          animated: true,
        }));

      setNodes(nextNodes);
      setEdges(nextEdges);
    }

    if (blueprint.preview) {
      setPreview((current) => ({ ...current, ...blueprint.preview }));
    }

    if (blueprint.miniapp) {
      setMiniApp((current) => ({ ...current, ...blueprint.miniapp }));
    }
  }, []);

  const hydrate = useCallback(
    (snap: FlowSnapshot) => {
      hydratedSlugRef.current = snap.slug;
      setNodes(snap.nodes?.length ? snap.nodes : initialNodes);
      setEdges(snap.edges?.length ? snap.edges : initialEdges);
      setPreview(snap.preview ?? {});
      setMiniApp(snap.miniapp ?? {});
      setGeneratedCode(snap.generatedCode ?? "");
      setVariables(snap.variables ?? []);
      // Sync the workspace-level Mini App toggle with what's stored in the DB
      // so the Architect knows whether to keep building Mini App content.
      setMiniAppEnabled(!!snap.miniappEnabled);
    },
    [setMiniAppEnabled],
  );

  const rollbackToVersion = useCallback((version: FlowVersionFull) => {
    setNodes(version.nodes ?? []);
    setEdges(version.edges ?? []);
    setPreview(version.preview ?? {});
    setMiniApp(version.miniapp ?? {});
    setGeneratedCode(version.generatedCode ?? "");
  }, []);

  const resetAiCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, []);

  const relayoutCanvas = useCallback(() => {
    setNodes((ns) => {
      // We need current edges; read via setEdges identity callback.
      let currentEdges: Edge[] = [];
      setEdges((es) => {
        currentEdges = es;
        return es;
      });
      return autoLayout(ns, currentEdges);
    });
  }, []);

  const addAiNode = useCallback((id: string, kind: string, title: string, preview: string) => {
    setNodes((prev) => {
      if (prev.some((n) => n.id === id)) return prev;
      const idx = prev.length;
      return [
        ...prev,
        {
          id,
          type: "anvl",
          position: { x: 40 + Math.floor(idx / 2) * 280, y: 90 + (idx % 2) * 170 },
          data: { kind, title, preview, params: {} },
        },
      ];
    });
  }, []);

  const connectAiNodes = useCallback((from: string, to: string, sourceHandle?: string) => {
    const eid = sourceHandle ? `ai-${from}-${sourceHandle}-${to}` : `ai-${from}-${to}`;
    setEdges((prev) =>
      prev.some((e) => e.id === eid)
        ? prev
        : [...prev, { id: eid, source: from, target: to, animated: true, sourceHandle }],
    );
  }, []);

  const updateAiNodeParam = useCallback((id: string, key: string, value: string) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, params: { ...(n.data?.params ?? {}), [key]: value } } }
          : n,
      ),
    );
  }, []);

  const removeAiNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
  }, []);

  const removeAiEdge = useCallback((from: string, to: string, sourceHandle?: string) => {
    setEdges((prev) =>
      prev.filter(
        (e) =>
          !(
            e.source === from &&
            e.target === to &&
            (sourceHandle === undefined || (e.sourceHandle ?? undefined) === sourceHandle)
          ),
      ),
    );
  }, []);

  const renameAiNode = useCallback((id: string, label: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, title: label, label } } : n)),
    );
  }, []);

  // ── Composite menu-section helpers ────────────────────────────────────
  // Architecture: keyboard.inline is TERMINAL in bot-runtime. Routing on tap
  // happens via trigger.callback nodes whose params.data matches the button's
  // action/callback_data. addMenuSection therefore creates:
  //   trigger.callback(data=callback_data) → section_msg → back_kb
  //   trigger.callback(data="back_to_menu") → menu_msg → menu_kb  [shared]
  // and adds {label, action: callback_data} to the menu's buttons.
  const addMenuSection = useCallback(
    (args: {
      menu_id: string;
      menu_msg_id: string;
      button_label: string;
      callback_data: string;
      content_kind: "text" | "photo";
      content: string;
      section_id: string;
      back_label?: string;
    }) => {
      const msgId = `${args.section_id}_msg`;
      const backKbId = `${args.section_id}_back_kb`;
      const sectionTrigId = `${args.section_id}_trig`;
      const backTrigId = `${args.menu_id}_back_trig`;
      const backLabel = args.back_label ?? "« Назад в меню";
      const cb = args.callback_data.slice(0, 64);
      const msgKind = args.content_kind === "photo" ? "message.photo" : "message.text";
      const contentKey = args.content_kind === "photo" ? "url" : "text";

      setNodes((prev) => {
        const menu = prev.find((n) => n.id === args.menu_id);
        if (!menu || menu.data?.kind !== "keyboard.inline") {
          console.warn("addMenuSection: menu_id not found or not keyboard.inline", args.menu_id);
          return prev;
        }
        const menuMsg = prev.find((n) => n.id === args.menu_msg_id);
        if (!menuMsg) {
          console.warn("addMenuSection: menu_msg_id not found", args.menu_msg_id);
          return prev;
        }
        if (prev.some((n) => n.id === msgId) || prev.some((n) => n.id === backKbId)) {
          console.warn("addMenuSection: section nodes already exist", msgId);
          return prev;
        }
        const baseIdx = prev.length;
        const existing = parseMenuButtons((menu.data?.params as any)?.buttons);
        const nextButtons = serializeMenuButtons([
          ...existing,
          { label: args.button_label, action: cb },
        ]);
        const backButtons = serializeMenuButtons([{ label: backLabel, action: "back_to_menu" }]);

        const updated = prev.map((n) =>
          n.id === args.menu_id
            ? {
                ...n,
                data: {
                  ...n.data,
                  params: {
                    ...((n.data?.params as Record<string, string>) ?? {}),
                    buttons: nextButtons,
                  },
                },
              }
            : n,
        );

        const newNodes: Node[] = [
          {
            id: sectionTrigId,
            type: "anvl",
            position: { x: 40 + Math.floor(baseIdx / 2) * 280, y: 90 + (baseIdx % 2) * 170 },
            data: {
              kind: "trigger.callback",
              title: `Тап «${args.button_label}»`,
              preview: `data: ${cb}`,
              params: { data: cb },
            },
          },
          {
            id: msgId,
            type: "anvl",
            position: {
              x: 40 + Math.floor((baseIdx + 1) / 2) * 280,
              y: 90 + ((baseIdx + 1) % 2) * 170,
            },
            data: {
              kind: msgKind,
              title: args.button_label,
              preview: args.content.slice(0, 80),
              params: { [contentKey]: args.content },
            },
          },
          {
            id: backKbId,
            type: "anvl",
            position: {
              x: 40 + Math.floor((baseIdx + 2) / 2) * 280,
              y: 90 + ((baseIdx + 2) % 2) * 170,
            },
            data: {
              kind: "keyboard.inline",
              title: `Назад → ${args.menu_id}`,
              preview: backLabel,
              params: { buttons: backButtons },
            },
          },
        ];
        // Shared back-trigger: only add once per menu.
        if (!updated.some((n) => n.id === backTrigId)) {
          newNodes.push({
            id: backTrigId,
            type: "anvl",
            position: {
              x: 40 + Math.floor((baseIdx + 3) / 2) * 280,
              y: 90 + ((baseIdx + 3) % 2) * 170,
            },
            data: {
              kind: "trigger.callback",
              title: "Тап «Назад в меню»",
              preview: "data: back_to_menu",
              params: { data: "back_to_menu" },
            },
          });
        }

        return [...updated, ...newNodes];
      });

      setEdges((prev) => {
        const next = [...prev];
        const add = (from: string, to: string) => {
          const eid = `ai-${from}-${to}`;
          if (!next.some((e) => e.id === eid)) {
            next.push({ id: eid, source: from, target: to, animated: true });
          }
        };
        add(sectionTrigId, msgId);
        add(msgId, backKbId);
        // Shared back wiring (idempotent).
        add(backTrigId, args.menu_msg_id);
        // Ensure menu_msg → menu_kb edge exists so lookahead picks the menu.
        add(args.menu_msg_id, args.menu_id);
        return next;
      });
    },
    [],
  );

  const removeMenuSection = useCallback((args: { menu_id: string; section_msg_id: string }) => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    // Derive sibling ids by convention; fall back to edge walk if missing.
    const sectionId = args.section_msg_id.replace(/_msg$/, "");
    const sectionTrigId = `${sectionId}_trig`;
    const backKbByConv = `${sectionId}_back_kb`;

    const backKbId =
      (currentNodes.find((n) => n.id === backKbByConv) ? backKbByConv : null) ??
      currentEdges.find(
        (e) =>
          e.source === args.section_msg_id &&
          currentNodes.find((n) => n.id === e.target)?.data?.kind === "keyboard.inline",
      )?.target ??
      null;

    // Find the callback_data this section is bound to (params.data on its
    // trigger.callback node, if present) so we can drop the matching button.
    const sectionTrig = currentNodes.find((n) => n.id === sectionTrigId);
    const callbackData =
      (sectionTrig?.data?.params as Record<string, string> | undefined)?.data ?? null;

    const dropIds = new Set(
      [args.section_msg_id, backKbId, sectionTrigId].filter((x): x is string => !!x),
    );

    setNodes((prev) =>
      prev
        .filter((n) => !dropIds.has(n.id))
        .map((n) => {
          if (n.id !== args.menu_id || n.data?.kind !== "keyboard.inline") return n;
          const filtered = parseMenuButtons((n.data?.params as any)?.buttons).filter(
            (b) => b.action !== callbackData && b.action !== `screen:${args.section_msg_id}`,
          );
          return {
            ...n,
            data: {
              ...n.data,
              params: {
                ...((n.data?.params as Record<string, string>) ?? {}),
                buttons: serializeMenuButtons(filtered),
              },
            },
          };
        }),
    );

    setEdges((prev) => prev.filter((e) => !dropIds.has(e.source) && !dropIds.has(e.target)));
  }, []);

  const updateMenuSection = useCallback(
    (args: {
      menu_id: string;
      section_msg_id: string;
      new_button_label?: string;
      new_content?: string;
    }) => {
      const sectionId = args.section_msg_id.replace(/_msg$/, "");
      const sectionTrig = nodesRef.current.find((n) => n.id === `${sectionId}_trig`);
      const callbackData =
        (sectionTrig?.data?.params as Record<string, string> | undefined)?.data ?? null;
      const legacyAction = `screen:${args.section_msg_id}`;

      setNodes((prev) =>
        prev.map((n) => {
          if (
            n.id === args.menu_id &&
            n.data?.kind === "keyboard.inline" &&
            args.new_button_label
          ) {
            const updated = parseMenuButtons((n.data?.params as any)?.buttons).map((b) =>
              b.action === callbackData || b.action === legacyAction
                ? { ...b, label: args.new_button_label! }
                : b,
            );
            return {
              ...n,
              data: {
                ...n.data,
                params: {
                  ...((n.data?.params as Record<string, string>) ?? {}),
                  buttons: serializeMenuButtons(updated),
                },
              },
            };
          }
          if (n.id === args.section_msg_id && args.new_content !== undefined) {
            const kind = (n.data?.kind as string) ?? "message.text";
            const key = kind === "message.photo" ? "url" : "text";
            return {
              ...n,
              data: {
                ...n.data,
                params: {
                  ...((n.data?.params as Record<string, string>) ?? {}),
                  [key]: args.new_content,
                },
              },
            };
          }
          return n;
        }),
      );
    },
    [],
  );

  /**
   * Composite tool for the architect: in one call, create a `trigger.webapp_data`
   * node (matched by `action`), a `message.text` node (the reply), and the edge
   * between them. Idempotent — if the handler_id already maps to existing nodes,
   * we skip with a console warn rather than duplicating. This mirrors the
   * addMenuSection pattern so the architect cannot easily desync ids.
   *
   * The response_text may use the {webapp.action}, {webapp.total},
   * {webapp.items_summary}, {webapp.count}, {webapp.currency} placeholders —
   * bot-runtime populates them from the parsed sendData payload.
   */
  const addWebappHandler = useCallback(
    (args: { handler_id: string; action: string; response_text: string }) => {
      const trigId = `${args.handler_id}_trig`;
      const msgId = `${args.handler_id}_msg`;
      const action = String(args.action ?? "").trim();

      setNodes((prev) => {
        if (prev.some((n) => n.id === trigId) || prev.some((n) => n.id === msgId)) {
          console.warn("addWebappHandler: nodes already exist", args.handler_id);
          return prev;
        }
        const baseIdx = prev.length;
        const newNodes: Node[] = [
          {
            id: trigId,
            type: "anvl",
            position: { x: 40 + Math.floor(baseIdx / 2) * 280, y: 90 + (baseIdx % 2) * 170 },
            data: {
              kind: "trigger.webapp_data",
              title: action ? `Заказ «${action}»` : "Заказ из Mini App",
              preview: `action: ${action || "(any)"}`,
              params: { action },
            },
          },
          {
            id: msgId,
            type: "anvl",
            position: {
              x: 40 + Math.floor((baseIdx + 1) / 2) * 280,
              y: 90 + ((baseIdx + 1) % 2) * 170,
            },
            data: {
              kind: "message.text",
              title: "Ответ боту",
              preview: args.response_text.slice(0, 80),
              params: { text: args.response_text },
            },
          },
        ];
        return [...prev, ...newNodes];
      });

      setEdges((prev) => {
        const eid = `ai-${trigId}-${msgId}`;
        if (prev.some((e) => e.id === eid)) return prev;
        return [...prev, { id: eid, source: trigId, target: msgId, animated: true }];
      });
    },
    [],
  );

  const serializeCanvas = useCallback(() => {
    const abbreviate = (kind: string, params: Record<string, string>) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(params ?? {})) {
        const s = String(v ?? "");
        out[k] = s.length > 80 ? s.slice(0, 80) + "…" : s;
      }
      return out;
    };
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        kind: (n.data?.kind as string) ?? "",
        label:
          (n.data?.title as string) ??
          (n.data?.label as string) ??
          (n.data?.titleKey as string) ??
          "",
        params: abbreviate(
          (n.data?.kind as string) ?? "",
          (n.data?.params as Record<string, string>) ?? {},
        ),
      })),
      edges: edges.map((e) => ({
        from: e.source,
        to: e.target,
        sourceHandle: e.sourceHandle ?? null,
      })),
      variables,
    };
  }, [nodes, edges, variables]);

  const mergePreview = useCallback((patch: Partial<AnvlPreviewState>) => {
    setPreview((cur) => ({ ...cur, ...patch }));
  }, []);

  const mergeMiniApp = useCallback(
    (patch: Partial<AnvlMiniAppState>) => {
      setMiniApp((cur) => ({ ...cur, ...patch }));
      // Any architect-driven Mini App update implies the user wants Mini App mode.
      setMiniAppEnabled(true);
    },
    [setMiniAppEnabled],
  );

  // ===== Composite Mini App helpers (round 1: thin wrappers) =====
  const initMiniApp = useCallback(
    (args: {
      title: string;
      subtitle?: string;
      accent?: AnvlMiniAppState["accent"];
      accentHex?: string;
      layout?: AnvlMiniAppState["layout"];
      itemsLabel?: string;
      theme?: "light" | "dark";
    }) => {
      const patch: Partial<AnvlMiniAppState> & { theme?: "light" | "dark" } = {};
      if (args.title !== undefined) patch.title = args.title;
      if (args.subtitle !== undefined) patch.subtitle = args.subtitle;
      if (args.accent !== undefined) patch.accent = args.accent;
      if (args.accentHex !== undefined) patch.accentHex = args.accentHex;
      if (args.layout !== undefined) patch.layout = args.layout;
      if (args.itemsLabel !== undefined) patch.itemsLabel = args.itemsLabel;
      if (args.theme !== undefined) (patch as { theme?: "light" | "dark" }).theme = args.theme;
      mergeMiniApp(patch);
      setMiniAppEnabled(true);
    },
    [mergeMiniApp, setMiniAppEnabled],
  );
  const setMiniAppHero = useCallback(
    (hero: MiniAppHero) => {
      mergeMiniApp({ hero });
      setMiniAppEnabled(true);
    },
    [mergeMiniApp, setMiniAppEnabled],
  );
  const setMiniAppStats = useCallback(
    (stats: MiniAppStat[]) => {
      mergeMiniApp({ stats });
      setMiniAppEnabled(true);
    },
    [mergeMiniApp, setMiniAppEnabled],
  );
  const setMiniAppTabs = useCallback(
    (tabs: MiniAppTabSpec[]) => {
      mergeMiniApp({ tabs });
      setMiniAppEnabled(true);
    },
    [mergeMiniApp, setMiniAppEnabled],
  );
  const addMiniAppItem = useCallback(
    (item: MiniAppItem) => {
      setMiniApp((cur) => ({ ...cur, items: [...(cur.items ?? []), item] }));
      setMiniAppEnabled(true);
    },
    [setMiniAppEnabled],
  );
  const addMiniAppPlan = useCallback(
    (plan: MiniAppPlanCard) => {
      setMiniApp((cur) => ({ ...cur, plans: [...(cur.plans ?? []), plan] }));
      setMiniAppEnabled(true);
    },
    [setMiniAppEnabled],
  );
  const clearMiniAppItems = useCallback(() => {
    mergeMiniApp({ items: [] });
    setMiniAppEnabled(true);
  }, [mergeMiniApp, setMiniAppEnabled]);
  const clearMiniAppPlans = useCallback(() => {
    mergeMiniApp({ plans: [] });
    setMiniAppEnabled(true);
  }, [mergeMiniApp, setMiniAppEnabled]);
  const setMiniAppCart = useCallback(
    (cart: Partial<MiniAppCart>) => {
      // Normalize: ensure all four fields are present with sane defaults.
      // Architect can call set_miniapp_cart({enabled: true}) and get a
      // working order flow without specifying every knob.
      const normalized: MiniAppCart = {
        enabled: !!cart.enabled,
        sendAction:
          typeof cart.sendAction === "string" && cart.sendAction.trim()
            ? cart.sendAction.trim()
            : "order",
        currency:
          typeof cart.currency === "string" && cart.currency.trim() ? cart.currency.trim() : "₽",
        ctaLabel:
          typeof cart.ctaLabel === "string" && cart.ctaLabel.trim()
            ? cart.ctaLabel.trim()
            : "Оформить заказ",
      };
      mergeMiniApp({ cart: normalized });
      setMiniAppEnabled(true);
    },
    [mergeMiniApp, setMiniAppEnabled],
  );

  const {
    status: saveStatus,
    lastSavedAt,
    snapshotNow,
    flowId,
  } = useFlowPersistence({
    slug,
    nodes,
    edges,
    preview,
    miniapp: miniApp,
    miniappEnabled: miniAppEnabled,
    generatedCode,
    variables,
    onHydrate: hydrate,
    enabled: persist,
    autoCreate,
    onFlowCreated,
  });

  const lintIssues = useMemo<LintIssue[]>(() => {
    try {
      return lintFlow(nodes, edges, variables);
    } catch {
      return [];
    }
  }, [nodes, edges, variables]);

  const value = useMemo(
    () => ({
      nodes,
      edges,
      setNodes,
      setEdges,
      preview,
      miniApp,
      generatedCode,
      setGeneratedCode,
      variables,
      setVariables,
      applyBlueprint,
      addAiNode,
      connectAiNodes,
      updateAiNodeParam,
      removeAiNode,
      removeAiEdge,
      renameAiNode,
      serializeCanvas,
      mergePreview,
      mergeMiniApp,
      resetAiCanvas,
      relayoutCanvas,
      initMiniApp,
      setMiniAppHero,
      setMiniAppStats,
      setMiniAppTabs,
      addMiniAppItem,
      addMiniAppPlan,
      clearMiniAppItems,
      clearMiniAppPlans,
      setMiniAppCart,
      addMenuSection,
      removeMenuSection,
      updateMenuSection,
      addWebappHandler,
      saveStatus,
      lastSavedAt,
      snapshotNow,
      flowId,
      slug,
      rollbackToVersion,
      lintIssues,
    }),
    [
      nodes,
      edges,
      preview,
      miniApp,
      generatedCode,
      variables,
      applyBlueprint,
      addAiNode,
      connectAiNodes,
      updateAiNodeParam,
      removeAiNode,
      removeAiEdge,
      renameAiNode,
      serializeCanvas,
      mergePreview,
      mergeMiniApp,
      resetAiCanvas,
      relayoutCanvas,
      initMiniApp,
      setMiniAppHero,
      setMiniAppStats,
      setMiniAppTabs,
      addMiniAppItem,
      addMiniAppPlan,
      clearMiniAppItems,
      clearMiniAppPlans,
      setMiniAppCart,
      addMenuSection,
      removeMenuSection,
      updateMenuSection,
      addWebappHandler,
      saveStatus,
      lastSavedAt,
      snapshotNow,
      flowId,
      slug,
      rollbackToVersion,
      lintIssues,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnvlWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAnvlWorkspace must be used inside AnvlWorkspaceProvider");
  return ctx;
}
