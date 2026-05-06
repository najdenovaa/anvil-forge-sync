import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as TgUi from "@telegram-apps/telegram-ui";
import "@telegram-apps/telegram-ui/dist/styles.css";
const TgUiAny = TgUi as unknown as Record<string, unknown> & { default?: Record<string, unknown> };
const TgUiNs = (TgUiAny.default ?? TgUiAny) as {
  AppRoot: React.ComponentType<React.PropsWithChildren<{ appearance?: "light" | "dark"; platform?: "ios" | "base"; style?: React.CSSProperties }>>;
  Button: React.ComponentType<React.PropsWithChildren<{ mode?: "filled" | "bezeled" | "plain" | "gray" | "outline" | "white"; size?: "s" | "m" | "l"; stretched?: boolean; onClick?: () => void }>>;
};
const AppRoot = TgUiNs.AppRoot;
const TgButton = TgUiNs.Button;
import { usePlatform } from "./PlatformContext";
import { useI18n } from "./I18nContext";
import { useMiniApp, type MiniAppTab } from "./MiniAppContext";
import { DynamicMiniApp } from "./DynamicMiniApp";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import { useTelegramWebApp } from "./TelegramWebAppContext";
import { useBotSimulator, type SimButton } from "./BotSimulatorContext";
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
  Sun,
  Moon,
  Crosshair,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Telegram theme palettes (mapped to --tg-theme-* CSS variables)             */
/* -------------------------------------------------------------------------- */

const TG_THEME = {
  dark: {
    "--tg-theme-bg-color": "#17212b",
    "--tg-theme-secondary-bg-color": "#232e3c",
    "--tg-theme-text-color": "#ffffff",
    "--tg-theme-hint-color": "#7d8c99",
    "--tg-theme-link-color": "#6ab3f3",
    "--tg-theme-button-color": "#5288c1",
    "--tg-theme-button-text-color": "#ffffff",
    "--tg-theme-header-bg-color": "#1d2733",
    "--tg-theme-section-bg-color": "#17212b",
    "--tg-theme-section-header-text-color": "#6ab3f3",
    "--tg-theme-subtitle-text-color": "#7d8c99",
    "--tg-theme-accent-text-color": "#6ab3f3",
    "--tg-theme-destructive-text-color": "#ec3942",
  },
  light: {
    "--tg-theme-bg-color": "#ffffff",
    "--tg-theme-secondary-bg-color": "#efeff4",
    "--tg-theme-text-color": "#000000",
    "--tg-theme-hint-color": "#999999",
    "--tg-theme-link-color": "#2481cc",
    "--tg-theme-button-color": "#2481cc",
    "--tg-theme-button-text-color": "#ffffff",
    "--tg-theme-header-bg-color": "#527da3",
    "--tg-theme-section-bg-color": "#ffffff",
    "--tg-theme-section-header-text-color": "#6d6d72",
    "--tg-theme-subtitle-text-color": "#999999",
    "--tg-theme-accent-text-color": "#2481cc",
    "--tg-theme-destructive-text-color": "#ff3b30",
  },
} as const;

type ThemeMode = "light" | "dark";

/* -------------------------------------------------------------------------- */
/* PreviewPhone — top-level frame                                             */
/* -------------------------------------------------------------------------- */

