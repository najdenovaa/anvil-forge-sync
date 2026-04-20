import { ChevronDown, Rocket, Send, AppWindow, Check, Loader2, AlertCircle, FolderOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { usePlatform } from "./PlatformContext";
import { useI18n, type Lang } from "./I18nContext";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import { VersionHistory } from "./VersionHistory";
import { cn } from "@/lib/utils";
import anvlLogo from "@/assets/anvl-logo.png";
import maxLogo from "@/assets/max-logo.png";

function AnvlMark() {
  return (
    <div className="flex items-center">
      <img
        src={anvlLogo}
        alt="ANVL"
        className="h-16 w-auto object-contain"
        draggable={false}
      />
    </div>
  );
}

export function TopBar() {
  const { platform, setPlatform, miniAppEnabled, setMiniAppEnabled } = usePlatform();
  const { t, lang, setLang } = useI18n();

  return (
    <header className="glass relative z-30 flex h-16 shrink-0 items-center justify-between border-b border-hairline px-4">
      <div className="flex items-center gap-6">
        <AnvlMark />
        <div className="hidden h-5 w-px bg-hairline md:block" />
        <Link
          to="/flows"
          className="hidden items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground md:flex"
        >
          <FolderOpen className="h-3.5 w-3.5 opacity-70" />
          <span className="text-foreground">{t("topbar.project")}</span>
          <FlowSlugLabel />
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="hairline flex items-center rounded-full bg-surface p-0.5">
          <PlatformPill
            active={platform === "telegram"}
            onClick={() => setPlatform("telegram")}
            label={t("platform.telegram")}
            icon={<Send className="h-3.5 w-3.5" />}
          />
          <PlatformPill
            active={platform === "max"}
            onClick={() => setPlatform("max")}
            label={t("platform.max")}
            icon={
              <img
                src={maxLogo}
                alt="Max"
                className={cn(
                  "h-3.5 w-3.5 object-contain transition",
                  platform === "max" ? "invert brightness-0" : "opacity-60",
                )}
                draggable={false}
              />
            }
          />
        </div>

        <button
          onClick={() => setMiniAppEnabled(!miniAppEnabled)}
          title={t("platform.miniapp.hint")}
          className={cn(
            "hairline flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition",
            miniAppEnabled
              ? "border-transparent bg-foreground text-background"
              : "bg-surface text-muted-foreground hover:text-foreground",
          )}
        >
          <span
            className={cn(
              "flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border transition",
              miniAppEnabled
                ? "border-background bg-background text-foreground"
                : "border-muted-foreground/40",
            )}
          >
            {miniAppEnabled && <span className="text-[9px] font-bold leading-none">✓</span>}
          </span>
          <AppWindow className="h-3.5 w-3.5" />
          {t("platform.miniapp")}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <SaveIndicator />
        <VersionHistory />
        <LangToggle lang={lang} setLang={setLang} t={t} />
        <button className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground sm:flex">
          {t("topbar.preview")}
        </button>
        <button className="group flex items-center gap-2 rounded-md bg-foreground px-3.5 py-1.5 text-[13px] font-medium text-background transition hover:bg-foreground/90">
          <Rocket className="h-3.5 w-3.5" />
          {t("topbar.deploy")}
        </button>
      </div>
    </header>
  );
}

function FlowSlugLabel() {
  const { slug } = useAnvlWorkspace();
  return <span className="font-mono text-[11px] text-muted-foreground">{slug}</span>;
}

function SaveIndicator() {
  const { saveStatus, lastSavedAt } = useAnvlWorkspace();

  const label = (() => {
    if (saveStatus === "saving") return "Saving…";
    if (saveStatus === "error") return "Save failed";
    if (saveStatus === "saved" && lastSavedAt) {
      const diff = Math.max(0, Math.floor((Date.now() - lastSavedAt.getTime()) / 1000));
      if (diff < 5) return "Saved";
      if (diff < 60) return `Saved ${diff}s ago`;
      return `Saved ${Math.floor(diff / 60)}m ago`;
    }
    return "Auto-save";
  })();

  const Icon =
    saveStatus === "saving" ? Loader2 : saveStatus === "error" ? AlertCircle : Check;

  return (
    <div className="hairline hidden items-center gap-2 rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground md:flex">
      <Icon
        className={cn(
          "h-3 w-3",
          saveStatus === "saving" && "animate-spin text-foreground/70",
          saveStatus === "error" && "text-destructive",
          saveStatus === "saved" && "text-foreground",
        )}
      />
      <span suppressHydrationWarning>{label}</span>
    </div>
  );
}

function LangToggle({
  lang,
  setLang,
  t,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="hairline flex items-center rounded-full bg-surface p-0.5">
      <LangPill active={lang === "ru"} onClick={() => setLang("ru")} label={t("lang.ru")} />
      <LangPill active={lang === "en"} onClick={() => setLang("en")} label={t("lang.en")} />
    </div>
  );
}

function LangPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wider transition",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
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
