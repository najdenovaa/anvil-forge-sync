import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  ArrowUp,
  Plus,
  History,
  Paperclip,
  ChevronDown,
  Check,
  Loader2,
  Brain,
  Cpu,
  PencilLine,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "./I18nContext";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import { usePlatform } from "./PlatformContext";
import { useAnvlShell } from "./AnvlAppShellContext";
import { cn } from "@/lib/utils";
import { safeParseAnvlBlueprint, type AnvlBlueprint, type AnvlBlueprintNode } from "@/lib/anvl-blueprint";

type ModelId = "auto" | "gpt" | "gemini" | "grok" | "claude";

interface ModelDef {
  id: ModelId;
  labelKey: string;
  short: string;
  routed?: boolean;
  accent: string;
}

const MODELS: ModelDef[] = [
  { id: "auto", labelKey: "ai.model.auto", short: "AUTO", accent: "oklch(0.78_0.14_85)" },
  { id: "claude", labelKey: "ai.model.claude", short: "CL", routed: true, accent: "oklch(0.72_0.16_60)" },
  { id: "gpt", labelKey: "ai.model.gpt", short: "GPT", accent: "oklch(0.72_0.16_150)" },
  { id: "gemini", labelKey: "ai.model.gemini", short: "GEM", accent: "oklch(0.65_0.18_260)" },
  { id: "grok", labelKey: "ai.model.grok", short: "GROK", routed: true, accent: "oklch(0.72_0.18_30)" },
];

interface ToolOp {
  name: string;
  args: Record<string, unknown>;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  thoughts?: string;
  pending?: boolean;
  step?: number;
  toolOps?: ToolOp[];
  /** Synthesised "what AI is doing right now" lines — drives Architect Logic when the model
   *  emits only tool_calls and no <think> block. */
  liveSteps?: string[];
}

const CHAT_STORAGE_KEY_PREFIX = "anvl:chat:";
const MAX_PERSISTED_MESSAGES = 50;

function loadPersistedMessages(slug: string | undefined, introMsg: string): Msg[] {
  const fallback: Msg[] = [{ role: "assistant", content: introMsg }];
  if (!slug || typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY_PREFIX + slug);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
    const ok = parsed.every(
      (m: any) =>
        m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    );
    return ok ? (parsed as Msg[]) : fallback;
  } catch {
    return fallback;
  }
}

/** Turn a tool call into a short human-readable plan line. */
function describeToolStep(name: string, args: Record<string, any>): string {
  switch (name) {
    case "reset_canvas":
      return "Очищаю холст для новой схемы";
    case "add_node": {
      const kind = args.kind ?? "block";
      const title = args.title ?? args.id ?? "";
      const kindLabel: Record<string, string> = {
        "trigger.command": "команда",
        "trigger.message": "входящее сообщение",
        "trigger.callback": "callback",
        "message.text": "текстовое сообщение",
        "message.photo": "фото",
        "message.document": "документ",
        "keyboard.inline": "inline-клавиатура",
        "keyboard.reply": "reply-клавиатура",
        "miniapp.screen": "экран Mini App",
        "logic.condition": "условие",
        "action.api": "API-вызов",
      };
      return `Добавляю ${kindLabel[kind] ?? kind}: «${title}»`;
    }
    case "connect":
      return `Соединяю ${args.from} → ${args.to}`;
    case "set_param": {
      const v = String(args.value ?? "").trim().slice(0, 40);
      return `Параметр ${args.id}.${args.key} = ${v}${v.length === 40 ? "…" : ""}`;
    }
    case "set_preview":
      return "Настраиваю превью бота";
    case "set_miniapp":
      return "Настраиваю Mini App";
    case "set_code":
      return `Пишу рабочий код: ${args.filename ?? args.language ?? "bot"}`;
    case "get_canvas":
      return "Читаю текущий канвас";
    case "remove_node":
      return `Удаляю ноду ${args.id}`;
    case "remove_edge":
      return `Разрываю связь ${args.from} → ${args.to}${args.sourceHandle ? ` (${args.sourceHandle})` : ""}`;
    case "rename_node":
      return `Переименовываю ${args.id}: ${args.label}`;
    case "add_menu_section":
      return `Добавил раздел «${args.button_label ?? args.section_id}» в меню`;
    case "remove_menu_section":
      return `Удалил раздел ${args.section_msg_id}`;
    case "update_menu_section":
      return `Обновил раздел ${args.section_msg_id}${args.new_button_label ? ` → «${args.new_button_label}»` : ""}`;
    case "init_miniapp":
      return `Инициализировал Mini App «${args.title ?? ""}»`;
    case "set_miniapp_hero":
      return "Установил hero-карточку";
    case "set_miniapp_stats":
      return `Установил статистику (${Array.isArray(args.stats) ? args.stats.length : 0} блока)`;
    case "set_miniapp_tabs":
      return `Установил ${Array.isArray(args.tabs) ? args.tabs.length : 0} табов`;
    case "add_miniapp_item":
      return `Добавил элемент «${args.title ?? ""}»`;
    case "add_miniapp_plan":
      return `Добавил тариф «${args.name ?? ""}»`;
    case "clear_miniapp_items":
      return "Очистил список items";
    case "clear_miniapp_plans":
      return "Очистил список plans";
    default:
      return name;
  }
}

