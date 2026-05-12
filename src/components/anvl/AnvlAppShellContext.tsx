import { createContext, useContext, useState, type ReactNode } from "react";

type Stage = "landing" | "workspace";

interface Ctx {
  stage: Stage;
  initialPrompt: string | null;
  enterWorkspace: (prompt: string) => void;
  goLanding: () => void;
  consumeInitialPrompt: () => string | null;
}

const ShellCtx = createContext<Ctx | null>(null);

export function AnvlAppShellProvider({ children, defaultStage = "landing" }: { children: ReactNode; defaultStage?: Stage }) {
  const [stage, setStage] = useState<Stage>(defaultStage);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  const enterWorkspace = (prompt: string) => {
    setInitialPrompt(prompt.trim() || null);
    setStage("workspace");
  };

  const goLanding = () => {
    setStage("landing");
    setInitialPrompt(null);
  };

  const consumeInitialPrompt = () => {
    const p = initialPrompt;
    setInitialPrompt(null);
    return p;
  };

  return (
    <ShellCtx.Provider value={{ stage, initialPrompt, enterWorkspace, goLanding, consumeInitialPrompt }}>
      {children}
    </ShellCtx.Provider>
  );
}

export function useAnvlShell() {
  const ctx = useContext(ShellCtx);
  if (!ctx) throw new Error("useAnvlShell must be used inside AnvlAppShellProvider");
  return ctx;
}
