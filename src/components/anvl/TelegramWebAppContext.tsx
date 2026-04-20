import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createTelegramWebAppMock, type TmaMockHandle } from "@/lib/telegram-webapp-mock";

interface TmaCtx {
  /** Public live snapshot of MainButton/BackButton state (for UI rendering). */
  mainButton: {
    text: string;
    color: string;
    textColor: string;
    visible: boolean;
    active: boolean;
    progress: boolean;
  };
  backButton: { visible: boolean };
  /** Click handlers — UI buttons in the preview frame fire these. */
  pressMainButton: () => void;
  pressBackButton: () => void;
  /** Reset handlers when the preview view changes. */
  reset: () => void;
}

const Ctx = createContext<TmaCtx | null>(null);

/**
 * Installs a mock `window.Telegram.WebApp` so any code (including the dynamic
 * preview Mini App) can call the same SDK that runs inside Telegram.
 */
export function TelegramWebAppProvider({ children }: { children: ReactNode }) {
  const [, force] = useState(0);
  const handleRef = useRef<TmaMockHandle | null>(null);

  if (handleRef.current === null && typeof window !== "undefined") {
    const handle = createTelegramWebAppMock({
      onChange: () => force((n) => n + 1),
    });
    handleRef.current = handle;
    // Install on window so generated code finds it like inside Telegram.
    window.Telegram = { WebApp: handle.webApp };
  }

  useEffect(() => {
    handleRef.current?.webApp.ready();
  }, []);

  const value = useMemo<TmaCtx>(() => {
    const h = handleRef.current;
    return {
      mainButton: {
        text: h?.state.mainButtonText ?? "CONTINUE",
        color: h?.state.mainButtonColor ?? "#3390EC",
        textColor: h?.state.mainButtonTextColor ?? "#FFFFFF",
        visible: h?.state.mainButtonVisible ?? false,
        active: h?.state.mainButtonActive ?? true,
        progress: h?.state.mainButtonProgress ?? false,
      },
      backButton: { visible: h?.state.backButtonVisible ?? false },
      pressMainButton: () => h?.triggerMainClick(),
      pressBackButton: () => h?.triggerBackClick(),
      reset: () => h?.reset(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleRef.current?.state.mainButtonText,
      handleRef.current?.state.mainButtonColor,
      handleRef.current?.state.mainButtonTextColor,
      handleRef.current?.state.mainButtonVisible,
      handleRef.current?.state.mainButtonActive,
      handleRef.current?.state.mainButtonProgress,
      handleRef.current?.state.backButtonVisible]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTelegramWebApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTelegramWebApp must be used inside TelegramWebAppProvider");
  return ctx;
}
