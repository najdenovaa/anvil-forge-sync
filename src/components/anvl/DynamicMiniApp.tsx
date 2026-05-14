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
import {
  isHexColor,
  isImageUrl,
  type MiniAppAccent,
  type MiniAppItem,
  type MiniAppLayout,
  type MiniAppPlanCard,
  type MiniAppStat,
  type MiniAppTabSpec,
} from "@/lib/anvl-blueprint";
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

/** Resolve to a real CSS color string: hex override beats named accent. */
function resolveAccent(accentHex: string | undefined, accent: MiniAppAccent): string {
  if (accentHex && isHexColor(accentHex)) return accentHex;
  return ACCENT_HEX[accent] ?? ACCENT_HEX.blue;
}

export function DynamicMiniApp() {
  const { miniApp } = useAnvlWorkspace();
  return <DynamicMiniAppView miniApp={miniApp} />;
}

export function DynamicMiniAppView({
  miniApp,
}: {
  miniApp: Partial<import("@/lib/anvl-blueprint").AnvlMiniAppState>;
}) {
  const { t } = useI18n();
  const { view, targetTab, close } = useMiniApp();
  const { platform } = usePlatform();
  const isTg = platform === "telegram";
  const useDarkTheme = isTg && (miniApp as { theme?: string }).theme !== "light";

  const accent = miniApp.accent ?? "blue";
  const accentColor = resolveAccent(miniApp.accentHex, accent);
  const layout: MiniAppLayout = miniApp.layout ?? "list";

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
      // Telegram's MainButton color setter accepts only real #RRGGBB hex.
      // We fall back to its default blue if accent isn't a hex color.
      color: isHexColor(accentColor) ? accentColor : "#3390EC",
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
        useDarkTheme
          ? "bg-[oklch(0.18_0.03_260)] text-white"
          : "bg-[oklch(0.97_0_0)] text-[oklch(0.16_0_0)]",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between border-b px-3 py-2",
          useDarkTheme ? "border-white/5 bg-[oklch(0.22_0.03_260)]" : "border-black/5 bg-white",
        )}
      >
        <button
          onClick={close}
          className={cn(
            "text-[10.5px] font-medium",
            useDarkTheme ? "text-white/70 hover:text-white" : "text-black/60 hover:text-black",
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
              <HomeTab
                isTg={isTg}
                useDarkTheme={useDarkTheme}
                accentColor={accentColor}
                layout={layout}
                hero={miniApp.hero}
                stats={miniApp.stats}
                items={miniApp.items?.slice(0, layout === "grid" ? 4 : 2)}
              />
            )}
            {tabId !== "home" && tabId !== "plans" && tabId !== "profile" && (
              <ItemsTab
                isTg={isTg}
                accentColor={accentColor}
                layout={layout}
                items={miniApp.items}
                label={miniApp.itemsLabel}
              />
            )}
            {tabId === "plans" && (
              <PlansTab isTg={isTg} accentColor={accentColor} plans={miniApp.plans} />
            )}
            {tabId === "profile" && (
              <ProfileTab
                isTg={isTg}
                accentColor={accentColor}
                brandTitle={brandTitle}
                stats={miniApp.stats}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom tabs */}
      <div
        className={cn(
          "grid border-t",
          useDarkTheme ? "border-white/5 bg-[oklch(0.22_0.03_260)]" : "border-black/5 bg-white",
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
                active
                  ? ""
                  : useDarkTheme
                    ? "text-white/45 hover:text-white/70"
                    : "text-black/45 hover:text-black/70",
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
  useDarkTheme,
  accentColor,
  layout,
  hero,
  stats,
  items,
}: {
  isTg: boolean;
  useDarkTheme: boolean;
  accentColor: string;
  layout: MiniAppLayout;
  hero?: {
    title: string;
    subtitle?: string;
    cta: string;
    icon?: string;
    image?: string;
    backgroundImage?: string;
  };
  stats?: MiniAppStat[];
  items?: MiniAppItem[];
}) {
  const { t } = useI18n();
  const HeroIcon = pickIcon(hero?.icon, Sparkles);
  const title = hero?.title ?? t("vpn.title");
  const subtitle = hero?.subtitle ?? t("vpn.subtitle");
  const cta = hero?.cta ?? t("vpn.connect");
  const heroImage = isImageUrl(hero?.image) ? hero?.image : undefined;
  const heroBg = isImageUrl(hero?.backgroundImage) ? hero?.backgroundImage : undefined;
  return (
    <div className="flex h-full flex-col px-4 pt-5 pb-4">
      {/* Hero block. When a backgroundImage is provided we wrap the content in
          a relatively-positioned container so the bg sits behind it. */}
      <div className={cn("relative", heroBg && "overflow-hidden rounded-2xl px-3 py-4")}>
        {heroBg && (
          <>
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-cover bg-center"
              style={{ backgroundImage: `url(${JSON.stringify(heroBg)})` }}
            />
            {/* Overlay for legibility — slightly darker in dark theme. */}
            <div
              aria-hidden
              className={cn("absolute inset-0 -z-10", useDarkTheme ? "bg-black/55" : "bg-white/55")}
            />
          </>
        )}
        <div className="flex flex-col items-center text-center">
          {heroImage ? (
            <div
              className="h-20 w-20 overflow-hidden rounded-2xl"
              style={{ boxShadow: `0 14px 40px -14px ${accentColor}` }}
            >
              <img
                src={heroImage}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${accentColor}, color-mix(in oklab, ${accentColor} 60%, black))`,
                boxShadow: `0 14px 40px -14px ${accentColor}`,
              }}
            >
              <HeroIcon className="h-9 w-9 text-white" />
            </div>
          )}
          <div className="mt-3 text-[14px] font-semibold leading-tight">{title}</div>
          <div className="mt-1 text-[10.5px] opacity-60">{subtitle}</div>
          <button
            className="mt-4 w-full rounded-xl py-2.5 text-[12px] font-semibold text-white transition active:scale-[0.99]"
            style={{ background: accentColor }}
          >
            {cta}
          </button>
        </div>
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
        <div className="mt-4">
          <ItemsList items={items} layout={layout} isTg={isTg} accentColor={accentColor} />
        </div>
      )}
    </div>
  );
}

function ItemsTab({
  isTg,
  accentColor,
  layout,
  items,
  label,
}: {
  isTg: boolean;
  accentColor: string;
  layout: MiniAppLayout;
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
        <ItemsList items={list} layout={layout} isTg={isTg} accentColor={accentColor} />
      )}
    </div>
  );
}

/** Single dispatcher that picks the right item presenter based on layout. */
function ItemsList({
  items,
  layout,
  isTg,
  accentColor,
}: {
  items: MiniAppItem[];
  layout: MiniAppLayout;
  isTg: boolean;
  accentColor: string;
}) {
  if (layout === "grid") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {items.map((it, i) => (
          <ItemTile key={`${it.title}-${i}`} item={it} isTg={isTg} accentColor={accentColor} />
        ))}
      </div>
    );
  }
  if (layout === "compact") {
    return (
      <div className="space-y-1">
        {items.map((it, i) => (
          <ItemRow
            key={`${it.title}-${i}`}
            item={it}
            isTg={isTg}
            accentColor={accentColor}
            compact
          />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <ItemRow key={`${it.title}-${i}`} item={it} isTg={isTg} accentColor={accentColor} />
      ))}
    </div>
  );
}

/** Small leading thumbnail used by list/compact rows. */
function ItemThumb({
  item,
  accentColor,
  size,
}: {
  item: MiniAppItem;
  accentColor: string;
  size: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const px = `${size}px`;
  if (item.image && !imgFailed) {
    return (
      <img
        src={item.image}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className="shrink-0 rounded-md object-cover"
        style={{ width: px, height: px }}
      />
    );
  }
  if (item.emoji) {
    return (
      <span
        className="flex shrink-0 items-center justify-center leading-none"
        style={{ width: px, height: px, fontSize: `${Math.round(size * 0.65)}px` }}
      >
        {item.emoji}
      </span>
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md font-bold text-white"
      style={{
        width: px,
        height: px,
        background: accentColor,
        fontSize: `${Math.round(size * 0.45)}px`,
      }}
    >
      {item.title.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Badge background respects item.badgeColor (hex) when set. */
function ItemBadge({ item, isTg }: { item: MiniAppItem; isTg: boolean }) {
  if (!item.badge) return null;
  const hasColor = isHexColor(item.badgeColor);
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider",
        !hasColor && (isTg ? "bg-white/10 text-white/70" : "bg-black/8 text-black/60"),
      )}
      style={hasColor ? { background: item.badgeColor, color: "#fff" } : undefined}
    >
      {item.badge}
    </span>
  );
}

function ItemRow({
  item,
  isTg,
  accentColor,
  compact = false,
}: {
  item: MiniAppItem;
  isTg: boolean;
  accentColor: string;
  compact?: boolean;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg text-left transition",
        compact ? "px-2 py-1.5" : "px-2.5 py-2",
        isTg ? "bg-white/5 hover:bg-white/10" : "bg-white shadow-sm hover:shadow",
      )}
    >
      <ItemThumb item={item} accentColor={accentColor} size={compact ? 24 : 28} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11.5px] font-medium">{item.title}</div>
        {!compact && item.subtitle && (
          <div className="truncate text-[9.5px] opacity-50">{item.subtitle}</div>
        )}
      </div>
      {item.meta && <div className="text-[10px] font-semibold opacity-80">{item.meta}</div>}
      {item.badge ? (
        <ItemBadge item={item} isTg={isTg} />
      ) : (
        !compact && <ChevronRight className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
  );
}

/** Grid tile: large image on top, text block below. */
function ItemTile({
  item,
  isTg,
  accentColor,
}: {
  item: MiniAppItem;
  isTg: boolean;
  accentColor: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = item.image && !imgFailed;
  return (
    <button
      className={cn(
        "flex flex-col overflow-hidden rounded-xl text-left transition",
        isTg ? "bg-white/5 hover:bg-white/10" : "bg-white shadow-sm hover:shadow",
      )}
    >
      <div
        className="relative aspect-square w-full"
        style={
          !showImage
            ? {
                background: `linear-gradient(135deg, ${accentColor}, color-mix(in oklab, ${accentColor} 50%, black))`,
              }
            : undefined
        }
      >
        {showImage ? (
          <img
            src={item.image}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : item.emoji ? (
          <span className="absolute inset-0 flex items-center justify-center text-4xl leading-none">
            {item.emoji}
          </span>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white">
            {item.title.slice(0, 1).toUpperCase()}
          </span>
        )}
        {item.badge && (
          <div className="absolute right-1.5 top-1.5">
            <ItemBadge item={item} isTg={isTg} />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-2 py-2">
        <div className="truncate text-[11.5px] font-semibold">{item.title}</div>
        {item.subtitle && <div className="truncate text-[9.5px] opacity-50">{item.subtitle}</div>}
        {item.meta && (
          <div className="mt-0.5 text-[10.5px] font-bold" style={{ color: accentColor }}>
            {item.meta}
          </div>
        )}
      </div>
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
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-3",
          isTg ? "bg-white/5" : "bg-white shadow-sm",
        )}
      >
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
    <div
      className={cn(
        "rounded-lg px-3 py-8 text-center text-[11px] opacity-50",
        isTg ? "bg-white/5" : "bg-white shadow-sm",
      )}
    >
      {text}
    </div>
  );
}
