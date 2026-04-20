import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  Power,
  Globe2,
  CreditCard,
  User,
  ChevronRight,
  Check,
  Smartphone,
  Gift,
  LifeBuoy,
  LogOut,
  ArrowDownToLine,
  ArrowUpFromLine,
  Zap,
} from "lucide-react";
import { useI18n } from "./I18nContext";
import { useMiniApp } from "./MiniAppContext";
import { usePlatform } from "./PlatformContext";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import { cn } from "@/lib/utils";

type Tab = "home" | "locations" | "plans" | "profile";
type Status = "off" | "connecting" | "on";

interface Server {
  id: string;
  countryKey: string;
  cityKey: string;
  flag: string;
  ping: number;
  load: number;
  pro?: boolean;
}

const SERVERS: Server[] = [
  { id: "nl-ams", countryKey: "vpn.country.nl", cityKey: "vpn.city.ams", flag: "🇳🇱", ping: 24, load: 18 },
  { id: "de-fra", countryKey: "vpn.country.de", cityKey: "vpn.city.fra", flag: "🇩🇪", ping: 31, load: 42 },
  { id: "us-nyc", countryKey: "vpn.country.us", cityKey: "vpn.city.nyc", flag: "🇺🇸", ping: 112, load: 61, pro: true },
  { id: "jp-tok", countryKey: "vpn.country.jp", cityKey: "vpn.city.tok", flag: "🇯🇵", ping: 198, load: 33, pro: true },
  { id: "sg-sgp", countryKey: "vpn.country.sg", cityKey: "vpn.city.sgp", flag: "🇸🇬", ping: 174, load: 27, pro: true },
  { id: "ae-dxb", countryKey: "vpn.country.ae", cityKey: "vpn.city.dxb", flag: "🇦🇪", ping: 86, load: 51, pro: true },
];

