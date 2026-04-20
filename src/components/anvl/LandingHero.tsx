import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, MessageSquare, Zap, Globe } from "lucide-react";
import { useI18n } from "./I18nContext";
import { useAnvlShell } from "./AnvlAppShellContext";
import { usePlatform } from "./PlatformContext";
import { cn } from "@/lib/utils";
import anvlLogo from "@/assets/anvl-logo.png";

const SUGGESTIONS_RU = [
  { icon: Bot, label: "VPN-бот с тарифами и Mini App" },
  { icon: MessageSquare, label: "Бот-консультант для интернет-магазина" },
  { icon: Zap, label: "Бот напоминаний с ежедневным дайджестом" },
  { icon: Globe, label: "Многоязычный бот для поддержки" },
];

const SUGGESTIONS_EN = [
  { icon: Bot, label: "VPN bot with plans and a Mini App" },
  { icon: MessageSquare, label: "E-commerce assistant bot" },
  { icon: Zap, label: "Reminder bot with daily digest" },
  { icon: Globe, label: "Multilingual support bot" },
];

export function LandingHero() {
  const { t, lang, setLang } = useI18n();
  const { enterWorkspace } = useAnvlShell();
  const { platform, setPlatform, miniAppEnabled, setMiniAppEnabled } = usePlatform();
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    enterWorkspace(text);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const suggestions = lang === "ru" ? SUGGESTIONS_RU : SUGGESTIONS_EN;

  return (
    <div className="relative flex h-screen w-full flex-col bg-background text-foreground">
      {/* Ambient gradient backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-[-20%] h-[60vh] w-[80vw] -translate-x-1/2 rounded-full opacity-[0.18] blur-[120px]"
          style={{
            background:
              "radial-gradient(closest-side, oklch(0.78 0.14 85), transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-30%] right-[-10%] h-[60vh] w-[60vw] rounded-full opacity-[0.12] blur-[120px]"
          style={{
            background:
              "radial-gradient(closest-side, oklch(0.65 0.18 260), transparent 70%)",
          }}
        />
        <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,_color-mix(in_oklab,_var(--foreground)_8%,_transparent)_1px,_transparent_0)] [background-size:28px_28px] opacity-40" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <img
            src={anvlLogo}
            alt="Anvl"
            className="h-8 w-8 rounded-lg object-cover"
            draggable={false}
          />
          <span className="text-[14px] font-semibold tracking-[0.18em]">ANVL</span>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-hairline bg-surface/60 p-0.5 text-[11px] font-medium backdrop-blur">
          <button
            onClick={() => setLang("ru")}
            className={cn(
              "rounded-full px-2.5 py-1 transition",
              lang === "ru" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            RU
          </button>
          <button
            onClick={() => setLang("en")}
            className={cn(
              "rounded-full px-2.5 py-1 transition",
              lang === "en" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            EN
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto flex w-full max-w-[760px] flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface/70 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-ok opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-status-ok" />
          </span>
          {lang === "ru" ? "Anvl · визуальная IDE для ботов" : "Anvl · visual IDE for bots"}
        </div>

        <h1 className="text-center text-[40px] font-semibold leading-[1.05] tracking-[-0.025em] sm:text-[56px]">
          {lang === "ru" ? (
            <>
              Опишите бота —<br />
              <span className="text-muted-foreground">мы соберём его за вас</span>
            </>
          ) : (
            <>
              Describe a bot —<br />
              <span className="text-muted-foreground">we'll build it for you</span>
            </>
          )}
        </h1>

        <p className="mt-4 max-w-[520px] text-center text-[14px] leading-relaxed text-muted-foreground">
          {lang === "ru"
            ? "Anvl превратит вашу идею в готовый флоу, превью и код для Telegram и Max за секунды."
            : "Anvl turns your idea into a working flow, preview and code for Telegram and Max in seconds."}
        </p>

        {/* Composer */}
        <div className="mt-10 w-full">
          <div className="hairline group rounded-2xl bg-surface/80 p-2 shadow-elevated backdrop-blur transition focus-within:border-foreground/30">
            <textarea
              ref={taRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              rows={3}
              placeholder={
                lang === "ru"
                  ? "Например: бот-консьерж для отеля с бронированием и Mini App"
                  : "e.g. a hotel concierge bot with bookings and a Mini App"
              }
              className="block w-full resize-none bg-transparent px-3 pt-2.5 text-[14px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
            />
            <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-1.5">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-0.5 rounded-full border border-hairline bg-surface p-0.5">
                  <button
                    onClick={() => setPlatform("telegram")}
                    className={cn(
                      "rounded-full px-2 py-0.5 transition",
                      platform === "telegram" ? "bg-foreground text-background" : "hover:text-foreground",
                    )}
                  >
                    {t("platform.telegram")}
                  </button>
                  <button
                    onClick={() => setPlatform("max")}
                    className={cn(
                      "rounded-full px-2 py-0.5 transition",
                      platform === "max" ? "bg-foreground text-background" : "hover:text-foreground",
                    )}
                  >
                    {t("platform.max")}
                  </button>
                </div>
                <button
                  onClick={() => setMiniAppEnabled(!miniAppEnabled)}
                  className={cn(
                    "ml-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition",
                    miniAppEnabled
                      ? "border-foreground/30 bg-foreground/10 text-foreground"
                      : "border-hairline hover:text-foreground",
                  )}
                  title={t("platform.miniapp.hint")}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition",
                      miniAppEnabled ? "bg-status-ok" : "bg-muted-foreground/40",
                    )}
                  />
                  {t("platform.miniapp")}
                </button>
              </div>
              <button
                onClick={submit}
                disabled={!value.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background transition disabled:opacity-30"
                aria-label={lang === "ru" ? "Создать" : "Create"}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Suggestions */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {suggestions.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.label}
                  onClick={() => {
                    setValue(s.label);
                    requestAnimationFrame(() => taRef.current?.focus());
                  }}
                  className="hairline group inline-flex items-center gap-1.5 rounded-full bg-surface/60 px-3 py-1.5 text-[11.5px] text-muted-foreground transition hover:border-foreground/30 hover:bg-surface hover:text-foreground"
                >
                  <Icon className="h-3 w-3" />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="relative z-10 px-6 pb-5 text-center text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/70">
        {lang === "ru" ? "Telegram · Max · Mini Apps" : "Telegram · Max · Mini Apps"}
      </footer>
    </div>
  );
}
