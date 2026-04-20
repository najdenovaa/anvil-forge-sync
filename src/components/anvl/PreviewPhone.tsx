import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlatform } from "./PlatformContext";
import { useI18n } from "./I18nContext";
import { useMiniApp, type MiniAppTab } from "./MiniAppContext";
import { DynamicMiniApp } from "./DynamicMiniApp";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import { useTelegramWebApp } from "./TelegramWebAppContext";
import type { PreviewAction, AnvlPreviewButton, AnvlPreviewScreen } from "@/lib/anvl-blueprint";
import {
  Battery,
  Signal,
  Wifi,
  ArrowLeft,
  MoreVertical,
  Mic,
  Paperclip,
  Smile,
  Loader2,
  Menu,
  X,
  Send,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Turn =
  | { kind: "user"; text: string }
  | { kind: "bot"; text: string; buttons: AnvlPreviewButton[]; screenId?: string };

const BUILTIN_REPLIES: Record<string, string> = {
  plans: "📦 Тарифы:\n• Базовый — бесплатно\n• Pro — 299 ₽/мес\n• Team — 990 ₽/мес",
  help: "👋 Чем могу помочь? Опишите вопрос или выберите пункт ниже.",
  profile: "👤 Профиль: гость. Авторизуйтесь, чтобы открыть полный доступ.",
  open_miniapp: "Открываю Mini App…",
  locations: "📍 Список локаций пока не настроен.",
};

export function PreviewPhone() {
  const { platform, miniAppEnabled } = usePlatform();
  const { t } = useI18n();
  const { view, open, close } = useMiniApp();
  const { preview } = useAnvlWorkspace();
  const tma = useTelegramWebApp();
  const isTg = platform === "telegram";
  const [opening, setOpening] = useState(false);
  const [chatScreenId, setChatScreenId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const screens: AnvlPreviewScreen[] = preview.screens ?? [];

  // Resolve initial screen each time preview changes.
  const initialScreenId = useMemo(() => {
    if (screens.length === 0) return null;
    if (preview.initialScreen && screens.some((s) => s.id === preview.initialScreen)) {
      return preview.initialScreen;
    }
    return screens[0]?.id ?? null;
  }, [preview.initialScreen, screens]);

  const activeScreen = useMemo(
    () => (chatScreenId ? screens.find((s) => s.id === chatScreenId) : undefined),
    [chatScreenId, screens],
  );

  // Reset chat session whenever the underlying flow changes.
  useEffect(() => {
    setChatScreenId(initialScreenId);
    setTurns(buildOpeningTurns(preview, initialScreenId, t, miniAppEnabled));
    setTyping(false);
  }, [
    initialScreenId,
    preview.botMessages,
    preview.userMessage,
    preview.buttons,
    preview.screens,
    miniAppEnabled,
    t,
  ]);

  // Auto-scroll on new turns
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, typing]);

  // Bounce back to chat if Mini App turned off mid-session
  useEffect(() => {
    if (!miniAppEnabled && view === "miniapp") {
      close();
      setOpening(false);
    }
  }, [miniAppEnabled, view, close]);

  useEffect(() => {
    if (view === "chat") tma.reset();
  }, [view, tma]);

  const handleOpen = (tab: MiniAppTab = "home") => {
    if (!miniAppEnabled) return;
    setOpening(true);
    window.setTimeout(() => {
      setOpening(false);
      open(tab);
    }, 600);
  };

  const pushBotReply = (text: string, buttons: AnvlPreviewButton[], screenId?: string) => {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setTurns((prev) => [...prev, { kind: "bot", text, buttons, screenId }]);
    }, 480);
  };

  const handleAction = (btn: AnvlPreviewButton) => {
    // user bubble feedback
    setTurns((prev) => [...prev, { kind: "user", text: btn.label }]);

    const action = btn.action;

    // 1) explicit screen:<id>
    if (action.startsWith("screen:")) {
      const targetId = action.slice(7);
      const target = screens.find((s) => s.id === targetId);
      if (target) {
        setChatScreenId(targetId);
        const text = target.botMessages.join("\n");
        pushBotReply(text || target.id, target.buttons ?? [], target.id);
        return;
      }
      pushBotReply(`(экран «${targetId}» не настроен)`, currentButtons());
      return;
    }

    // 2) bare action that matches a screen id
    const matchingScreen = screens.find((s) => s.id === action);
    if (matchingScreen) {
      setChatScreenId(matchingScreen.id);
      pushBotReply(matchingScreen.botMessages.join("\n"), matchingScreen.buttons ?? [], matchingScreen.id);
      return;
    }

    // 3) Mini App routing
    if (miniAppEnabled && (action === "open_miniapp" || action === "plans" || action === "locations" || action === "profile")) {
      const tab: MiniAppTab =
        action === "plans" ? "plans" : action === "locations" ? "locations" : action === "profile" ? "profile" : "home";
      pushBotReply(BUILTIN_REPLIES[action] ?? "…", currentButtons());
      handleOpen(tab);
      return;
    }

    // 4) Built-in reply or synthesized fallback
    const reply = BUILTIN_REPLIES[action] ?? `→ ${btn.label}`;
    pushBotReply(reply, currentButtons());
  };

  const currentButtons = (): AnvlPreviewButton[] => {
    const raw = activeScreen?.buttons ?? preview.buttons ?? [];
    return miniAppEnabled
      ? raw
      : raw.filter((b) => b.action !== "open_miniapp" && b.action !== "locations");
  };

  const restartChat = () => {
    setChatScreenId(initialScreenId);
    setTurns(buildOpeningTurns(preview, initialScreenId, t, miniAppEnabled));
    setTyping(false);
  };

  return (
    <div className="hairline relative w-[280px] overflow-hidden rounded-[36px] bg-black p-2 shadow-[0_30px_80px_-30px_oklch(0_0_0_/_80%)]">
      <div className="relative overflow-hidden rounded-[28px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${platform}-${view}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "flex h-[520px] flex-col",
              isTg ? "bg-[oklch(0.22_0.03_260)]" : "bg-[oklch(0.96_0_0)] text-[oklch(0.16_0_0)]",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-between px-4 pt-2 text-[10px] font-medium",
                isTg ? "text-white/80" : "text-black/70",
              )}
            >
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <Signal className="h-2.5 w-2.5" />
                <Wifi className="h-2.5 w-2.5" />
                <Battery className="h-3 w-3" />
              </div>
            </div>

            {view === "chat" ? (
              <ChatView
                isTg={isTg}
                onAction={handleAction}
                opening={opening}
                preview={preview}
                turns={turns}
                typing={typing}
                scrollRef={scrollRef}
                onRestart={restartChat}
              />
            ) : (
              <div className="relative flex flex-1 flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {tma.backButton.visible && (
                  <button
                    onClick={tma.pressBackButton}
                    className="absolute left-2 top-2 z-20 flex h-7 items-center gap-1 rounded-md bg-black/40 px-2 text-[10px] font-medium text-white backdrop-blur"
                  >
                    <ArrowLeft className="h-3 w-3" /> Back
                  </button>
                )}
                <div className="flex-1 overflow-hidden">
                  <DynamicMiniApp />
                </div>
                <AnimatePresence>
                  {tma.mainButton.visible && (
                    <motion.button
                      key="tma-main-button"
                      initial={{ y: 40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 40, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      onClick={tma.mainButton.active ? tma.pressMainButton : undefined}
                      disabled={!tma.mainButton.active}
                      style={{
                        background: tma.mainButton.color,
                        color: tma.mainButton.textColor,
                      }}
                      className={cn(
                        "absolute inset-x-3 bottom-3 z-20 flex h-10 items-center justify-center gap-2 rounded-xl text-[12px] font-semibold uppercase tracking-[0.08em] shadow-[0_8px_24px_-8px_oklch(0_0_0/60%)] transition",
                        !tma.mainButton.active && "opacity-50",
                      )}
                    >
                      {tma.mainButton.progress && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {tma.mainButton.text}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="absolute left-1/2 top-0 h-4 w-20 -translate-x-1/2 rounded-b-2xl bg-black" />
      </div>

      <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full border border-hairline bg-surface px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {platform} · {view === "chat" ? "chat" : "mini app"}
      </div>

      {view === "miniapp" && (
        <button
          onClick={close}
          className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 rounded-full border border-hairline bg-surface-elevated px-3 py-1 text-[9.5px] font-medium text-foreground/80 shadow-elevated hover:text-foreground"
        >
          {t("vpn.back_to_chat")}
        </button>
      )}
    </div>
  );
}

function buildOpeningTurns(
  preview: ReturnType<typeof useAnvlWorkspace>["preview"],
  initialScreenId: string | null,
  t: (k: string) => string,
  miniAppEnabled: boolean,
): Turn[] {
  const screens = preview.screens ?? [];
  const screen = initialScreenId ? screens.find((s) => s.id === initialScreenId) : undefined;

  const userMessage = screen?.userMessage ?? preview.userMessage ?? t("preview.user_msg");
  const botMessages = screen?.botMessages?.length
    ? screen.botMessages
    : preview.botMessages?.length
      ? preview.botMessages
      : [t("preview.bot_msg_1"), t("preview.bot_msg_2")];

  const rawButtons = screen?.buttons ?? preview.buttons ?? [];
  const buttons = miniAppEnabled
    ? rawButtons
    : rawButtons.filter((b) => b.action !== "open_miniapp" && b.action !== "locations");

  const turns: Turn[] = [{ kind: "user", text: userMessage }];
  botMessages.forEach((m, idx) => {
    turns.push({
      kind: "bot",
      text: m,
      buttons: idx === botMessages.length - 1 ? buttons : [],
      screenId: idx === botMessages.length - 1 ? screen?.id : undefined,
    });
  });
  return turns;
}

function ChatView({
  isTg,
  onAction,
  opening,
  preview,
  turns,
  typing,
  scrollRef,
  onRestart,
}: {
  isTg: boolean;
  onAction: (btn: AnvlPreviewButton) => void;
  opening: boolean;
  preview: ReturnType<typeof useAnvlWorkspace>["preview"];
  turns: Turn[];
  typing: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  onRestart: () => void;
}) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  // Buttons available right now = buttons of the latest bot turn (or empty)
  const lastBotTurn = [...turns].reverse().find((tr): tr is Extract<Turn, { kind: "bot" }> => tr.kind === "bot");
  const liveButtons = lastBotTurn?.buttons ?? [];

  const handleMenuPick = (btn: AnvlPreviewButton) => {
    setMenuOpen(false);
    onAction(btn);
  };

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 border-b px-3 py-2",
          isTg ? "border-white/5 bg-[oklch(0.27_0.04_260)]" : "border-black/5 bg-white",
        )}
      >
        <ArrowLeft className="h-4 w-4 opacity-70" />
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold",
            isTg ? "bg-tg text-white" : "bg-max text-white",
          )}
        >
          {isTg ? "TG" : "M"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold">{preview.botName ?? t("preview.bot_name")}</div>
          <div className={cn("truncate text-[10px]", isTg ? "text-white/50" : "text-black/50")}>
            {typing ? "печатает…" : (preview.botStatus ?? t("preview.bot_status"))}
          </div>
        </div>
        <button
          type="button"
          onClick={onRestart}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full transition",
            isTg ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-black/50 hover:bg-black/5 hover:text-black",
          )}
          aria-label="restart"
          title="Перезапустить чат"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
        <MoreVertical className="h-4 w-4 opacity-70" />
      </div>

      <div
        ref={scrollRef}
        className={cn(
          "relative flex-1 space-y-2 overflow-y-auto px-3 py-3",
          isTg
            ? "bg-[radial-gradient(circle_at_30%_20%,oklch(0.3_0.05_260)_0%,oklch(0.18_0.03_260)_70%)]"
            : "bg-[oklch(0.97_0_0)]",
        )}
      >
        {turns.map((turn, idx) => {
          if (turn.kind === "user") {
            return (
              <UserBubble key={`u-${idx}`} isTg={isTg}>
                {turn.text}
              </UserBubble>
            );
          }
          const isLast = idx === turns.length - 1;
          return (
            <BotBubble key={`b-${idx}`} isTg={isTg}>
              <div className="space-y-1">
                <span className="whitespace-pre-wrap">{turn.text}</span>
                {isLast && turn.buttons.length > 0 && (
                  <InlineKb isTg={isTg} opening={opening} items={turn.buttons} onAction={onAction} />
                )}
              </div>
            </BotBubble>
          );
        })}

        {typing && (
          <BotBubble isTg={isTg}>
            <span className="inline-flex items-center gap-1">
              <Dot delay={0} isTg={isTg} />
              <Dot delay={0.15} isTg={isTg} />
              <Dot delay={0.3} isTg={isTg} />
            </span>
          </BotBubble>
        )}

        {opening && (
          <div className="flex items-center justify-center gap-1.5 pt-1 text-[10px] opacity-60">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("preview.opening")}
          </div>
        )}

        <AnimatePresence>
          {menuOpen && liveButtons.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "absolute bottom-2 left-2 right-2 z-10 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur",
                isTg ? "border-white/10 bg-[oklch(0.24_0.03_260)/0.96]" : "border-black/10 bg-white/95",
              )}
            >
              <div
                className={cn(
                  "px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider",
                  isTg ? "text-white/40" : "text-black/40",
                )}
              >
                {isTg ? "Bot Menu" : "Меню"}
              </div>
              <div className={cn("divide-y", isTg ? "divide-white/5" : "divide-black/5")}>
                {liveButtons.map((it) => (
                  <button
                    key={`menu-${it.action}-${it.label}`}
                    onClick={() => handleMenuPick(it)}
                    className={cn(
                      "block w-full px-3 py-2 text-left text-[11px] font-medium transition",
                      isTg ? "text-white hover:bg-white/5" : "text-black hover:bg-black/5",
                    )}
                  >
                    <span className={cn("mr-1.5 text-[10px]", isTg ? "text-tg" : "text-max")}>/</span>
                    {it.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div
        className={cn(
          "flex items-center gap-2 border-t px-2 py-2",
          isTg ? "border-white/5 bg-[oklch(0.24_0.03_260)]" : "border-black/5 bg-white",
        )}
      >
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition",
            menuOpen
              ? isTg
                ? "bg-tg text-white"
                : "bg-max text-white"
              : isTg
                ? "bg-white/5 text-white/70 hover:bg-white/10"
                : "bg-black/5 text-black/60 hover:bg-black/10",
          )}
          aria-label="menu"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={menuOpen ? "x" : "menu"}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex"
            >
              {menuOpen ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
            </motion.span>
          </AnimatePresence>
        </button>
        <div
          className={cn(
            "flex flex-1 items-center gap-1.5 rounded-full px-2.5 py-1.5",
            isTg ? "bg-white/5" : "bg-black/5",
          )}
        >
          <Smile className={cn("h-3.5 w-3.5 shrink-0", isTg ? "text-white/40" : "text-black/35")} />
          <span className={cn("flex-1 truncate text-[11px]", isTg ? "text-white/40" : "text-black/40")}>
            {t("preview.composer")}
          </span>
          <Paperclip className={cn("h-3.5 w-3.5 shrink-0", isTg ? "text-white/40" : "text-black/35")} />
        </div>
        <button
          type="button"
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            isTg ? "bg-tg text-white" : "bg-max text-white",
          )}
          aria-label="send"
        >
          <Mic className="h-3.5 w-3.5" />
          <Send className="hidden h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );
}