function extractTaggedBlock(source: string, tag: string) {
  const match = source.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1] ?? "";
}

function stripTaggedBlocks(source: string) {
  return source.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<blueprint>[\s\S]*?<\/blueprint>/gi, "").replace(/<code>[\s\S]*?<\/code>/gi, "");
}

function buildRunnableCodeFromTools(ops: ToolOp[], platform: string) {
  const nodes = new Map<string, { kind: string; title: string; preview: string; params: Record<string, string> }>();
  const edges: { from: string; to: string }[] = [];
  let preview: Record<string, unknown> = {};

  for (const op of ops) {
    if (op.name === "add_node") {
      nodes.set(String(op.args.id ?? "node"), {
        kind: String(op.args.kind ?? "message.text"),
        title: String(op.args.title ?? op.args.id ?? "Node"),
        preview: String(op.args.preview ?? ""),
        params: {},
      });
    } else if (op.name === "connect") {
      edges.push({ from: String(op.args.from ?? ""), to: String(op.args.to ?? "") });
    } else if (op.name === "set_param") {
      const node = nodes.get(String(op.args.id ?? ""));
      if (node) node.params[String(op.args.key ?? "value")] = String(op.args.value ?? "");
    } else if (op.name === "set_preview") {
      preview = op.args;
    }
  }

  const flow = { platform, preview, nodes: Object.fromEntries(nodes), edges };
  return `// Generated by Anvl Architect\n// Platform: ${platform}\n\nconst flow = ${JSON.stringify(flow, null, 2)};\n\nexport async function handleUpdate(update) {\n  const text = update?.message?.text ?? update?.callback_query?.data ?? \"\";\n  const chatId = update?.message?.chat?.id ?? update?.callback_query?.message?.chat?.id;\n  const entry = Object.entries(flow.nodes).find(([, node]) => node.kind.startsWith(\"trigger.\"));\n  if (!chatId || !entry) return;\n\n  const [, startNode] = entry;\n  const command = startNode.params.command || \"/start\";\n  if (text && text !== command && !text.startsWith(\"/\")) {\n    return sendMessage(chatId, flow.preview.botMessages?.[0] || \"Принял запрос. Выберите действие ниже.\", flow.preview.buttons || []);\n  }\n\n  const messages = flow.preview.botMessages?.length ? flow.preview.botMessages : [startNode.preview || startNode.title];\n  return sendMessage(chatId, messages.join(\"\\n\\n\"), flow.preview.buttons || []);\n}\n\nasync function sendMessage(chatId, text, buttons = []) {\n  const reply_markup = buttons.length ? { inline_keyboard: buttons.map((button) => [{ text: button.label, callback_data: button.action }]) } : undefined;\n  return fetch(process.env.BOT_API_URL, {\n    method: \"POST\",\n    headers: { \"Content-Type\": \"application/json\" },\n    body: JSON.stringify({ chat_id: chatId, text, parse_mode: \"HTML\", reply_markup }),\n  });\n}\n`;
}

function sanitizeBlueprintForMode(blueprint: AnvlBlueprint, miniAppEnabled: boolean): AnvlBlueprint {
  if (miniAppEnabled) return blueprint;

  const cleanButtons = <T extends { action: string }>(buttons?: T[]) =>
    buttons?.filter((button) => button.action !== "open_miniapp" && button.action !== "locations");

  const nextNodes = blueprint.nodes?.length
    ? blueprint.nodes.reduce<AnvlBlueprintNode[]>((acc, node) => {
        if (node.kind !== "miniapp.screen") acc.push(node);
        return acc;
      }, [])
    : blueprint.nodes;

  const indexMap = new Map<number, number>();
  blueprint.nodes?.forEach((node, index) => {
    if (node.kind !== "miniapp.screen") indexMap.set(index, indexMap.size);
  });

  const nextEdges = blueprint.edges?.flatMap((edge) => {
    const from = indexMap.get(edge.from);
    const to = indexMap.get(edge.to);
    return from === undefined || to === undefined ? [] : [{ from, to }];
  });

  return {
    ...blueprint,
    nodes: nextNodes,
    edges: nextEdges,
    miniapp: undefined,
    preview: blueprint.preview
      ? {
          ...blueprint.preview,
          buttons: cleanButtons(blueprint.preview.buttons),
          screens: blueprint.preview.screens?.map((screen) => ({
            ...screen,
            buttons: cleanButtons(screen.buttons) ?? [],
          })),
        }
      : blueprint.preview,
  };
}

