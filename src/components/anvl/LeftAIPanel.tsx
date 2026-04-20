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
import { useI18n } from "./I18nContext";
import { cn } from "@/lib/utils";

type ModelId = "gpt" | "grok" | "gemini" | "claude";

interface ModelDef {
  id: ModelId;
  labelKey: string;
  short: string;
  available: boolean;
  accent: string;
}

const MODELS: ModelDef[] = [
  { id: "gpt", labelKey: "ai.model.gpt", short: "GPT", available: true, accent: "oklch(0.72_0.16_150)" },
  { id: "gemini", labelKey: "ai.model.gemini", short: "GEM", available: true, accent: "oklch(0.65_0.18_260)" },
  { id: "grok", labelKey: "ai.model.grok", short: "GROK", available: false, accent: "oklch(0.72_0.18_30)" },
  { id: "claude", labelKey: "ai.model.claude", short: "CL", available: false, accent: "oklch(0.72_0.16_60)" },
];

interface Msg {
  role: "user" | "assistant";
  content: string;
  /** Captured reasoning from <think>...</think> block. Streamed live, frozen on completion. */
  thoughts?: string;
  /** While true, render the live "thinking" stepper instead of message body. */
  pending?: boolean;
  /** 0..2 — index of the active reasoning step shown in the live stepper. */
  step?: number;
}

