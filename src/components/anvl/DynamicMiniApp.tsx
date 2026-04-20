import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  List,
  CreditCard,
  User,
  ChevronRight,
  Check,
  ShoppingBag,
  Utensils,
  Plane,
  Music,
  Heart,
  MapPin,
  Calendar,
  Bell,
  Bot,
  Sparkles,
  Zap,
  Globe2,
  Truck,
  Camera,
  Book,
  GraduationCap,
  Dumbbell,
  Coffee,
  Briefcase,
  Settings,
  Star,
  Package,
  Send,
  Phone,
  Mail,
  Search,
  ArrowRight,
  Power,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "./I18nContext";
import { useMiniApp } from "./MiniAppContext";
import { usePlatform } from "./PlatformContext";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import type { MiniAppAccent, MiniAppItem, MiniAppPlanCard, MiniAppStat, MiniAppTabSpec } from "@/lib/anvl-blueprint";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  list: List,
  catalog: List,
  menu: Utensils,
  food: Utensils,
  cart: ShoppingBag,
  shop: ShoppingBag,
  bag: ShoppingBag,
  package: Package,
  delivery: Truck,
  truck: Truck,
  travel: Plane,
  flight: Plane,
  music: Music,
  heart: Heart,
  location: MapPin,
  pin: MapPin,
  map: MapPin,
  calendar: Calendar,
  bell: Bell,
  notify: Bell,
  bot: Bot,
  sparkles: Sparkles,
  zap: Zap,
  globe: Globe2,
  world: Globe2,
  vpn: Globe2,
  camera: Camera,
  photo: Camera,
  book: Book,
  edu: GraduationCap,
  course: GraduationCap,
  fitness: Dumbbell,
  gym: Dumbbell,
  coffee: Coffee,
  work: Briefcase,
  settings: Settings,
  star: Star,
  send: Send,
  phone: Phone,
  mail: Mail,
  search: Search,
  plans: CreditCard,
  pricing: CreditCard,
  card: CreditCard,
  profile: User,
  user: User,
  power: Power,
};

function pickIcon(name: string | undefined, fallback: LucideIcon): LucideIcon {
  if (!name) return fallback;
  const key = name.toLowerCase().replace(/[^a-z]/g, "");
  return ICONS[key] ?? fallback;
}

const ACCENT_HEX: Record<MiniAppAccent, string> = {
  blue: "oklch(0.62 0.18 245)",
  green: "oklch(0.7 0.16 150)",
  orange: "oklch(0.74 0.17 55)",
  violet: "oklch(0.6 0.2 295)",
  pink: "oklch(0.7 0.18 350)",
  red: "oklch(0.62 0.2 25)",
  teal: "oklch(0.7 0.13 195)",
};

