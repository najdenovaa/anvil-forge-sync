import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlatform } from "./PlatformContext";
import { useI18n } from "./I18nContext";
import { useMiniApp, type MiniAppTab } from "./MiniAppContext";
import { DynamicMiniApp } from "./DynamicMiniApp";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import type { PreviewAction } from "@/lib/anvl-blueprint";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

export function PreviewPhone() {
  const { platform, miniAppEnabled } = usePlatform();
  const { t } = useI18n();
  const { view, open, close } = useMiniApp();
  const { preview } = useAnvlWorkspace();
  const isTg = platform === "telegram";
  const [opening, setOpening] = useState(false);
  const [chatScreenId, setChatScreenId] = useState<string | null>(null);
  const screens = preview.screens ?? [];
  const activeScreen = useMemo(
    () => (chatScreenId ? screens.find((screen) => screen.id === chatScreenId) : undefined),
    [chatScreenId, screens],
  );

  // If the user disables Mini App while it's shown — bounce back to chat.
  useEffect(() => {
    if (!miniAppEnabled && view === "miniapp") {
      close();
      setOpening(false);
    }
  }, [miniAppEnabled, view, close]);

  useEffect(() => {
    if (screens.length === 0) {
      setChatScreenId(null);
      return;
    }

    const initialScreenId =
      (preview.initialScreen && screens.some((screen) => screen.id === preview.initialScreen)
        ? preview.initialScreen
        : screens[0]?.id) ?? null;

    setChatScreenId(initialScreenId);
  }, [preview.initialScreen, preview.screens]);

  const handleOpen = (tab: MiniAppTab = "home") => {
    if (!miniAppEnabled) return;
    setOpening(true);
    setTimeout(() => {
      setOpening(false);
      open(tab);
    }, 600);
  };

  const handleAction = (action: PreviewAction) => {
    if (action.startsWith("screen:")) {
      const targetId = action.slice(7);
      if (screens.some((screen) => screen.id === targetId)) {
        setChatScreenId(targetId);
      }
      return;
    }

    if (!miniAppEnabled) {
      const fallbackScreen = screens.find((screen) => screen.id === action);
      if (fallbackScreen) {
        setChatScreenId(fallbackScreen.id);
      }
      return;
    }

    if (action === "open_miniapp") return handleOpen("home");
    if (action === "plans") return handleOpen("plans");
    if (action === "locations") return handleOpen("locations");
    return handleOpen("profile");
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
                activeScreen={activeScreen}
                preview={preview}
                miniAppEnabled={miniAppEnabled}
              />
            ) : (
              <div className="flex-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <DynamicMiniApp />
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

function ChatView({
  isTg,
  onAction,
  opening,
  activeScreen,
  preview,
  miniAppEnabled,
}: {
  isTg: boolean;
  onAction: (action: PreviewAction) => void;
  opening: boolean;
  activeScreen?: NonNullable<ReturnType<typeof useAnvlWorkspace>["preview"]["screens"]>[number];
  preview: ReturnType<typeof useAnvlWorkspace>["preview"];
  miniAppEnabled: boolean;
}) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const botMessages = activeScreen?.botMessages?.length
    ? activeScreen.botMessages
    : preview.botMessages?.length
      ? preview.botMessages
    : [t("preview.bot_msg_1"), t("preview.bot_msg_2")];

  const rawButtons = activeScreen
    ? activeScreen.buttons
    : preview.buttons?.length
      ? preview.buttons
    : [
        { label: t("preview.btn.open"), action: "open_miniapp" as const, primary: true },
        { label: t("preview.btn.pricing"), action: "plans" as const },
        { label: t("preview.btn.help"), action: "profile" as const },
      ];
  // Strip Mini App buttons when feature is disabled
  const buttons = miniAppEnabled
    ? rawButtons
    : rawButtons.filter((b) => b.action !== "open_miniapp" && b.action !== "locations");

  const handleMenuPick = (action: PreviewAction) => {
    setMenuOpen(false);
    onAction(action);
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
            {preview.botStatus ?? t("preview.bot_status")}
          </div>
        </div>
        <MoreVertical className="h-4 w-4 opacity-70" />
      </div>

      <div
        className={cn(
          "relative flex-1 space-y-2 overflow-hidden px-3 py-3",
          isTg
            ? "bg-[radial-gradient(circle_at_30%_20%,oklch(0.3_0.05_260)_0%,oklch(0.18_0.03_260)_70%)]"
            : "bg-[oklch(0.97_0_0)]",
        )}
      >
        <UserBubble isTg={isTg}>{activeScreen?.userMessage ?? preview.userMessage ?? t("preview.user_msg")}</UserBubble>
        {botMessages.map((message, index) => (
          <BotBubble key={`${message}-${index}`} isTg={isTg}>
            {index === botMessages.length - 1 ? (
              <div className="space-y-1">
                <span>{message}</span>
                <InlineKb isTg={isTg} opening={opening} items={buttons} onAction={onAction} />
              </div>
            ) : (
              message
            )}
          </BotBubble>
        ))}
        {opening && (
          <div className="flex items-center justify-center gap-1.5 pt-1 text-[10px] opacity-60">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("preview.opening")}
          </div>
        )}

        <AnimatePresence>
          {menuOpen && buttons.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "absolute bottom-2 left-2 right-2 z-10 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur",
                isTg
                  ? "border-white/10 bg-[oklch(0.24_0.03_260)/0.96]"
                  : "border-black/10 bg-white/95",
              )}
            >
              <div className={cn("px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider", isTg ? "text-white/40" : "text-black/40")}>
                {isTg ? "Bot Menu" : "Меню"}
              </div>
              <div className={cn("divide-y", isTg ? "divide-white/5" : "divide-black/5")}>
                {buttons.map((it) => (
                  <button
                    key={`menu-${it.action}-${it.label}`}
                    onClick={() => handleMenuPick(it.action)}
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
          <Mic className="h-3.5 w-3.5 [.has-text_&]:hidden" />
          <Send className="hidden h-3.5 w-3.5 [.has-text_&]:block" />
        </button>
      </div>
    </>
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
  items: { label: string; action: PreviewAction; primary?: boolean }[];
  onAction: (action: PreviewAction) => void;
}) {
  return (
    <div className="mt-1.5 grid grid-cols-1 gap-1">
      {items.map((it) => (
        <button
          key={`${it.action}-${it.label}`}
          onClick={() => onAction(it.action)}
          disabled={opening && it.primary}
          className={cn(
            "rounded-lg px-2 py-1.5 text-[10.5px] font-semibold transition disabled:opacity-50",
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
