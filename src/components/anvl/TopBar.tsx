import { ChevronDown, Rocket, Sparkles, Send, AppWindow } from "lucide-react";
import { usePlatform } from "./PlatformContext";
import { useI18n, type Lang } from "./I18nContext";
import { cn } from "@/lib/utils";
import anvlLogo from "@/assets/anvl-logo.png";

function AnvlMark() {
  return (
    <div className="flex items-center">
      <img
        src={anvlLogo}
        alt="ANVL"
        className="h-10 w-auto object-contain"
        draggable={false}
      />
    </div>
  );
}

export function TopBar() {
  const { platform, setPlatform, miniAppEnabled, setMiniAppEnabled } = usePlatform();
  const { t, lang, setLang } = useI18n();

  return (
    <header className="glass relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-hairline px-4">
      <div className="flex items-center gap-6">
        <AnvlMark />
        <div className="hidden h-5 w-px bg-hairline md:block" />
        <button className="hidden items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground md:flex">
          <span className="text-foreground">{t("topbar.project")}</span>
          <span className="text-muted-foreground" suppressHydrationWarning>{t("topbar.flow")}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
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
            icon={<Sparkles className="h-3.5 w-3.5" />}
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