export function LeftAIPanel() {
  const { t } = useI18n();
  const [model, setModel] = useState<ModelId>("gemini");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: t("ai.msg.intro") },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Re-translate intro when language changes (only if it's still the only message)
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

  const send = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setError(null);
    setInput("");

    const userMsg: Msg = { role: "user", content: text };
    const placeholder: Msg = { role: "assistant", content: "", pending: true, step: 0, thoughts: "" };
    const baseHistory: Msg[] = [...messages, userMsg];
    setMessages([...baseHistory, placeholder]);
    setIsStreaming(true);

    // Animate the "thinking" stepper while waiting for first content token
    const stepTimer = setInterval(() => {
      setMessages((prev) => {
        const copy = prev.slice();
        const last = copy[copy.length - 1];
        if (last?.pending && (last.step ?? 0) < 2) {
          copy[copy.length - 1] = { ...last, step: (last.step ?? 0) + 1 };
        }
        return copy;
      });
    }, 700);

    const stopStepper = () => clearInterval(stepTimer);

    // Unsupported models — friendly fallback
    const def = MODELS.find((m) => m.id === model)!;
    if (!def.available) {
      stopStepper();
      setMessages([
        ...baseHistory,
        { role: "assistant", content: t("ai.unavailable") },
      ]);
      setIsStreaming(false);
      return;
    }

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/architect-chat`;
      // Send only clean role/content pairs to the model
      const wireMessages = baseHistory.map((m) => ({ role: m.role, content: m.content }));
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: wireMessages, model }),
      });

      if (resp.status === 429) {
        stopStepper();
        setError(t("ai.rate_limit"));
        setMessages(baseHistory);
        setIsStreaming(false);
        return;
      }
      if (resp.status === 402) {
        stopStepper();
        setError(t("ai.payment"));
        setMessages(baseHistory);
        setIsStreaming(false);
        return;
      }
      if (resp.status === 501) {
        stopStepper();
        setMessages([...baseHistory, { role: "assistant", content: t("ai.unavailable") }]);
        setIsStreaming(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("network");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let raw = ""; // full streamed text including <think> tags
      let thoughts = "";
      let answer = "";
      // Streaming parser state for <think>...</think>
      // 0 = before <think> (assume thinking by default), 1 = inside think, 2 = after think
      let phase: 0 | 1 | 2 = 0;
      let pending = ""; // tail buffer to detect tag boundaries

      const flush = () => {
        setMessages((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (!last || last.role !== "assistant") return prev;
          copy[copy.length - 1] = {
            ...last,
            thoughts,
            content: answer,
            pending: phase !== 2 && answer.length === 0,
          };
          return copy;
        });
      };

      const ingest = (chunk: string) => {
        raw += chunk;
        pending += chunk;

        // Process pending while we can make decisions
        // We keep up to 12 chars in pending to safely detect "<think>" / "</think>"
        const SAFE_TAIL = 12;
        while (pending.length > 0) {
          if (phase === 0) {
            const open = pending.indexOf("<think>");
            if (open !== -1) {
              // Anything before <think> is treated as answer (rare, but safe)
              answer += pending.slice(0, open);
              pending = pending.slice(open + "<think>".length);
              phase = 1;
              stopStepper();
              continue;
            }
            // If no clear opener and we have enough buffer, but model didn't emit <think>,
            // treat as direct answer.
            if (pending.length > SAFE_TAIL) {
              const safe = pending.slice(0, pending.length - SAFE_TAIL);
              if (safe.length) {
                answer += safe;
                pending = pending.slice(safe.length);
                stopStepper();
              }
            }
            break;
          }
          if (phase === 1) {
            const close = pending.indexOf("</think>");
            if (close !== -1) {
              thoughts += pending.slice(0, close);
              pending = pending.slice(close + "</think>".length);
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
          // phase === 2 — straight to answer
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
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) ingest(delta);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
      // Flush remaining buffered text
      if (pending.length > 0) {
        if ((phase as number) === 1) thoughts += pending;
        else answer += pending;
        pending = "";
      }
      // If model never emitted a closing tag but we got nothing in answer,
      // promote thoughts to answer so user still sees something.
      if (!answer.trim() && thoughts.trim()) {
        answer = thoughts.trim();
        thoughts = "";
      }
      // Mark assistant message as finalized
      setMessages((prev) => {
        const copy = prev.slice();
        const last = copy[copy.length - 1];
        if (last?.role === "assistant") {
          copy[copy.length - 1] = {
            role: "assistant",
            content: answer || raw, // raw fallback if parser failed entirely
            thoughts: thoughts.trim() || undefined,
          };
        }
        return copy;
      });
    } catch (e) {
      console.error("architect-chat failed", e);
      setError(t("ai.error"));
      setMessages(baseHistory);
    } finally {
      stopStepper();
      setIsStreaming(false);
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
    setError(null);
  };

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-r border-hairline bg-sidebar">
      {/* Header */}
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

      {/* Model picker */}
      <ModelDropdown current={model} onChange={setModel} />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} />
        ))}
        {error && (
          <div className="rounded-xl border border-status-err/40 bg-status-err/10 px-3 py-2 text-[11.5px] text-status-err">
            {error}
          </div>
        )}
      </div>

      {/* Composer */}
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
            onClick={send}
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

  return (
    <div className="max-w-[88%] space-y-1.5">
      {/* Live "thinking" stepper while we wait for first content token */}
      {isLive && <ThinkingStepper step={msg.step ?? 0} liveThoughts={msg.thoughts ?? ""} />}

      {/* Final / streaming answer bubble */}
      {(msg.content.length > 0 || !isLive) && (
        <div className="rounded-xl border border-hairline bg-surface px-3 py-2 text-[12.5px] leading-relaxed text-foreground/90">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            <Sparkles className="h-3 w-3" /> {t("ai.label")}
          </div>
          {msg.content ? (
            <div className="whitespace-pre-wrap">{msg.content}</div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> {t("ai.thinking")}
            </span>
          )}

          {/* Collapsed reasoning trace, available after answer is in */}
          {!isLive && hasThoughts && (
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
      )}
    </div>
  );
}

function ThinkingStepper({ step, liveThoughts }: { step: number; liveThoughts: string }) {
  const { t } = useI18n();
  const steps = [
    { icon: Brain, key: "ai.step.analyze" },
    { icon: Cpu, key: "ai.step.plan" },
    { icon: PencilLine, key: "ai.step.compose" },
  ];
  return (
    <div className="rounded-xl border border-hairline bg-surface px-3 py-2.5">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        <Sparkles className="h-3 w-3" /> {t("ai.label")} · {t("ai.thinking")}
      </div>
      <ol className="space-y-1">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const state = i < step ? "done" : i === step ? "active" : "pending";
          return (
            <li
              key={s.key}
              className={cn(
                "flex items-center gap-2 text-[11.5px] transition",
                state === "done" && "text-foreground/70",
                state === "active" && "text-foreground",
                state === "pending" && "text-muted-foreground/50",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full border",
                  state === "done" && "border-foreground/40 bg-foreground/10",
                  state === "active" && "border-foreground bg-foreground/15",
                  state === "pending" && "border-hairline",
                )}
              >
                {state === "done" ? (
                  <Check className="h-2.5 w-2.5" />
                ) : state === "active" ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <Icon className="h-2.5 w-2.5" />
                )}
              </span>
              <span>{t(s.key)}</span>
            </li>
          );
        })}
      </ol>
      {liveThoughts.trim().length > 0 && (
        <div className="mt-2 max-h-24 overflow-hidden whitespace-pre-wrap rounded-md bg-accent/40 px-2 py-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
          {liveThoughts}
        </div>
      )}
    </div>
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
              {!m.available && (
                <span className="rounded bg-accent px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("ai.model.soon")}
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
