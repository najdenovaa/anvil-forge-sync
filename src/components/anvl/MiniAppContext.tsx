import { createContext, useContext, useState, type ReactNode } from "react";

export type MiniAppView = "chat" | "miniapp";
export type MiniAppTab = "home" | "locations" | "plans" | "profile";

interface MiniAppCtx {
  view: MiniAppView;
  targetTab: MiniAppTab;
  open: (tab?: MiniAppTab) => void;
  close: () => void;
  setTab: (tab: MiniAppTab) => void;
}

const Ctx = createContext<MiniAppCtx | null>(null);

export function MiniAppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<MiniAppView>("chat");
  const [targetTab, setTargetTab] = useState<MiniAppTab>("home");

  return (
    <Ctx.Provider
      value={{
        view,
        targetTab,
        open: (tab = "home") => {
          setTargetTab(tab);
          setView("miniapp");
        },
        close: () => setView("chat"),
        setTab: setTargetTab,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useMiniApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMiniApp must be used inside MiniAppProvider");
  return ctx;
}
