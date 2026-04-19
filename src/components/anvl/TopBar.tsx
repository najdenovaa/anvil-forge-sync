import { ChevronDown, Rocket, Sparkles, Send } from "lucide-react";
import { usePlatform } from "./PlatformContext";
import { cn } from "@/lib/utils";

function AnvlMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
        <span className="font-mono text-[13px] font-bold leading-none">A</span>
        <div className="absolute -inset-px rounded-md ring-1 ring-inset ring-foreground/10" />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[15px] font-semibold tracking-tight">Anvl</span>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          AI
        </span>
      </div>
    </div>
  );
}

export function TopBar() {
  const { platform, setPlatform } = usePlatform();

  return (
    <header className="glass relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-hairline px-4">
      <div className="flex items-center gap-6">
        <AnvlMark />
        <div className="hidden h-5 w-px bg-hairline md:block" />
        <button className="hidden items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground md:flex">
          <span className="text-foreground">Welcome Bot</span>
          <span className="text-muted-foreground">/ main flow</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="hairline flex items-center rounded-full bg-surface p-0.5">
          <PlatformPill
            active={platform === "telegram"}
            onClick={() => setPlatform("telegram")}
            label="Telegram"
            icon={<Send className="h-3.5 w-3.5" />}
          />
          <PlatformPill
            active={platform === "max"}
            onClick={() => setPlatform("max")}
            label="Max"
            icon={<Sparkles className="h-3.5 w-3.5" />}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground sm:flex">
          Preview
        </button>
        <button className="group flex items-center gap-2 rounded-md bg-foreground px-3.5 py-1.5 text-[13px] font-medium text-background transition hover:bg-foreground/90">
          <Rocket className="h-3.5 w-3.5" />
          Deploy
        </button>
      </div>
    </header>
  );
}

function PlatformPill({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition",
        active
          ? "bg-foreground text-background shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