export function DynamicMiniApp() {
  const { t } = useI18n();
  const { view, targetTab, close } = useMiniApp();
  const { platform } = usePlatform();
  const { miniApp } = useAnvlWorkspace();
  const isTg = platform === "telegram";

  const accent = miniApp.accent ?? "blue";
  const accentColor = ACCENT_HEX[accent];

  // Real Telegram WebApp SDK wiring — works because TelegramWebAppProvider
  // installs window.Telegram.WebApp app-wide. This is the same code that would
  // run inside Telegram, no special-casing for the preview.
  useEffect(() => {
    const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
    if (!tg) return;
    tg.ready();
    tg.expand();
    tg.BackButton.show();
    const onBack = () => close();
    tg.BackButton.onClick(onBack);

    tg.MainButton.setParams({
      text: (miniApp.hero?.cta ?? t("vpn.connect")).toUpperCase(),
      color: accentColor.startsWith("#") ? accentColor : "#3390EC",
      text_color: "#FFFFFF",
      is_visible: true,
      is_active: true,
    });
    const onMain = () => {
      tg.HapticFeedback.notificationOccurred("success");
      tg.CloudStorage.setItem("anvl.last_cta_at", new Date().toISOString());
      tg.showAlert(`${miniApp.hero?.cta ?? t("vpn.connect")} ✓`);
    };
    tg.MainButton.onClick(onMain);

    return () => {
      tg.MainButton.offClick(onMain);
      tg.BackButton.offClick(onBack);
      tg.MainButton.hide();
      tg.BackButton.hide();
    };
  }, [miniApp.hero?.cta, accentColor, close, t]);

  const tabs: MiniAppTabSpec[] = miniApp.tabs?.length
    ? miniApp.tabs
    : [
        { id: "home", label: t("vpn.tab.home"), icon: "home" },
        { id: "items", label: miniApp.itemsLabel ?? t("vpn.tab.locations"), icon: "list" },
        { id: "plans", label: t("vpn.tab.plans"), icon: "plans" },
        { id: "profile", label: t("vpn.tab.profile"), icon: "profile" },
      ];

  const initialTabId =
    tabs.find((t) => t.id === targetTab)?.id ??
    (targetTab === "locations" ? tabs.find((t) => t.id === "items")?.id : undefined) ??
    tabs[0]?.id ??
    "home";

  const [tabId, setTabId] = useState(initialTabId);

  useEffect(() => {
    if (view === "miniapp") {
      const next =
        tabs.find((t) => t.id === targetTab)?.id ??
        (targetTab === "locations" ? tabs.find((t) => t.id === "items")?.id : undefined) ??
        tabs[0]?.id;
      if (next) setTabId(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, targetTab]);

  const brandTitle = miniApp.title?.trim() || t("vpn.title");
  const brandSubtitle = miniApp.subtitle?.trim() || t("vpn.subtitle");
  const HeaderIcon = pickIcon(miniApp.hero?.icon, Sparkles);

  return (
    <div
      className={cn(
        "flex h-full flex-col text-[12px]",
        isTg
          ? "bg-[oklch(0.18_0.03_260)] text-white"
          : "bg-[oklch(0.97_0_0)] text-[oklch(0.16_0_0)]",
      )}
    >
      {/* Header */}
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
        <div className="flex min-w-0 flex-col items-center text-center">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            <HeaderIcon className="h-3 w-3" style={{ color: accentColor }} />
            <span className="truncate">{brandTitle}</span>
          </div>
          <div className="truncate text-[9px] opacity-50">{brandSubtitle}</div>
        </div>
        <div className="w-12" />
      </div>

      {/* Body */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={tabId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="h-full overflow-y-auto"
          >
            {tabId === "home" && (
              <HomeTab isTg={isTg} accentColor={accentColor} hero={miniApp.hero} stats={miniApp.stats} items={miniApp.items?.slice(0, 2)} />
            )}
            {tabId !== "home" && tabId !== "plans" && tabId !== "profile" && (
              <ItemsTab isTg={isTg} accentColor={accentColor} items={miniApp.items} label={miniApp.itemsLabel} />
            )}
            {tabId === "plans" && <PlansTab isTg={isTg} accentColor={accentColor} plans={miniApp.plans} />}
            {tabId === "profile" && (
              <ProfileTab isTg={isTg} accentColor={accentColor} brandTitle={brandTitle} stats={miniApp.stats} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom tabs */}
      <div
        className={cn(
          "grid border-t",
          isTg ? "border-white/5 bg-[oklch(0.22_0.03_260)]" : "border-black/5 bg-white",
        )}
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const Icon = pickIcon(tab.icon, tab.id === "home" ? Home : List);
          const active = tab.id === tabId;
          return (
            <button
              key={tab.id}
              onClick={() => setTabId(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 text-[9px] font-medium transition",
                active ? "" : isTg ? "text-white/45 hover:text-white/70" : "text-black/45 hover:text-black/70",
              )}
              style={active ? { color: accentColor } : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HomeTab({
  isTg,
  accentColor,
  hero,
  stats,
  items,
}: {
  isTg: boolean;
  accentColor: string;
  hero?: { title: string; subtitle?: string; cta: string; icon?: string };
  stats?: MiniAppStat[];
  items?: MiniAppItem[];
}) {
  const { t } = useI18n();
  const HeroIcon = pickIcon(hero?.icon, Sparkles);
  const title = hero?.title ?? t("vpn.title");
  const subtitle = hero?.subtitle ?? t("vpn.subtitle");
  const cta = hero?.cta ?? t("vpn.connect");
  return (
    <div className="flex h-full flex-col px-4 pt-5 pb-4">
      <div className="flex flex-col items-center text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${accentColor}, color-mix(in oklab, ${accentColor} 60%, black))`,
            boxShadow: `0 14px 40px -14px ${accentColor}`,
          }}
        >
          <HeroIcon className="h-9 w-9 text-white" />
        </div>
        <div className="mt-3 text-[14px] font-semibold leading-tight">{title}</div>
        <div className="mt-1 text-[10.5px] opacity-60">{subtitle}</div>
        <button
          className="mt-4 w-full rounded-xl py-2.5 text-[12px] font-semibold text-white transition active:scale-[0.99]"
          style={{ background: accentColor }}
        >
          {cta}
        </button>
      </div>

      {stats && stats.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {stats.slice(0, 4).map((s, i) => (
            <div
              key={`${s.label}-${i}`}
              className={cn("rounded-lg px-2.5 py-2", isTg ? "bg-white/5" : "bg-white shadow-sm")}
            >
              <div className="text-[9px] uppercase tracking-[0.1em] opacity-50">{s.label}</div>
              <div className="mt-0.5 truncate text-[11.5px] font-semibold">
                {s.value}
                {s.unit && <span className="ml-1 text-[9px] font-normal opacity-50">{s.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {items && items.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {items.map((it, i) => (
            <ItemRow key={`${it.title}-${i}`} item={it} isTg={isTg} accentColor={accentColor} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemsTab({
  isTg,
  accentColor,
  items,
  label,
}: {
  isTg: boolean;
  accentColor: string;
  items?: MiniAppItem[];
  label?: string;
}) {
  const { t } = useI18n();
  const list = items ?? [];
  return (
    <div className="px-3 py-3">
      <div className="mb-2 px-1 text-[10px] uppercase tracking-[0.14em] opacity-50">
        {label ?? t("vpn.choose_location")}
      </div>
      {list.length === 0 ? (
        <EmptyState isTg={isTg} text="—" />
      ) : (
        <div className="space-y-1.5">
          {list.map((it, i) => (
            <ItemRow key={`${it.title}-${i}`} item={it} isTg={isTg} accentColor={accentColor} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, isTg, accentColor }: { item: MiniAppItem; isTg: boolean; accentColor: string }) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
        isTg ? "bg-white/5 hover:bg-white/10" : "bg-white shadow-sm hover:shadow",
      )}
    >
      {item.emoji ? (
        <span className="text-lg leading-none">{item.emoji}</span>
      ) : (
        <span
          className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white"
          style={{ background: accentColor }}
        >
          {item.title.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11.5px] font-medium">{item.title}</div>
        {item.subtitle && <div className="truncate text-[9.5px] opacity-50">{item.subtitle}</div>}
      </div>
      {item.meta && <div className="text-[10px] font-semibold opacity-80">{item.meta}</div>}
      {item.badge ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider",
            isTg ? "bg-white/10 text-white/70" : "bg-black/8 text-black/60",
          )}
        >
          {item.badge}
        </span>
      ) : (
        <ChevronRight className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
  );
}

function PlansTab({
  isTg,
  accentColor,
  plans,
}: {
  isTg: boolean;
  accentColor: string;
  plans?: MiniAppPlanCard[];
}) {
  const list = plans ?? [];
  if (list.length === 0) return <EmptyState isTg={isTg} text="—" />;
  return (
    <div className="space-y-2 px-3 py-3">
      {list.map((p) => (
        <div
          key={p.id}
          className={cn(
            "rounded-xl border px-3 py-3",
            p.highlight
              ? isTg
                ? "border-white/30 bg-white/10"
                : "border-black/20 bg-white shadow-md"
              : isTg
                ? "border-white/10 bg-white/5"
                : "border-black/8 bg-white shadow-sm",
          )}
          style={p.highlight ? { borderColor: accentColor } : undefined}
        >
          <div className="flex items-baseline justify-between">
            <div className="text-[13px] font-semibold">{p.name}</div>
            <div className="text-[12px] font-bold">
              {p.price}
              {p.unit && <span className="text-[9.5px] font-normal opacity-50">{p.unit}</span>}
            </div>
          </div>
          {p.description && <div className="mt-1 text-[10.5px] opacity-70">{p.description}</div>}
          {p.features && p.features.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[10.5px] opacity-80">
              {p.features.map((f, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-2.5 w-2.5 shrink-0" style={{ color: accentColor }} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}
          <button
            className="mt-2.5 w-full rounded-md py-1.5 text-[11px] font-semibold text-white transition"
            style={{ background: accentColor }}
          >
            <span className="inline-flex items-center gap-1">
              Выбрать <ArrowRight className="h-3 w-3" />
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}

function ProfileTab({
  isTg,
  accentColor,
  brandTitle,
  stats,
}: {
  isTg: boolean;
  accentColor: string;
  brandTitle: string;
  stats?: MiniAppStat[];
}) {
  return (
    <div className="space-y-3 px-3 py-4">
      <div className={cn("flex items-center gap-3 rounded-xl px-3 py-3", isTg ? "bg-white/5" : "bg-white shadow-sm")}>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-[14px] font-bold text-white"
          style={{ background: accentColor }}
        >
          {brandTitle.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold">@user</div>
          <div className="truncate text-[10px] opacity-60">{brandTitle}</div>
        </div>
        <Settings className="h-4 w-4 opacity-50" />
      </div>
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {stats.slice(0, 4).map((s, i) => (
            <div
              key={`${s.label}-${i}`}
              className={cn("rounded-lg px-2.5 py-2", isTg ? "bg-white/5" : "bg-white shadow-sm")}
            >
              <div className="text-[9px] uppercase tracking-[0.1em] opacity-50">{s.label}</div>
              <div className="mt-0.5 truncate text-[11.5px] font-semibold">
                {s.value}
                {s.unit && <span className="ml-1 text-[9px] font-normal opacity-50">{s.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ isTg, text }: { isTg: boolean; text: ReactNode }) {
  return (
    <div className={cn("rounded-lg px-3 py-8 text-center text-[11px] opacity-50", isTg ? "bg-white/5" : "bg-white shadow-sm")}>
      {text}
    </div>
  );
}