function Dot({ delay, isTg }: { delay: number; isTg: boolean }) {
  return (
    <motion.span
      animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
      transition={{ duration: 0.9, repeat: Infinity, delay, ease: "easeInOut" }}
      className={cn("inline-block h-1 w-1 rounded-full", isTg ? "bg-white/70" : "bg-black/50")}
    />
  );
}

function UserBubble({ children, isTg }: { children: React.ReactNode; isTg: boolean }) {
  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-1.5 text-[11px]",
          isTg
            ? "rounded-br-sm bg-[oklch(0.45_0.13_230)] text-white"
            : "rounded-br-sm bg-[oklch(0.72_0.18_30)] text-white",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function BotBubble({ children, isTg }: { children: React.ReactNode; isTg: boolean }) {
  return (
    <div className="flex justify-start">
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-1.5 text-[11px] leading-snug",
          isTg ? "rounded-bl-sm bg-white/10 text-white" : "rounded-bl-sm bg-white text-black shadow-sm",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function InlineKb({
  isTg,
  opening,
  items,
  onAction,
}: {
  isTg: boolean;
  opening: boolean;
  items: AnvlPreviewButton[];
  onAction: (btn: AnvlPreviewButton) => void;
}) {
  return (
    <div className="mt-1.5 grid grid-cols-1 gap-1">
      {items.map((it) => (
        <button
          key={`${it.action}-${it.label}`}
          type="button"
          onClick={() => onAction(it)}
          disabled={opening && it.primary}
          className={cn(
            "rounded-lg px-2 py-1.5 text-[10.5px] font-semibold transition active:scale-[0.97] disabled:opacity-50",
            it.primary
              ? isTg
                ? "bg-tg text-white hover:opacity-90"
                : "bg-max text-white hover:opacity-90"
              : isTg
                ? "bg-white/5 text-tg hover:bg-white/10"
                : "bg-[oklch(0.97_0_0)] text-max hover:bg-[oklch(0.94_0_0)]",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