export function VpnMiniApp() {
  const { t } = useI18n();
  const { view, targetTab, close } = useMiniApp();
  const { platform } = usePlatform();
  const { miniApp } = useAnvlWorkspace();
  const isTg = platform === "telegram";
  const [tab, setTab] = useState<Tab>(targetTab);
  const [status, setStatus] = useState<Status>("off");
  const [server, setServer] = useState<Server>(SERVERS[0]);
  const [plan, setPlan] = useState<"free" | "pro" | "team">(miniApp.plan ?? "free");

  // Sync tab when user opens mini app to a specific section from chat
  useEffect(() => {
    if (view === "miniapp") setTab(targetTab);
  }, [view, targetTab]);

  // Sync plan when AI updates it
  useEffect(() => {
    if (miniApp.plan) setPlan(miniApp.plan);
  }, [miniApp.plan]);

  const brandTitle = miniApp.title?.trim() || t("vpn.title");
  const brandSubtitle = miniApp.subtitle?.trim() || t("vpn.subtitle");

  // Simulate connect lifecycle
  useEffect(() => {
    if (status !== "connecting") return;
    const tm = setTimeout(() => setStatus("on"), 1400);
    return () => clearTimeout(tm);
  }, [status]);

  const handleToggle = () => {
    if (status === "off") setStatus("connecting");
    else setStatus("off");
  };

  const handlePickServer = (s: Server) => {
    if (s.pro && plan === "free") {
      setTab("plans");
      return;
    }
    setServer(s);
    setStatus("connecting");
    setTab("home");
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col text-[12px]",
        isTg
          ? "bg-[oklch(0.18_0.03_260)] text-white"
          : "bg-[oklch(0.97_0_0)] text-[oklch(0.16_0_0)]",
      )}
    >
      {/* Mini app top header (close back to chat) */}
      <div
        className={cn(
          "flex items-center justify-between border-b px-3 py-2",
          isTg ? "border-white/5 bg-[oklch(0.22_0.03_260)]" : "border-black/5 bg-white",
        )}
      >
        <button
          onClick={close}
          className={cn(
            "text-[10.5px] font-medium",
            isTg ? "text-white/70 hover:text-white" : "text-black/60 hover:text-black",
          )}
        >
          {t("vpn.back_to_chat")}
        </button>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          <Shield className="h-3 w-3" />
          {t("vpn.title")}
        </div>
        <div className="w-12" />
      </div>

      {/* Body */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="h-full overflow-y-auto"
          >
            {tab === "home" && (
              <HomeTab
                isTg={isTg}
                status={status}
                server={server}
                onToggle={handleToggle}
                onChangeServer={() => setTab("locations")}
              />
            )}
            {tab === "locations" && (
              <LocationsTab isTg={isTg} servers={SERVERS} onPick={handlePickServer} active={server.id} planFree={plan === "free"} />
            )}
            {tab === "plans" && <PlansTab isTg={isTg} plan={plan} setPlan={setPlan} />}
            {tab === "profile" && <ProfileTab isTg={isTg} plan={plan} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom tabs */}
      <div
        className={cn(
          "grid grid-cols-4 border-t",
          isTg ? "border-white/5 bg-[oklch(0.22_0.03_260)]" : "border-black/5 bg-white",
        )}
      >
        <TabBtn isTg={isTg} active={tab === "home"} onClick={() => setTab("home")} icon={<Power className="h-3.5 w-3.5" />} label={t("vpn.tab.home")} />
        <TabBtn isTg={isTg} active={tab === "locations"} onClick={() => setTab("locations")} icon={<Globe2 className="h-3.5 w-3.5" />} label={t("vpn.tab.locations")} />
        <TabBtn isTg={isTg} active={tab === "plans"} onClick={() => setTab("plans")} icon={<CreditCard className="h-3.5 w-3.5" />} label={t("vpn.tab.plans")} />
        <TabBtn isTg={isTg} active={tab === "profile"} onClick={() => setTab("profile")} icon={<User className="h-3.5 w-3.5" />} label={t("vpn.tab.profile")} />
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
  isTg,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  isTg: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 py-2 text-[9px] font-medium transition",
        active
          ? isTg
            ? "text-tg"
            : "text-max"
          : isTg
            ? "text-white/45 hover:text-white/70"
            : "text-black/45 hover:text-black/70",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function HomeTab({
  isTg,
  status,
  server,
  onToggle,
  onChangeServer,
}: {
  isTg: boolean;
  status: Status;
  server: Server;
  onToggle: () => void;
  onChangeServer: () => void;
}) {
  const { t } = useI18n();
  const isOn = status === "on";
  const isConn = status === "connecting";
  const accent = isTg ? "tg" : "max";

  return (
    <div className="flex h-full flex-col items-center px-4 pt-5 pb-4">
      <div className="text-[10px] uppercase tracking-[0.18em] opacity-50">
        {isOn
          ? t("vpn.status.connected")
          : isConn
            ? t("vpn.status.connecting")
            : t("vpn.status.disconnected")}
      </div>

      {/* Big shield button */}
      <button
        onClick={onToggle}
        disabled={isConn}
        className="relative mt-4 flex h-32 w-32 items-center justify-center rounded-full"
      >
        {/* pulse rings when on */}
        {isOn && (
          <>
            <span className={cn("absolute inset-0 animate-ping rounded-full opacity-30", `bg-${accent}`)} />
            <span className={cn("absolute -inset-2 rounded-full opacity-20", `bg-${accent}`)} />
          </>
        )}
        <span
          className={cn(
            "relative flex h-28 w-28 items-center justify-center rounded-full transition",
            isOn
              ? `bg-${accent} text-white shadow-[0_10px_40px_-10px_oklch(0.6_0.18_230_/_60%)]`
              : isTg
                ? "bg-white/10 text-white"
                : "bg-black/8 text-black shadow-inner",
            isConn && "animate-pulse",
          )}
        >
          {isOn ? <ShieldCheck className="h-12 w-12" /> : <Power className="h-12 w-12" />}
        </span>
      </button>

      <div className="mt-3 text-[13px] font-semibold">
        {isOn ? t("vpn.disconnect") : isConn ? t("vpn.connecting") : t("vpn.connect")}
      </div>

      {/* Current server */}
      <button
        onClick={onChangeServer}
        className={cn(
          "mt-5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
          isTg ? "bg-white/5 hover:bg-white/10" : "bg-white shadow-sm hover:shadow",
        )}
      >
        <span className="text-xl leading-none">{server.flag}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.12em] opacity-50">
            {t("vpn.current_server")}
          </div>
          <div className="truncate text-[12px] font-medium">
            {t(server.countryKey)} · {t(server.cityKey)}
          </div>
        </div>
        <ChevronRight className="h-3.5 w-3.5 opacity-50" />
      </button>

      {/* Stats */}
      <div className="mt-3 grid w-full grid-cols-2 gap-2">
        <Stat
          isTg={isTg}
          icon={<ArrowDownToLine className="h-3 w-3" />}
          label={t("vpn.speed_down")}
          value={isOn ? "84.2" : "—"}
          unit="Mb/s"
        />
        <Stat
          isTg={isTg}
          icon={<ArrowUpFromLine className="h-3 w-3" />}
          label={t("vpn.speed_up")}
          value={isOn ? "32.1" : "—"}
          unit="Mb/s"
        />
        <Stat
          isTg={isTg}
          icon={<Globe2 className="h-3 w-3" />}
          label={isOn ? t("vpn.protected_ip") : t("vpn.your_ip")}
          value={isOn ? "185.²⁴.³¹.⁹⁸" : "94.₁₂.₃₄.⁵⁶"}
          mono
        />
        <Stat
          isTg={isTg}
          icon={<Zap className="h-3 w-3" />}
          label={t("vpn.ping")}
          value={String(server.ping)}
          unit="ms"
        />
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  unit,
  mono,
  isTg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  mono?: boolean;
  isTg: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-2.5 py-2",
        isTg ? "bg-white/5" : "bg-white shadow-sm",
      )}
    >
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.1em] opacity-50">
        {icon}
        {label}
      </div>
      <div className={cn("mt-0.5 truncate text-[11.5px] font-semibold", mono && "font-mono")}>
        {value}
        {unit && <span className="ml-1 text-[9px] font-normal opacity-50">{unit}</span>}
      </div>
    </div>
  );
}