export function PreviewPhone() {
  const { platform, miniAppEnabled } = usePlatform();
  const { t } = useI18n();
  const { view, open, close } = useMiniApp();
  const { preview } = useAnvlWorkspace();
  const tma = useTelegramWebApp();
  const sim = useBotSimulator();
  const isTg = platform === "telegram";
  const [opening, setOpening] = useState(false);
  // Default theme: tg = dark, max = light
  const [theme, setTheme] = useState<ThemeMode>(isTg ? "dark" : "light");

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

  // Reset theme default when platform switches.
  useEffect(() => {
    setTheme(isTg ? "dark" : "light");
  }, [isTg]);

  const handleOpen = (tab: MiniAppTab = "home") => {
    if (!miniAppEnabled) return;
    setOpening(true);
    window.setTimeout(() => {
      setOpening(false);
      open(tab);
    }, 600);
  };

  const themeVars = TG_THEME[theme] as Record<string, string>;

  return (
    <div className="relative w-[284px]">
      {/* Soft ambient glow behind the device — lifts it off the canvas */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 -z-10 rounded-[80px] opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 55%, oklch(0.78 0.14 230 / 22%) 0%, oklch(0.16 0.004 270 / 0%) 70%)",
        }}
      />

      {/* Phone shell — photoreal aluminium bezel */}
      <div
        className="relative w-full overflow-hidden rounded-[44px] p-[6px]"
        style={{
          background:
            "linear-gradient(160deg, oklch(0.34 0.005 270) 0%, oklch(0.12 0.004 270) 38%, oklch(0.05 0 0) 60%, oklch(0.22 0.004 270) 100%)",
          boxShadow:
            // Outer drop shadow (massive soft glow)
            "0 40px 80px -20px oklch(0 0 0 / 80%), 0 20px 40px -10px oklch(0 0 0 / 60%), 0 0 60px -10px oklch(0.78 0.14 230 / 14%)," +
            // Inner top highlight + bottom shadow for depth
            " inset 0 1.5px 0 0 oklch(1 0 0 / 18%), inset 0 -1px 0 0 oklch(0 0 0 / 60%), inset 0 0 0 1px oklch(1 0 0 / 6%)",
        }}
      >
        {/* Inner screen well — slight inset so it reads like glass under bezel */}
        <div
          className="relative overflow-hidden rounded-[38px]"
          style={{
            ...(themeVars as React.CSSProperties),
            boxShadow:
              "inset 0 0 0 1px oklch(0 0 0 / 80%), inset 0 2px 6px 0 oklch(0 0 0 / 60%)",
          }}
        >
          <AppRoot
            appearance={theme}
            platform="ios"
            style={{ display: "block" }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${platform}-${view}-${theme}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="flex h-[520px] flex-col"
                style={{
                  background: "var(--tg-theme-bg-color)",
                  color: "var(--tg-theme-text-color)",
                }}
              >
                <StatusBar theme={theme} />

                {view === "chat" ? (
                  sim.available ? (
                    <SimulatorChatView
                      isTg={isTg}
                      theme={theme}
                      onToggleTheme={() => setTheme((m) => (m === "dark" ? "light" : "dark"))}
                      onOpenMiniApp={handleOpen}
                    />
                  ) : (
                    <EmptyCanvasHint theme={theme} />
                  )
                ) : (
                  <MiniAppView opening={opening} tma={tma} theme={theme} />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Dynamic Island — floats over the screen, not cut from bezel */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1.5 flex h-[22px] -translate-x-1/2 items-center gap-1 rounded-full px-3"
              style={{
                background: "oklch(0 0 0)",
                boxShadow:
                  "0 0 0 1px oklch(1 0 0 / 5%), 0 4px 10px -2px oklch(0 0 0 / 80%), inset 0 0 8px 0 oklch(0 0 0 / 90%)",
                minWidth: "92px",
              }}
            >
              <span
                className="block h-1.5 w-1.5 rounded-full"
                style={{
                  background: "oklch(0.55 0.04 230)",
                  boxShadow: "0 0 4px 0 oklch(0.7 0.16 230 / 60%)",
                }}
              />
              <span
                className="ml-auto block h-1 w-1 rounded-full opacity-70"
                style={{ background: "oklch(0.4 0.005 270)" }}
              />
            </div>

            {/* Subtle top-edge specular highlight on the screen */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px opacity-40"
              style={{
                background:
                  "linear-gradient(90deg, transparent, oklch(1 0 0 / 60%), transparent)",
              }}
            />
          </AppRoot>
        </div>
      </div>

      {/* Side hardware buttons — pure visual flourish */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[3px] top-[110px] h-8 w-[3px] rounded-l-md"
        style={{ background: "linear-gradient(90deg, oklch(0.05 0 0), oklch(0.18 0.004 270))" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[3px] top-[160px] h-14 w-[3px] rounded-l-md"
        style={{ background: "linear-gradient(90deg, oklch(0.05 0 0), oklch(0.18 0.004 270))" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[3px] top-[140px] h-20 w-[3px] rounded-r-md"
        style={{ background: "linear-gradient(270deg, oklch(0.05 0 0), oklch(0.18 0.004 270))" }}
      />

      {/* Status pill above */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-hairline bg-surface/90 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
        {platform} · {view === "chat" ? "chat" : "mini app"}
      </div>

      {view === "miniapp" && (
        <button
          onClick={close}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-hairline bg-surface-elevated px-3 py-1 text-[9.5px] font-medium text-foreground/80 shadow-elevated hover:text-foreground"
        >
          {t("vpn.back_to_chat")}
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Status bar (iOS-like)                                                      */
/* -------------------------------------------------------------------------- */

function StatusBar({ theme }: { theme: ThemeMode }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-6 pb-1 pt-2.5 text-[10px] font-medium",
        theme === "dark" ? "text-white/80" : "text-black/70",
      )}
    >
      <span>9:41</span>
      {/* spacer for the Dynamic Island in the middle */}
      <span className="w-[92px]" aria-hidden />
      <div className="flex items-center gap-1">
        <Signal className="h-2.5 w-2.5" />
        <Wifi className="h-2.5 w-2.5" />
        <Battery className="h-3 w-3" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty-canvas hint                                                          */
/* -------------------------------------------------------------------------- */

function EmptyCanvasHint({ theme }: { theme: ThemeMode }) {
  const { t } = useI18n();
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
      style={{ color: "var(--tg-theme-hint-color)" }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
        style={{ background: "var(--tg-theme-secondary-bg-color)" }}
      >
        💬
      </div>
      <div className="text-[12px] font-semibold" style={{ color: "var(--tg-theme-text-color)" }}>
        {t("preview.empty.title") || "Канвас пуст"}
      </div>
      <div className="text-[10.5px] leading-snug">
        {t("preview.empty.hint") || "Опиши бота слева — Anvl построит флоу и оживит превью."}
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-[0.14em]" style={{ opacity: 0.6 }}>
        live · canvas-driven · {theme}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mini App view (unchanged behaviour, themed via vars)                       */
/* -------------------------------------------------------------------------- */

function MiniAppView({
  opening,
  tma,
  theme,
}: {
  opening: boolean;
  tma: ReturnType<typeof useTelegramWebApp>;
  theme: ThemeMode;
}) {
  return (
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
              background: tma.mainButton.color || "var(--tg-theme-button-color)",
              color: tma.mainButton.textColor || "var(--tg-theme-button-text-color)",
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
      {opening && (
        <div className="absolute inset-x-0 top-7 z-30 flex items-center justify-center gap-1.5 text-[10px] opacity-60">
          <Loader2 className="h-3 w-3 animate-spin" /> opening…
        </div>
      )}
      <div
        className="absolute right-2 top-2 z-20 rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider"
        style={{ background: "var(--tg-theme-secondary-bg-color)", color: "var(--tg-theme-hint-color)" }}
      >
        {theme}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Simulator chat view — canvas as the source of truth                        */
/* -------------------------------------------------------------------------- */

type SimTurn =
  | { kind: "user"; text: string }
  | {
      kind: "bot";
      text: string;
      imageUrl?: string;
      imageCaption?: string;
      buttons: SimButton[];
      apiCall?: { method: string; url: string; pseudoId: string };
      conditionExpr?: string;
      warning?: string;
      isLast: boolean;
    };

function SimulatorChatView({
  isTg,
  theme,
  onToggleTheme,
  onOpenMiniApp,
}: {
  isTg: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenMiniApp: (tab?: MiniAppTab) => void;
}) {
  const { t } = useI18n();
  const { preview, miniAppEnabled } = useAnvlWorkspace() as ReturnType<typeof useAnvlWorkspace> & {
    miniAppEnabled?: boolean;
  };
  const { miniAppEnabled: miniOn } = usePlatform();
  const sim = useBotSimulator();
  const [menuOpen, setMenuOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [typing, setTyping] = useState(false);
  const [apiStage, setApiStage] = useState<"sending" | "done" | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [userInputs, setUserInputs] = useState<Record<string, string>>({});

  // Reset apiStage whenever active node changes.
  useEffect(() => {
    setApiStage(null);
  }, [sim.activeNodeId]);

  // Drive the action.api 2-stage animation: sending → done → advance.
  useEffect(() => {
    if (!sim.message?.apiCall) return;
    setApiStage("sending");
    const t1 = window.setTimeout(() => setApiStage("done"), 1500);
    const t2 = window.setTimeout(() => sim.advance(), 2700);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [sim.message?.apiCall, sim]);

  const turns = useMemo<SimTurn[]>(() => {
    const out: SimTurn[] = [];
    sim.history.forEach((nid) => {
      const echo = userInputs[nid];
      if (echo) out.push({ kind: "user", text: echo });
    });
    if (sim.message) {
      out.push({
        kind: "bot",
        text: sim.message.text,
        imageUrl: sim.message.imageUrl,
        imageCaption: sim.message.imageCaption,
        buttons: sim.message.buttons,
        apiCall: sim.message.apiCall,
        conditionExpr: sim.message.conditionExpr,
        warning: sim.message.warning,
        isLast: true,
      });
    }
    return out;
  }, [sim.history, sim.message, userInputs]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, typing, apiStage]);

  const isCondition = sim.effectiveKind === "logic.condition";

  const triggerMiniAppIfNeeded = (btn: SimButton) => {
    if (!miniOn) return;
    const signal = `${btn.label} ${btn.action}`.toLowerCase();
    if (signal.includes("open_miniapp") || signal.includes("mini") || signal.includes("приложение") || signal.includes("открыть")) {
      onOpenMiniApp("home");
    } else if (signal.includes("plans")) {
      onOpenMiniApp("plans");
    } else if (signal.includes("locations") || signal.includes("items")) {
      onOpenMiniApp("locations");
    } else if (signal.includes("profile")) {
      onOpenMiniApp("profile");
    }
  };

  const handlePress = (btn: SimButton) => {
    setUserInputs((prev) => ({ ...prev, [sim.activeNodeId!]: btn.label }));
    setTyping(true);
    triggerMiniAppIfNeeded(btn);
    window.setTimeout(() => {
      setTyping(false);
      sim.press(btn);
    }, 550);
  };

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    const text = inputValue.trim();
    setUserInputs((prev) => ({ ...prev, [sim.activeNodeId!]: text }));
    setInputValue("");
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      sim.submitInput(text);
    }, 380);
  };

  const handleBranch = (b: "yes" | "no") => {
    setUserInputs((prev) => ({
      ...prev,
      [sim.activeNodeId!]: b === "yes" ? "✓ Simulate Success" : "✕ Simulate Fail",
    }));
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      sim.setBranch(b);
    }, 380);
  };

  const handleRestart = () => {
    setUserInputs({});
    sim.restart();
  };

  const liveButtons =
    turns.length > 0 && turns[turns.length - 1].kind === "bot"
      ? (turns[turns.length - 1] as Extract<SimTurn, { kind: "bot" }>).buttons
      : [];

  return (
    <>
      {/* ───── Chat header ───── */}
      <div
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{
          background: "var(--tg-theme-header-bg-color)",
          borderColor: "color-mix(in oklab, var(--tg-theme-text-color) 8%, transparent)",
        }}
      >
        <button
          type="button"
          onClick={() => sim.back()}
          disabled={sim.history.length === 0}
          className="flex h-6 w-6 items-center justify-center rounded-full transition disabled:opacity-30 hover:bg-white/10"
          style={{ color: "var(--tg-theme-button-text-color)" }}
          aria-label="back"
          title="Назад"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold",
            isTg ? "bg-tg text-white" : "bg-max text-white",
          )}
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          {isTg ? "TG" : "M"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold" style={{ color: "var(--tg-theme-button-text-color)" }}>
            {preview.botName ?? t("preview.bot_name")}
          </div>
          <div
            className="truncate text-[10px]"
            style={{ color: "color-mix(in oklab, var(--tg-theme-button-text-color) 60%, transparent)" }}
          >
            {typing ? "печатает…" : "online · live flow"}
          </div>
        </div>

        {/* Camera follow toggle */}
        <button
          type="button"
          onClick={() => sim.setCameraFollow(!sim.cameraFollow)}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full transition",
            sim.cameraFollow ? "bg-white/25" : "hover:bg-white/10",
          )}
          style={{ color: "var(--tg-theme-button-text-color)" }}
          aria-label="follow"
          title={sim.cameraFollow ? "Камера следует за активной нодой" : "Камера статична"}
        >
          <Crosshair className="h-3 w-3" />
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-white/10"
          style={{ color: "var(--tg-theme-button-text-color)" }}
          aria-label="theme"
          title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
        >
          {theme === "dark" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
        </button>

        {/* Restart */}
        <button
          type="button"
          onClick={handleRestart}
          className="flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-white/10"
          style={{ color: "var(--tg-theme-button-text-color)" }}
          aria-label="restart"
          title="Перезапустить"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
        <MoreVertical className="h-4 w-4 opacity-70" style={{ color: "var(--tg-theme-button-text-color)" }} />
      </div>

      {/* ───── Conversation ───── */}
      <div
        ref={scrollRef}
        className="relative flex-1 space-y-2 overflow-y-auto px-3 py-3"
        style={{
          background:
            theme === "dark"
              ? "radial-gradient(circle at 30% 20%, color-mix(in oklab, var(--tg-theme-bg-color) 100%, white 6%) 0%, var(--tg-theme-bg-color) 70%)"
              : "var(--tg-theme-secondary-bg-color)",
        }}
      >
        {turns.map((turn, idx) => {
          if (turn.kind === "user") {
            return (
              <UserBubble key={`u-${idx}`} theme={theme}>
                {turn.text}
              </UserBubble>
            );
          }
          return (
            <motion.div
              key={`b-${idx}`}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {turn.warning ? (
                <WarningPlate text={turn.warning} />
              ) : turn.apiCall ? (
                <BotBubble theme={theme}>
                  <ApiCallBubble call={turn.apiCall} stage={apiStage ?? "sending"} />
                </BotBubble>
              ) : turn.conditionExpr ? (
                <BotBubble theme={theme}>
                  <ConditionPrompt expr={turn.conditionExpr} onChoose={handleBranch} />
                </BotBubble>
              ) : (
                <BotBubble theme={theme}>
                  <div className="space-y-1.5">
                    {turn.imageUrl && <PhotoBlock url={turn.imageUrl} caption={turn.imageCaption} />}
                    {turn.text && <span className="whitespace-pre-wrap">{turn.text}</span>}
                    {turn.isLast && isCondition && !turn.conditionExpr && (
                      <ConditionToggle onChoose={handleBranch} />
                    )}
                    {turn.isLast && turn.buttons.length > 0 && (
                      <SimInlineKb items={turn.buttons} onAction={handlePress} />
                    )}
                  </div>
                </BotBubble>
              )}
            </motion.div>
          );
        })}

        {typing && (
          <BotBubble theme={theme}>
            <span className="inline-flex items-center gap-1">
              <Dot delay={0} />
              <Dot delay={0.15} />
              <Dot delay={0.3} />
            </span>
          </BotBubble>
        )}

        <AnimatePresence>
          {menuOpen && liveButtons.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="absolute bottom-2 left-2 right-2 z-10 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur"
              style={{
                background: "color-mix(in oklab, var(--tg-theme-secondary-bg-color) 96%, transparent)",
                borderColor: "color-mix(in oklab, var(--tg-theme-text-color) 10%, transparent)",
              }}
            >
              <div
                className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--tg-theme-hint-color)" }}
              >
                Bot Menu
              </div>
              <div
                className="divide-y"
                style={{
                  borderColor: "color-mix(in oklab, var(--tg-theme-text-color) 6%, transparent)",
                }}
              >
                {liveButtons.map((it) => (
                  <button
                    key={`menu-${it.id}-${it.label}`}
                    onClick={() => {
                      setMenuOpen(false);
                      handlePress(it);
                    }}
                    className="block w-full px-3 py-2 text-left text-[11px] font-medium transition hover:bg-white/5"
                    style={{ color: "var(--tg-theme-text-color)" }}
                  >
                    <span className="mr-1.5 text-[10px]" style={{ color: "var(--tg-theme-link-color)" }}>
                      /
                    </span>
                    {it.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ───── Composer ───── */}
      <div
        className="flex items-center gap-2 border-t px-2 py-2"
        style={{
          background: "var(--tg-theme-secondary-bg-color)",
          borderColor: "color-mix(in oklab, var(--tg-theme-text-color) 6%, transparent)",
        }}
      >
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition"
          style={{
            background: menuOpen ? "var(--tg-theme-button-color)" : "color-mix(in oklab, var(--tg-theme-text-color) 6%, transparent)",
            color: menuOpen ? "var(--tg-theme-button-text-color)" : "var(--tg-theme-text-color)",
          }}
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
          className="flex flex-1 items-center gap-1.5 rounded-full px-2.5 py-1.5"
          style={{ background: "color-mix(in oklab, var(--tg-theme-text-color) 5%, transparent)" }}
        >
          <Smile className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--tg-theme-hint-color)" }} />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={sim.awaitingInput ? "Введите ответ…" : t("preview.composer")}
            className="flex-1 bg-transparent text-[11px] outline-none"
            style={{ color: "var(--tg-theme-text-color)" }}
          />
          <Paperclip className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--tg-theme-hint-color)" }} />
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!inputValue.trim()}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40"
          style={{
            background: "var(--tg-theme-button-color)",
            color: "var(--tg-theme-button-text-color)",
          }}
          aria-label="send"
        >
          {inputValue.trim() ? <Send className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        </button>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Inline keyboard powered by @telegram-apps/telegram-ui Button               */
/* -------------------------------------------------------------------------- */

function SimInlineKb({
  items,
  onAction,
}: {
  items: SimButton[];
  onAction: (btn: SimButton) => void;
}) {
  return (
    <div className="mt-1.5 grid grid-cols-1 gap-1">
      {items.map((it) => (
        <TgButton
          key={it.id}
          mode={it.primary ? "filled" : "bezeled"}
          size="s"
          stretched
          onClick={() => onAction(it)}
          /* tg-ui Button respects --tg-theme-button-color automatically */
        >
          {it.label}
        </TgButton>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Branch toggle for logic.condition nodes                                    */
/* -------------------------------------------------------------------------- */

function ConditionToggle({ onChoose }: { onChoose: (b: "yes" | "no") => void }) {
  return (
    <div className="mt-1.5 space-y-1">
      <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--tg-theme-hint-color)" }}>
        Simulate condition
      </div>
      <div className="grid grid-cols-2 gap-1">
        <TgButton mode="filled" size="s" stretched onClick={() => onChoose("yes")}>
          ✓ Success
        </TgButton>
        <TgButton mode="bezeled" size="s" stretched onClick={() => onChoose("no")}>
          ✕ Fail
        </TgButton>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bubbles                                                                    */
/* -------------------------------------------------------------------------- */

function UserBubble({ children, theme }: { children: React.ReactNode; theme: ThemeMode }) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[80%] rounded-2xl rounded-br-sm px-3 py-1.5 text-[11px]"
        style={{
          background:
            theme === "dark"
              ? "color-mix(in oklab, var(--tg-theme-button-color) 92%, white 0%)"
              : "color-mix(in oklab, var(--tg-theme-button-color) 90%, white 0%)",
          color: "var(--tg-theme-button-text-color)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function BotBubble({ children, theme }: { children: React.ReactNode; theme: ThemeMode }) {
  return (
    <div className="flex justify-start">
      <div
        className="max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-1.5 text-[11px] leading-snug shadow-sm"
        style={{
          background:
            theme === "dark"
              ? "color-mix(in oklab, var(--tg-theme-text-color) 10%, transparent)"
              : "var(--tg-theme-section-bg-color)",
          color: "var(--tg-theme-text-color)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
      transition={{ duration: 0.9, repeat: Infinity, delay, ease: "easeInOut" }}
      className="inline-block h-1 w-1 rounded-full"
      style={{ background: "var(--tg-theme-hint-color)" }}
    />
  );
}
