import { createContext, useContext, useState, type ReactNode } from "react";
import type { Platform } from "@/lib/anvl-types";

interface Ctx {
  platform: Platform;
  setPlatform: (p: Platform) => void;
  miniAppEnabled: boolean;
  setMiniAppEnabled: (v: boolean) => void;
}

const PlatformCtx = createContext<Ctx | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [platform, setPlatform] = useState<Platform>("telegram");
  // Default OFF: user must opt in to building a Mini App.
  const [miniAppEnabled, setMiniAppEnabled] = useState(false);
  return (
    <PlatformCtx.Provider value={{ platform, setPlatform, miniAppEnabled, setMiniAppEnabled }}>
      {children}
    </PlatformCtx.Provider>
  );
}

export function usePlatform() {
  const ctx = useContext(PlatformCtx);
  if (!ctx) throw new Error("usePlatform must be used inside PlatformProvider");
  return ctx;
}