function LocationsTab({
  isTg,
  servers,
  onPick,
  active,
  planFree,
}: {
  isTg: boolean;
  servers: Server[];
  onPick: (s: Server) => void;
  active: string;
  planFree: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="px-3 py-3">
      <div className="mb-2 px-1 text-[10px] uppercase tracking-[0.14em] opacity-50">
        {t("vpn.choose_location")}
      </div>
      <div className="space-y-1.5">
        {servers.map((s) => {
          const locked = s.pro && planFree;
          const isActive = s.id === active;
          return (
            <button
              key={s.id}
              onClick={() => onPick(s)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                isActive
                  ? isTg
                    ? "bg-tg/15 ring-1 ring-tg/40"
                    : "bg-max/10 ring-1 ring-max/40"
                  : isTg
                    ? "bg-white/5 hover:bg-white/10"
                    : "bg-white shadow-sm hover:shadow",
                locked && "opacity-60",
              )}
            >
              <span className="text-lg leading-none">{s.flag}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11.5px] font-medium">{t(s.countryKey)}</div>
                <div className="text-[9.5px] opacity-50">{t(s.cityKey)}</div>
              </div>
              <div className="flex flex-col items-end text-[9.5px]">
                <span className="font-semibold">{s.ping}<span className="opacity-50"> ms</span></span>
                <PingBar load={s.load} isTg={isTg} />
              </div>
              {locked ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider",
                    isTg ? "bg-white/10 text-white/70" : "bg-black/8 text-black/60",
                  )}
                >
                  Pro
                </span>
              ) : (
                isActive && <Check className="h-3.5 w-3.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PingBar({ load, isTg }: { load: number; isTg: boolean }) {
  const color =
    load < 35
      ? "bg-status-ok"
      : load < 65
        ? "bg-status-warn"
        : "bg-status-err";
  return (
    <div className={cn("mt-0.5 h-1 w-12 overflow-hidden rounded-full", isTg ? "bg-white/10" : "bg-black/8")}>
      <div className={cn("h-full", color)} style={{ width: `${load}%` }} />
    </div>
  );
}

function PlansTab({
  isTg,
  plan,
  setPlan,
}: {
  isTg: boolean;
  plan: "free" | "pro" | "team";
  setPlan: (p: "free" | "pro" | "team") => void;
}) {
  const { t } = useI18n();
  const plans: { id: "free" | "pro" | "team"; price: string; key: string; descKey: string; highlight?: boolean }[] = [
    { id: "free", price: "0₽", key: "vpn.free", descKey: "vpn.plan.free.desc" },
    { id: "pro", price: "299₽", key: "vpn.pro", descKey: "vpn.plan.pro.desc", highlight: true },
    { id: "team", price: "799₽", key: "vpn.team", descKey: "vpn.plan.team.desc" },
  ];
  return (
    <div className="space-y-2 px-3 py-3">
      {plans.map((p) => {
        const current = plan === p.id;
        return (
          <div
            key={p.id}
            className={cn(
              "rounded-xl border px-3 py-3",
              p.highlight
                ? isTg
                  ? "border-tg/50 bg-tg/10"
                  : "border-max/40 bg-max/5"
                : isTg
                  ? "border-white/10 bg-white/5"
                  : "border-black/8 bg-white shadow-sm",
            )}
          >
            <div className="flex items-baseline justify-between">
              <div className="text-[13px] font-semibold">{t(p.key)}</div>
              <div className="text-[12px] font-bold">
                {p.price}
                <span className="text-[9.5px] font-normal opacity-50">{t("vpn.month")}</span>
              </div>
            </div>
            <div className="mt-1 text-[10.5px] opacity-70">{t(p.descKey)}</div>
            <button
              onClick={() => setPlan(p.id)}
              disabled={current}
              className={cn(
                "mt-2.5 w-full rounded-md py-1.5 text-[11px] font-semibold transition",
                current
                  ? isTg
                    ? "bg-white/10 text-white/60"
                    : "bg-black/8 text-black/50"
                  : isTg
                    ? "bg-tg text-white hover:opacity-90"
                    : "bg-max text-white hover:opacity-90",
              )}
            >
              {current ? t("vpn.plan.current") : t("vpn.plan.upgrade")}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ProfileTab({ isTg, plan }: { isTg: boolean; plan: "free" | "pro" | "team" }) {
  const { t } = useI18n();
  const items = [
    { icon: <Smartphone className="h-3.5 w-3.5" />, label: t("vpn.profile.devices"), badge: plan === "free" ? "1/1" : "2/5" },
    { icon: <Gift className="h-3.5 w-3.5" />, label: t("vpn.profile.referral"), badge: "+30 дн." },
    { icon: <LifeBuoy className="h-3.5 w-3.5" />, label: t("vpn.profile.support") },
    { icon: <LogOut className="h-3.5 w-3.5" />, label: t("vpn.profile.signout") },
  ];
  return (
    <div className="px-3 py-3">
      <div
        className={cn(
          "mb-3 flex items-center gap-3 rounded-xl px-3 py-3",
          isTg ? "bg-white/5" : "bg-white shadow-sm",
        )}
      >
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold",
            isTg ? "bg-tg text-white" : "bg-max text-white",
          )}
        >
          С
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold">Sasha</div>
          <div className="text-[10px] opacity-60">@sasha · {t(`vpn.${plan}`)}</div>
        </div>
      </div>
      <div className="space-y-1">
        {items.map((it, i) => (
          <button
            key={i}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
              isTg ? "bg-white/5 hover:bg-white/10" : "bg-white shadow-sm hover:shadow",
            )}
          >
            <span className="opacity-70">{it.icon}</span>
            <span className="flex-1 text-[11.5px]">{it.label}</span>
            {it.badge && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                  isTg ? "bg-white/10 text-white/70" : "bg-black/8 text-black/60",
                )}
              >
                {it.badge}
              </span>
            )}
            <ChevronRight className="h-3 w-3 opacity-40" />
          </button>
        ))}
      </div>
    </div>
  );
}