export function LeftAIPanel() {
  const { t } = useI18n();
  const {
    applyBlueprint,
    setGeneratedCode,
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
    setVariables,
    addMenuSection,
    removeMenuSection,
    updateMenuSection,
    nodes,
    edges,
    slug,
  } = useAnvlWorkspace();
  const { platform, miniAppEnabled } = usePlatform();
  const { consumeInitialPrompt } = useAnvlShell();
  const [model, setModel] = useState<ModelId>("auto");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>(() => loadPersistedMessages(slug, t("ai.msg.intro")));
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<(text?: string) => void>(() => {});
  const bootedRef = useRef(false);

  useEffect(() => {
    setMessages((prev) =>
      prev.length === 1 && prev[0].role === "assistant"
        ? [{ role: "assistant", content: t("ai.msg.intro") }]
        : prev,
    );
  }, [t]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  // Persist chat history per flow slug.
  useEffect(() => {
    if (!slug || typeof window === "undefined") return;
    try {
      const toSave = messages.slice(-MAX_PERSISTED_MESSAGES);
      window.localStorage.setItem(CHAT_STORAGE_KEY_PREFIX + slug, JSON.stringify(toSave));
    } catch (err) {
      console.warn("Failed to persist chat history:", err);
    }
  }, [messages, slug]);

  // Reload history when switching between flows.
  useEffect(() => {
    setMessages(loadPersistedMessages(slug, t("ai.msg.intro")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  /** Run a single round against the architect-chat edge function. Returns the
   *  collected liveSteps so the caller can request a follow-up summary. */
  const runRound = async (
    historyForWire: Msg[],
    opts: { summaryOnly?: boolean; executedSteps?: string[] } = {},
  ): Promise<{ liveSteps: string[]; usedTools: boolean; finalAnswer: string }> => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/architect-chat`;
    const wireMessages = historyForWire.map((m) => ({ role: m.role, content: m.content }));

    const flowSnapshot = {
      nodes: nodes.map((n) => ({
        id: n.id,
        kind: (n.data?.kind as string) ?? "message.text",
        title: (n.data?.title as string) ?? (n.data?.titleKey as string) ?? "",
        params: (n.data?.params as Record<string, string>) ?? {},
      })),
      edges: edges.map((e) => ({ from: e.source, to: e.target })),
    };

    const canvasSnapshot = serializeCanvas();

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        messages: wireMessages,
        model,
        miniApp: miniAppEnabled,
        platform,
        flowSnapshot,
        canvasSnapshot,
        summaryOnly: opts.summaryOnly,
        executedSteps: opts.executedSteps,
      }),
    });

    if (resp.status === 429) {
      setError(t("ai.rate_limit"));
      throw new Error("rate_limit");
    }
    if (resp.status === 402) {
      setError(t("ai.payment"));
      throw new Error("payment");
    }
    if (!resp.ok || !resp.body) throw new Error("network");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let raw = "";
    let thoughts = "";
    let blueprintRaw = "";
    let answer = "";
    let phase: 0 | 1 | 2 | 3 | 4 = 0;
    let pending = "";
    let blueprintApplied = false;
    let codeApplied = false;
    const toolBuf: { name: string; args: string; done: boolean }[] = [];
    const liveOps: ToolOp[] = [];
    const liveSteps: string[] = [];
    let liveStep: 0 | 1 | 2 | 3 = 0;

    const applyToolCall = (name: string, argsRaw: string) => {
      let args: any;
      try { args = JSON.parse(argsRaw); } catch { return; }
      liveOps.push({ name, args: args ?? {} });
      liveSteps.push(describeToolStep(name, args ?? {}));
      if (name === "reset_canvas" && liveStep < 1) liveStep = 1;
      else if ((name === "add_node" || name === "connect") && liveStep < 2) liveStep = 2;
      else if ((name === "set_preview" || name === "set_miniapp" || name === "set_param") && liveStep < 3) liveStep = 3;
      try {
        if (name === "reset_canvas") resetAiCanvas();
        else if (name === "add_node") addAiNode(args.id, args.kind, args.title, args.preview);
        else if (name === "connect") connectAiNodes(args.from, args.to, args.sourceHandle);
        else if (name === "set_param") updateAiNodeParam(args.id, args.key, args.value);
        else if (name === "set_preview") mergePreview(args);
        else if (name === "set_miniapp") mergeMiniApp(args);
        else if (name === "set_code") {
          setGeneratedCode(String(args.content ?? ""));
          codeApplied = true;
        }
        else if (name === "set_variables") {
          if (Array.isArray(args.variables)) setVariables(args.variables);
        }
        else if (name === "remove_node") removeAiNode(args.id);
        else if (name === "remove_edge") removeAiEdge(args.from, args.to, args.sourceHandle);
        else if (name === "rename_node") renameAiNode(args.id, args.label);
        else if (name === "add_menu_section") addMenuSection(args);
        else if (name === "remove_menu_section") removeMenuSection(args);
        else if (name === "update_menu_section") updateMenuSection(args);
        // get_canvas is fulfilled server-side: the edge function injects a
        // tool_result with the live canvasSnapshot before continuing the
        // conversation. Nothing to apply on the client.
      } catch (err) { console.warn("tool apply failed", name, err); }
    };

    const flush = () => {
      if (!blueprintApplied && blueprintRaw.includes("\"nodes\"") && blueprintRaw.includes("\"preview\"")) {
        const liveBlueprint = safeParseAnvlBlueprint(blueprintRaw.trim());
        if (liveBlueprint) {
          applyBlueprint(sanitizeBlueprintForMode(liveBlueprint, miniAppEnabled));
          blueprintApplied = true;
        }
      }
      if (!codeApplied) {
        const liveCode = extractTaggedBlock(raw, "code").trim();
        if (liveCode) {
          setGeneratedCode(liveCode);
          codeApplied = true;
        }
      }
      setMessages((prev) => {
        const copy = prev.slice();
        const last = copy[copy.length - 1];
        if (!last || last.role !== "assistant") return prev;
        const nextStep = Math.max(last.step ?? 0, liveStep);
        // Stream model thoughts AND synthesised steps into the bubble so the
        // chat ALWAYS shows what the AI is doing — even when the model emits
        // only tool_calls without a <think> block.
        const synthesised = liveSteps.length
          ? liveSteps.map((s) => "• " + s).join("\n")
          : "";
        const liveThoughts = thoughts.trim() || synthesised;
        copy[copy.length - 1] = {
          ...last,
          thoughts: liveThoughts,
          content: answer,
          toolOps: liveOps.length ? [...liveOps] : last.toolOps,
          liveSteps: liveSteps.length ? [...liveSteps] : last.liveSteps,
          step: nextStep,
          pending: phase !== 4 && answer.length === 0,
        };
        return copy;
      });
    };

    const THINK_OPEN = "<think>";
    const THINK_CLOSE = "</think>";
    const BLUEPRINT_OPEN = "<blueprint>";
    const BLUEPRINT_CLOSE = "</blueprint>";
    const SAFE_TAIL = 16;

    const ingest = (chunk: string) => {
      raw += chunk;
      pending += chunk;

      while (pending.length > 0) {
        if (phase === 0) {
          const open = pending.indexOf(THINK_OPEN);
          if (open !== -1) {
            answer += pending.slice(0, open);
            pending = pending.slice(open + THINK_OPEN.length);
            phase = 1;
            continue;
          }
          if (pending.length > SAFE_TAIL) {
            const safe = pending.slice(0, pending.length - SAFE_TAIL);
            if (safe.length) {
              answer += safe;
              pending = pending.slice(safe.length);
              phase = 4;
            }
          }
          break;
        }

        if (phase === 1) {
          const close = pending.indexOf(THINK_CLOSE);
          if (close !== -1) {
            thoughts += pending.slice(0, close);
            pending = pending.slice(close + THINK_CLOSE.length);
            phase = 2;
            continue;
          }
          if (pending.length > SAFE_TAIL) {
            const safe = pending.slice(0, pending.length - SAFE_TAIL);
            thoughts += safe;
            pending = pending.slice(safe.length);
          }
          break;
        }

        if (phase === 2) {
          const open = pending.indexOf(BLUEPRINT_OPEN);
          if (open !== -1) {
            answer += pending.slice(0, open);
            pending = pending.slice(open + BLUEPRINT_OPEN.length);
            phase = 3;
            continue;
          }
          if (pending.length > SAFE_TAIL) {
            const safe = pending.slice(0, pending.length - SAFE_TAIL);
            if (safe.length) {
              answer += safe;
              pending = pending.slice(safe.length);
              phase = 4;
            }
          }
          break;
        }

        if (phase === 3) {
          const close = pending.indexOf(BLUEPRINT_CLOSE);
          if (close !== -1) {
            blueprintRaw += pending.slice(0, close);
            pending = pending.slice(close + BLUEPRINT_CLOSE.length);
            phase = 4;
            continue;
          }
          if (pending.length > SAFE_TAIL) {
            const safe = pending.slice(0, pending.length - SAFE_TAIL);
            blueprintRaw += safe;
            pending = pending.slice(safe.length);
          }
          break;
        }

        answer += pending;
        pending = "";
        break;
      }

      flush();
    };

    let done = false;
    while (!done) {
      const { value, done: d } = await reader.read();
      if (d) break;
      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line || line.startsWith(":")) continue;
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") { done = true; break; }
        try {
          const parsed = JSON.parse(json);
          const choice = parsed.choices?.[0];
          const delta = choice?.delta?.content as string | undefined;
          if (delta) ingest(delta);
          const tcDelta = choice?.delta?.tool_calls as Array<any> | undefined;
          if (tcDelta) {
            for (const tc of tcDelta) {
              const idx = tc.index ?? 0;
              if (!toolBuf[idx]) toolBuf[idx] = { name: "", args: "", done: false };
              if (tc.function?.name) toolBuf[idx].name = tc.function.name;
              if (tc.function?.arguments) toolBuf[idx].args += tc.function.arguments;
              const buf = toolBuf[idx];
              if (!buf.done && buf.name && buf.args.trim().length) {
                try {
                  JSON.parse(buf.args);
                  applyToolCall(buf.name, buf.args);
                  buf.done = true;
                } catch { /* still streaming */ }
              }
            }
            flush();
          }
          const finishReason = choice?.finish_reason;
          if (finishReason === "tool_calls" || finishReason === "stop") {
            for (const tc of toolBuf) {
              if (tc && !tc.done && tc.name) {
                applyToolCall(tc.name, tc.args || "{}");
                tc.done = true;
              }
            }
            flush();
          }
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }

    if (pending.length > 0) {
      const phaseValue = phase as number;
      if (phaseValue === 1) thoughts += pending;
      else if (phaseValue === 3) blueprintRaw += pending;
      else answer += pending;
      pending = "";
    }

    for (const tc of toolBuf) {
      if (tc && !tc.done && tc.name) {
        applyToolCall(tc.name, tc.args || "{}");
        tc.done = true;
      }
    }

    const usedTools = toolBuf.some((tc) => tc?.done);
    const extractedThoughts = extractTaggedBlock(raw, "think").trim();
    const extractedBlueprint = extractTaggedBlock(raw, "blueprint").trim() || blueprintRaw.trim();
    const extractedCode = extractTaggedBlock(raw, "code").trim();
    const strippedAnswer = stripTaggedBlocks(raw).trim();

    if (!usedTools) {
      const blueprint = safeParseAnvlBlueprint(extractedBlueprint);
      if (blueprint) applyBlueprint(sanitizeBlueprintForMode(blueprint, miniAppEnabled));
    }
    if (extractedCode) setGeneratedCode(extractedCode);
    if (usedTools && !codeApplied && !extractedCode) {
      setGeneratedCode(buildRunnableCodeFromTools(liveOps, platform));
    }

    const finalAnswer = strippedAnswer;
    const finalThoughts = extractedThoughts || thoughts.trim() ||
      (liveSteps.length ? liveSteps.map((s) => "• " + s).join("\n") : "");

    setMessages((prev) => {
      const copy = prev.slice();
      const last = copy[copy.length - 1];
      if (last?.role === "assistant") {
        copy[copy.length - 1] = {
          ...last,
          content: finalAnswer || last.content,
          thoughts: finalThoughts || last.thoughts,
          toolOps: liveOps.length ? [...liveOps] : last.toolOps,
          liveSteps: liveSteps.length ? [...liveSteps] : last.liveSteps,
          // Keep "pending" true if we still need a follow-up summary call.
          pending: !finalAnswer && usedTools,
        };
      }
      return copy;
    });

    return { liveSteps, usedTools, finalAnswer };
  };

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || isStreaming) return;

    setError(null);
    if (!override) setInput("");

    const userMsg: Msg = { role: "user", content: text };
    const placeholder: Msg = {
      role: "assistant",
      content: "",
      pending: true,
      step: 0,
      thoughts: "",
      liveSteps: [],
    };
    const baseHistory: Msg[] = [...messages, userMsg];
    setMessages([...baseHistory, placeholder]);
    setIsStreaming(true);

    try {
      // Round 1 — model uses tools to mutate the canvas.
      const { liveSteps, usedTools, finalAnswer } = await runRound(baseHistory);
      // Auto-layout the freshly built graph left-to-right.
      if (usedTools) {
        setTimeout(() => relayoutCanvas(), 50);
      }

      // If the model only emitted tool_calls without a textual reply, run a
      // follow-up round asking for a short summary in the user's language.
      // This guarantees the chat ALWAYS has a real assistant message.
      if (usedTools && !finalAnswer.trim()) {
        const summary = await runRound(baseHistory, {
          summaryOnly: true,
          executedSteps: liveSteps,
        });
        if (!summary.finalAnswer.trim()) {
          setMessages((prev) => {
            const copy = prev.slice();
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") {
              copy[copy.length - 1] = {
                ...last,
                content:
                  "Я начал собирать бот, но запрос слишком большой — поток ответа был обрезан. " +
                  "Канвас содержит частичную сборку. Давай разделим: скажи, какую ОДНУ фичу " +
                  "собрать первой (например «регистрация + профиль» или «турниры»), и я добавлю остальное по шагам.",
                pending: false,
              };
            }
            return copy;
          });
        }
      } else if (!usedTools && !finalAnswer.trim()) {
        setMessages((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = {
              ...last,
              content:
                "Не получилось собрать бот за один проход — запрос слишком большой. " +
                "Опиши, пожалуйста, ОДНУ фичу для старта (например «регистрация и главное меню»), " +
                "и я добавлю остальное следующими сообщениями.",
              pending: false,
            };
          }
          return copy;
        });
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : "";
      if (reason !== "rate_limit" && reason !== "payment") {
        console.error("architect-chat failed", e);
        setError(t("ai.error"));
      }
      // Roll back the placeholder if nothing was applied.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content.trim() && !(last.toolOps?.length)) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsStreaming(false);
      // Make sure pending is cleared on the final message.
      setMessages((prev) => {
        const copy = prev.slice();
        const last = copy[copy.length - 1];
        if (last?.role === "assistant" && last.pending) {
          copy[copy.length - 1] = { ...last, pending: false };
        }
        return copy;
      });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  };

  const newChat = () => {
    setMessages([{ role: "assistant", content: t("ai.msg.intro") }]);
    setGeneratedCode("");
    setError(null);
  };

  // Keep a stable ref to send so the bootstrap effect can call it without re-running.
  sendRef.current = send;

  // Auto-fire the prompt the user typed on the landing page.
  useEffect(() => {
    if (bootedRef.current) return;
    const initial = consumeInitialPrompt();
    if (initial) {
      bootedRef.current = true;
      // Defer one tick so providers/state are settled.
      setTimeout(() => sendRef.current?.(initial), 50);
    }
  }, [consumeInitialPrompt]);

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-r border-hairline bg-sidebar">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-foreground text-background">
            <Sparkles className="h-2.5 w-2.5" />
          </div>
          <span className="text-[12.5px] font-semibold tracking-tight">{t("ai.title")}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <IconBtn label={t("ai.history")}>
            <History className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label={t("ai.new")} onClick={newChat}>
            <Plus className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      </div>

      <ModelDropdown current={model} onChange={setModel} />

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            <MessageBubble msg={m} />
          </motion.div>
        ))}
        {error && (
          <div className="rounded-xl border border-status-err/40 bg-status-err/10 px-3 py-2 text-[11.5px] text-status-err">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-hairline p-3">
        <div className="hairline flex items-end gap-2 rounded-xl bg-surface px-3 py-2 focus-within:border-foreground/30">
          <button className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground">
            <Paperclip className="h-3.5 w-3.5" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={t("ai.placeholder")}
            className="flex-1 resize-none bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || isStreaming}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background transition disabled:opacity-30"
          >
            {isStreaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
          <span>{t("ai.send_hint")}</span>
          <span>
            {t(MODELS.find((m) => m.id === model)!.labelKey)} · {t("ai.model")}
          </span>
        </div>
      </div>
    </aside>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const { t } = useI18n();
  const [openThoughts, setOpenThoughts] = useState(false);

  if (msg.role === "user") {
    return (
      <div className="ml-auto max-w-[88%] whitespace-pre-wrap rounded-xl border border-hairline bg-surface-elevated px-3 py-2 text-[12.5px] leading-relaxed text-foreground">
        {msg.content}
      </div>
    );
  }

  const isLive = !!msg.pending;
  const hasThoughts = !!msg.thoughts && msg.thoughts.trim().length > 0;
  const hasOps = !!msg.toolOps && msg.toolOps.length > 0;
  const hasContent = msg.content.trim().length > 0;

  // While streaming, show the model's live <think> stream INSIDE the bubble
  // (typewriter), so the chat shows exactly what the AI is saying right now.
  // Once the model emits its real summary, swap to that.
  const liveBubbleText = hasContent ? msg.content : (msg.thoughts ?? "");
  const showingThoughtsAsContent = isLive && !hasContent && hasThoughts;

  return (
    <div className="max-w-[88%] space-y-1.5">
      {/* The chat bubble — always visible. Streams the model's own words. */}
      <div className="rounded-xl border border-hairline bg-surface px-3 py-2 text-[12.5px] leading-relaxed text-foreground/90">
        {liveBubbleText ? (
          <div className="whitespace-pre-wrap">
            {showingThoughtsAsContent && (
              <span className="mr-1.5 inline-flex items-center gap-1 align-middle text-[10px] font-semibold uppercase tracking-[0.14em] text-[oklch(0.78_0.18_280)]">
                <Brain className="h-2.5 w-2.5" />
                <span>thinking</span>
              </span>
            )}
            {liveBubbleText}
            {isLive && (
              <span className="ml-0.5 inline-block h-3 w-[2px] translate-y-[2px] animate-pulse bg-foreground/60 align-middle" />
            )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> {t("ai.thinking")}
          </span>
        )}

        {!isLive && hasThoughts && hasContent && (
          <div className="mt-2 border-t border-hairline pt-2">
            <button
              onClick={() => setOpenThoughts((v) => !v)}
              className="flex w-full items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground transition hover:text-foreground"
            >
              <Brain className="h-3 w-3" />
              <span>{t("ai.thoughts")}</span>
              <ChevronRight className={cn("h-3 w-3 transition", openThoughts && "rotate-90")} />
            </button>
            {openThoughts && (
              <div className="mt-1.5 whitespace-pre-wrap rounded-md bg-accent/40 px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                {msg.thoughts}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visualisation pipeline — what the AI is currently transferring into
          the canvas / preview. Lives BELOW the chat text, never replaces it. */}
      {isLive && (
        <BuildPipeline
          step={msg.step ?? 0}
          ops={msg.toolOps ?? []}
          liveSteps={msg.liveSteps ?? []}
        />
      )}

      {/* Final tool ops list — collapsed under the bubble */}
      {!isLive && hasOps && <ToolOpsFeed ops={msg.toolOps!} />}
    </div>
  );
}

/** Compact "transferring to canvas" pipeline shown under the live chat bubble.
 *  Keeps the chat text pristine (just what AI says) and shows the build phase
 *  + live action feed separately. */
function BuildPipeline({
  step,
  ops,
  liveSteps,
}: {
  step: number;
  ops: ToolOp[];
  liveSteps: string[];
}) {
  const { t } = useI18n();
  const phases = [
    { icon: Brain, key: "ai.step.analyze" },
    { icon: Cpu, key: "ai.step.plan" },
    { icon: PencilLine, key: "ai.step.compose" },
  ];
  const hasActivity = ops.length > 0 || liveSteps.length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="reasoning-glass relative overflow-hidden rounded-xl px-3 py-2"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.78 0.18 280 / 80%), transparent)",
        }}
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
      />

      <div className="mb-1.5 flex items-center gap-1.5">
        <Cpu className="h-3 w-3 text-[oklch(0.78_0.18_280)]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">
          {t("ai.pipeline") /* falls back via i18n */}
        </span>
        {hasActivity && (
          <span className="ml-auto rounded-full bg-foreground/10 px-1.5 py-px font-mono text-[9px] text-foreground/80">
            {liveSteps.length || ops.length}
          </span>
        )}
      </div>

      <ol className="flex items-center gap-1.5">
        {phases.map((p, i) => {
          const state = i < step ? "done" : i === step ? "active" : "pending";
          const Icon = p.icon;
          return (
            <li key={p.key} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full border transition",
                  state === "done" && "border-foreground/40 bg-foreground/10 text-foreground/70",
                  state === "active" &&
                    "border-[oklch(0.78_0.18_280)] bg-[oklch(0.78_0.18_280/15%)] text-foreground shadow-[0_0_8px_0_oklch(0.78_0.18_280/40%)]",
                  state === "pending" && "border-hairline text-muted-foreground/50",
                )}
              >
                {state === "done" ? (
                  <Check className="h-2 w-2" />
                ) : state === "active" ? (
                  <Loader2 className="h-2 w-2 animate-spin" />
                ) : (
                  <Icon className="h-2 w-2" />
                )}
              </span>
              <span
                className={cn(
                  "text-[10.5px]",
                  state === "active" ? "text-foreground" : "text-muted-foreground/70",
                )}
              >
                {t(p.key)}
              </span>
              {i < phases.length - 1 && (
                <span className="mx-0.5 h-px w-3 bg-hairline" />
              )}
            </li>
          );
        })}
      </ol>

      <AnimatePresence initial={false}>
        {liveSteps.length > 0 && (
          <motion.ul
            key="live-steps"
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="mt-1.5 max-h-32 space-y-1 overflow-y-auto rounded-md border border-hairline bg-background/40 px-2 py-1.5"
          >
            <AnimatePresence initial={false}>
              {liveSteps.map((line, i) => (
                <motion.li
                  key={`${i}-${line}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-1.5 text-[11px] leading-snug text-foreground/85"
                >
                  <Check className="mt-[2px] h-2.5 w-2.5 shrink-0 text-status-ok" />
                  <span className="break-words">{line}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ToolOpsFeed({ ops, live = false }: { ops: ToolOp[]; live?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(live);
  const summarize = (op: ToolOp): string => {
    const a = op.args as any;
    switch (op.name) {
      case "reset_canvas": return t("ai.tools.reset_canvas");
      case "add_node": return `${t("ai.tools.add_node")}: ${a.title ?? a.kind ?? a.id ?? ""}`;
      case "connect": return `${t("ai.tools.connect")} ${a.from ?? "?"} → ${a.to ?? "?"}`;
      case "set_param": return `${t("ai.tools.set_param")} ${a.id ?? ""}.${a.key ?? ""} = ${String(a.value ?? "").slice(0, 30)}`;
      case "set_preview": return t("ai.tools.set_preview");
      case "set_miniapp": return t("ai.tools.set_miniapp");
      default: return op.name;
    }
  };
  return (
    <div className={cn("rounded-xl border border-hairline bg-surface/60 px-3 py-2", live && "border-foreground/20")}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground transition hover:text-foreground"
      >
        {live ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-status-ok" />}
        <span>{t("ai.tools.applied")} · {ops.length}</span>
        <ChevronRight className={cn("ml-auto h-3 w-3 transition", open && "rotate-90")} />
      </button>
      {open && (
        <ul className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-foreground/80">
          {ops.map((op, i) => (
            <li key={i} className="flex items-start gap-1.5 font-mono">
              <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
              <span className="break-all">{summarize(op)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ThinkingStepper({
  step,
  liveThoughts,
  liveSteps,
}: {
  step: number;
  liveThoughts: string;
  liveSteps: string[];
}) {
  const { t } = useI18n();
  const steps = [
    { icon: Brain, key: "ai.step.analyze" },
    { icon: Cpu, key: "ai.step.plan" },
    { icon: PencilLine, key: "ai.step.compose" },
  ];

  // Typewriter: reveal the streamed thoughts char-by-char so it reads as if
  // the model is literally typing its reasoning into the chat.
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (revealed >= liveThoughts.length) return;
    const id = window.setTimeout(() => {
      const chunk = Math.max(2, Math.ceil((liveThoughts.length - revealed) / 24));
      setRevealed((r) => Math.min(liveThoughts.length, r + chunk));
    }, 18);
    return () => window.clearTimeout(id);
  }, [liveThoughts, revealed]);

  // Reset when a brand-new turn begins
  useEffect(() => {
    if (liveThoughts.length === 0) setRevealed(0);
  }, [liveThoughts.length === 0]);

  const visibleThoughts = liveThoughts.slice(0, revealed);
  const stillTyping = revealed < liveThoughts.length;
  const hasLiveSteps = liveSteps.length > 0;
  const hasThoughtsStream = liveThoughts.trim().length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        layout: { type: "spring", stiffness: 260, damping: 28 },
        duration: 0.28,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="reasoning-glass relative overflow-hidden rounded-xl px-3 py-2.5"
    >
      {/* Animated shimmer sweep on the top border */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.78 0.18 280 / 80%), transparent)",
        }}
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
      />

      <motion.div layout="position" className="mb-2 flex items-center gap-1.5">
        <motion.div
          animate={{ scale: [1, 1.14, 1], rotate: [0, -4, 4, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="relative flex h-5 w-5 items-center justify-center rounded-md bg-foreground/10 text-[oklch(0.78_0.18_280)]"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-[-4px] rounded-lg blur-md"
            style={{ background: "oklch(0.78 0.18 280 / 35%)" }}
          />
          <Brain className="relative h-3 w-3" />
        </motion.div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/85">
          Architect Logic
        </span>
        <span className="text-[10px] text-muted-foreground">· {t("ai.thinking")}</span>
        {hasLiveSteps && (
          <span className="ml-auto rounded-full bg-foreground/10 px-1.5 py-px font-mono text-[9px] text-foreground/80">
            {liveSteps.length}
          </span>
        )}
        {!hasLiveSteps && stillTyping && (
          <span className="ml-auto font-mono text-[9px] text-muted-foreground/70">
            {revealed}/{liveThoughts.length}
          </span>
        )}
      </motion.div>

      <motion.ol layout="position" className="mb-2 space-y-1">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const state = i < step ? "done" : i === step ? "active" : "pending";
          return (
            <li
              key={s.key}
              className={cn(
                "flex items-center gap-2 text-[11px] transition",
                state === "done" && "text-foreground/70",
                state === "active" && "text-foreground",
                state === "pending" && "text-muted-foreground/40",
              )}
            >
              <span
                className={cn(
                  "flex h-3.5 w-3.5 items-center justify-center rounded-full border",
                  state === "done" && "border-foreground/40 bg-foreground/10",
                  state === "active" &&
                    "border-[oklch(0.78_0.18_280)] bg-[oklch(0.78_0.18_280/15%)] shadow-[0_0_8px_0_oklch(0.78_0.18_280/40%)]",
                  state === "pending" && "border-hairline",
                )}
              >
                {state === "done" ? (
                  <Check className="h-2 w-2" />
                ) : state === "active" ? (
                  <Loader2 className="h-2 w-2 animate-spin" />
                ) : (
                  <Icon className="h-2 w-2" />
                )}
              </span>
              <span>{t(s.key)}</span>
            </li>
          );
        })}
      </motion.ol>

      {/* Live action feed: synthesised plan derived from real tool calls.
       *  Each line slides in as the AI applies it to the canvas. */}
      <AnimatePresence initial={false}>
        {hasLiveSteps && (
          <motion.ul
            key="live-steps"
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="mt-1 max-h-44 space-y-1 overflow-y-auto rounded-md border border-hairline bg-background/40 px-2 py-1.5"
          >
            <AnimatePresence initial={false}>
              {liveSteps.map((line, i) => (
                <motion.li
                  key={`${i}-${line}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-1.5 text-[11px] leading-snug text-foreground/85"
                >
                  <Check className="mt-[2px] h-2.5 w-2.5 shrink-0 text-status-ok" />
                  <span className="break-words">{line}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {hasThoughtsStream && (
          <motion.div
            key="thoughts-stream"
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mt-2 max-h-32 overflow-hidden rounded-md border border-hairline bg-background/40 px-2 py-1.5 text-[11px] leading-relaxed text-foreground/85"
          >
            <span className={cn("whitespace-pre-wrap font-mono", stillTyping && "tw-caret")}>
              {visibleThoughts}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ModelDropdown({
  current,
  onChange,
}: {
  current: ModelId;
  onChange: (id: ModelId) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const def = MODELS.find((m) => m.id === current)!;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative border-b border-hairline px-3 py-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="hairline flex w-full items-center justify-between rounded-md bg-surface px-2.5 py-1.5 transition hover:bg-accent"
      >
        <span className="flex items-center gap-2">
          <span
            className="flex h-5 w-5 items-center justify-center rounded text-[8.5px] font-bold text-background"
            style={{ background: def.accent }}
          >
            {def.short}
          </span>
          <span className="text-[12px] font-medium">{t(def.labelKey)}</span>
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-3 right-3 top-full z-30 mt-1 overflow-hidden rounded-md border border-hairline bg-surface-elevated shadow-elevated">
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition hover:bg-accent",
                m.id === current && "bg-accent/60",
              )}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded text-[8.5px] font-bold text-background"
                style={{ background: m.accent }}
              >
                {m.short}
              </span>
              <span className="flex-1 font-medium">{t(m.labelKey)}</span>
              {m.routed && (
                <span className="rounded bg-accent px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("ai.model.routed")}
                </span>
              )}
              {m.id === current && <Check className="h-3 w-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
