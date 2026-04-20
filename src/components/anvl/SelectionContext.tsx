import { createContext, useContext, useState, type ReactNode } from "react";

interface Ctx {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

const SelCtx = createContext<Ctx | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return <SelCtx.Provider value={{ selectedId, setSelectedId }}>{children}</SelCtx.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelCtx);
  if (!ctx) throw new Error("useSelection must be used inside SelectionProvider");
  return ctx;
}
