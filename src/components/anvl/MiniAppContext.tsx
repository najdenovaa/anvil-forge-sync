import { createContext, useContext, useState, type ReactNode } from "react";

type View = "chat" | "miniapp";

interface MiniAppCtx {
  view: View;
  open: () => void;
  close: () => void;
}

const Ctx = createContext<MiniAppCtx | null>(null);

export function MiniAppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>("chat");
  return (
    <Ctx.Provider value={{ view, open: () => setView("miniapp"), close: () => setView("chat") }}>
      {children}
    </Ctx.Provider>
  );
}

export function useMiniApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMiniApp must be used inside MiniAppProvider");
  return ctx;
}
