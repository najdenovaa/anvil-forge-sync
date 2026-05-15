import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  List,
  CreditCard,
  User,
  ChevronRight,
  Check,
  ShoppingBag,
  ShoppingCart,
  Plus,
  Minus,
  X,
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
import { useBotSimulator } from "./BotSimulatorContext";
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
  // Workspace context only — pipe submitCart payload into the simulator so
  // the in-canvas chat triggers the user's `trigger.webapp_data` branch
  // instead of just closing the Mini App with no follow-up bubble.
  const { submitWebappData } = useBotSimulator();
  return <DynamicMiniAppView miniApp={miniApp} onWebappSubmit={submitWebappData} />;
}

export function DynamicMiniAppView({
  miniApp,
  onWebappSubmit,
}: {
  miniApp: Partial<import("@/lib/anvl-blueprint").AnvlMiniAppState>;
  /** Optional preview-only hook: invoked alongside Telegram.WebApp.sendData
   *  so the in-canvas simulator can run the corresponding bot reply. Real
   *  Telegram (the /m/$flowId route) leaves this undefined and relies on
   *  Telegram delivering web_app_data to bot-runtime instead. */
  onWebappSubmit?: (payload: {
    action?: string;
    items?: Array<{ title?: string; price?: number; qty?: number }>;
    total?: number | string;
    currency?: string;
  }) => void;
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

  // ---------- Cart state (Level 2A) ----------
  // Cart is keyed by item.title (assumed unique within a Mini App). Values
  // are quantities. Lives in component state — closing the Mini App resets
  // it, which is fine for v1 (each order is a fresh session). Future: move
  // to Telegram.WebApp.CloudStorage for persistence across reopens.
  const [cart, setCart] = useState<Map<string, number>>(() => new Map());
  const [sheetOpen, setSheetOpen] = useState(false);

  const cartConfig = miniApp.cart;
  const cartEnabled = !!cartConfig?.enabled;
  const cartCurrency = cartConfig?.currency ?? "₽";

  // Enriched cart items with original item data (for thumb, badge, etc.).
  // We also clamp against the current items array — if an item was removed
  // from the Mini App after being added to the cart, it disappears too.
  const cartItems = useMemo(() => {
    const items = miniApp.items ?? [];
    return items
      .filter((i) => cart.has(i.title))
      .map((i) => ({ item: i, qty: cart.get(i.title) ?? 0 }));
  }, [cart, miniApp.items]);

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, { item, qty }) => sum + (item.priceNumeric ?? 0) * qty, 0),
    [cartItems],
  );

  const cartCount = useMemo(() => cartItems.reduce((sum, { qty }) => sum + qty, 0), [cartItems]);

  const addToCart = useCallback((item: MiniAppItem) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.set(item.title, (next.get(item.title) ?? 0) + 1);
      return next;
    });
    // Haptic feedback when running inside real Telegram. The mock in preview
    // also responds (logs the event).
    const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
    tg?.HapticFeedback?.selectionChanged?.();
  }, []);

  const removeFromCart = useCallback((title: string) => {
    setCart((prev) => {
      const cur = prev.get(title) ?? 0;
      if (cur <= 0) return prev;
      const next = new Map(prev);
      if (cur <= 1) next.delete(title);
      else next.set(title, cur - 1);
      return next;
    });
    const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
    tg?.HapticFeedback?.selectionChanged?.();
  }, []);

  const deleteFromCart = useCallback((title: string) => {
    setCart((prev) => {
      if (!prev.has(title)) return prev;
      const next = new Map(prev);
      next.delete(title);
      return next;
    });
  }, []);

  const submitCart = useCallback(() => {
    if (cartCount === 0) return;
    const payload = {
      action: cartConfig?.sendAction ?? "order",
      items: cartItems.map(({ item, qty }) => ({
        title: item.title,
        price: item.priceNumeric ?? 0,
        qty,
      })),
      total: cartTotal,
      currency: cartCurrency,
    };
    const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
    if (tg) {
      tg.HapticFeedback?.notificationOccurred?.("success");
      tg.sendData?.(JSON.stringify(payload));
      tg.close?.();
      // Close explicitly after sendData: real Telegram accepts this and the
      // preview mock fires the same close event, so the user returns to chat
      // immediately after confirming the order.
    }
    // Preview-only: notify the in-canvas simulator so the chat tab shows
    // the bot's webapp_data reply. In real Telegram (no provider), this
    // is undefined and Telegram itself delivers web_app_data to the bot.
    onWebappSubmit?.(payload);
    setCart(new Map());
    setSheetOpen(false);
    close();
  }, [cartCount, cartItems, cartTotal, cartConfig, cartCurrency, close, onWebappSubmit]);
  // ---------- /Cart state ----------

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
                cartEnabled={cartEnabled}
                cart={cart}
                onAddToCart={addToCart}
                onRemoveFromCart={removeFromCart}
              />
            )}
            {tabId !== "home" && tabId !== "plans" && tabId !== "profile" && (
              <ItemsTab
                isTg={isTg}
                accentColor={accentColor}
                layout={layout}
                items={miniApp.items}
                label={miniApp.itemsLabel}
                cartEnabled={cartEnabled}
                cart={cart}
                onAddToCart={addToCart}
                onRemoveFromCart={removeFromCart}
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

      {/* Sticky cart bar (Level 2A) — sits above bottom tabs, visible from any
          tab when cart is enabled AND has items. Tap opens bottom-sheet. */}
      {cartEnabled && cartCount > 0 && (
        <button
          onClick={() => setSheetOpen(true)}
          className={cn(
            "flex items-center justify-between gap-2 border-t px-3 py-2 text-left transition-colors",
            useDarkTheme
              ? "border-white/5 bg-[oklch(0.22_0.03_260)] hover:bg-[oklch(0.25_0.03_260)]"
              : "border-black/5 bg-white hover:bg-black/[0.02]",
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: accentColor }}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold leading-tight">
                {cartCount} · {cartTotal} {cartCurrency}
              </span>
              <span className="text-[8.5px] opacity-50">
                {cartConfig?.ctaLabel ?? "Оформить заказ"}
              </span>
            </div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        </button>
      )}

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

      {/* Bottom-sheet for cart contents — overlays everything when sheetOpen.
          Tapping the dimmed area closes it; the CTA at the bottom submits
          via Telegram.WebApp.sendData and clears the cart. */}
      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-50 flex flex-col bg-black/40"
            onClick={() => setSheetOpen(false)}
          >
            <div className="flex-1" />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex max-h-[80%] flex-col rounded-t-2xl px-3 pb-3 pt-2",
                useDarkTheme
                  ? "bg-[oklch(0.22_0.03_260)] text-white"
                  : "bg-white text-[oklch(0.16_0_0)]",
              )}
            >
              {/* Handle */}
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-black/15 dark:bg-white/15" />
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-semibold">
                  {cartConfig?.ctaLabel ?? "Оформить заказ"}
                </span>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="rounded-full p-1 opacity-50 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* Scrollable item list */}
              <div className="flex-1 space-y-1.5 overflow-y-auto">
                {cartItems.map(({ item, qty }) => (
                  <div
                    key={item.title}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5",
                      useDarkTheme ? "bg-white/5" : "bg-black/[0.03]",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[10.5px] font-medium">{item.title}</div>
                      <div className="text-[9px] opacity-50">
                        {item.priceNumeric ?? 0} {cartCurrency}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => removeFromCart(item.title)}
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                          useDarkTheme
                            ? "bg-white/10 hover:bg-white/20"
                            : "bg-black/[0.06] hover:bg-black/10",
                        )}
                        aria-label="-"
                      >
                        <Minus className="h-2.5 w-2.5" />
                      </button>
                      <span className="w-5 text-center text-[10px] font-semibold tabular-nums">
                        {qty}
                      </span>
                      <button
                        onClick={() => addToCart(item)}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white"
                        style={{ backgroundColor: accentColor }}
                        aria-label="+"
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </button>
                      <button
                        onClick={() => deleteFromCart(item.title)}
                        className="ml-0.5 rounded-full p-1 opacity-40 hover:opacity-100"
                        aria-label="remove"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Total + submit */}
              <div className="mt-2 flex items-center justify-between border-t pt-2 border-black/5 dark:border-white/10">
                <span className="text-[10px] opacity-60">Итого</span>
                <span className="text-[13px] font-semibold tabular-nums">
                  {cartTotal} {cartCurrency}
                </span>
              </div>
              <button
                onClick={submitCart}
                className="mt-2 w-full rounded-xl py-2.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: accentColor }}
              >
                {cartConfig?.ctaLabel ?? "Оформить заказ"} · {cartTotal} {cartCurrency}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
  cartEnabled,
  cart,
  onAddToCart,
  onRemoveFromCart,
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
  cartEnabled?: boolean;
  cart?: Map<string, number>;
  onAddToCart?: (item: MiniAppItem) => void;
  onRemoveFromCart?: (title: string) => void;
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
          <ItemsList
            items={items}
            layout={layout}
            isTg={isTg}
            accentColor={accentColor}
            cartEnabled={cartEnabled}
            cart={cart}
            onAddToCart={onAddToCart}
            onRemoveFromCart={onRemoveFromCart}
          />
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
  cartEnabled,
  cart,
  onAddToCart,
  onRemoveFromCart,
}: {
  isTg: boolean;
  accentColor: string;
  layout: MiniAppLayout;
  items?: MiniAppItem[];
  label?: string;
  cartEnabled?: boolean;
  cart?: Map<string, number>;
  onAddToCart?: (item: MiniAppItem) => void;
  onRemoveFromCart?: (title: string) => void;
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
        <ItemsList
          items={list}
          layout={layout}
          isTg={isTg}
          accentColor={accentColor}
          cartEnabled={cartEnabled}
          cart={cart}
          onAddToCart={onAddToCart}
          onRemoveFromCart={onRemoveFromCart}
        />
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
  cartEnabled,
  cart,
  onAddToCart,
  onRemoveFromCart,
}: {
  items: MiniAppItem[];
  layout: MiniAppLayout;
  isTg: boolean;
  accentColor: string;
  cartEnabled?: boolean;
  cart?: Map<string, number>;
  onAddToCart?: (item: MiniAppItem) => void;
  onRemoveFromCart?: (title: string) => void;
}) {
  // Helper: per-item cart props. An item is "addable" only when cart is
  // enabled AND it has a numeric price; without priceNumeric it's a purely
  // decorative card and we don't render +/- controls.
  const itemCartProps = (it: MiniAppItem) => {
    const addable = !!cartEnabled && typeof it.priceNumeric === "number" && it.priceNumeric > 0;
    if (!addable) return { addable: false as const };
    return {
      addable: true as const,
      qty: cart?.get(it.title) ?? 0,
      onAdd: () => onAddToCart?.(it),
      onRemove: () => onRemoveFromCart?.(it.title),
    };
  };

  if (layout === "grid") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {items.map((it, i) => (
          <ItemTile
            key={`${it.title}-${i}`}
            item={it}
            isTg={isTg}
            accentColor={accentColor}
            {...itemCartProps(it)}
          />
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
            {...itemCartProps(it)}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <ItemRow
          key={`${it.title}-${i}`}
          item={it}
          isTg={isTg}
          accentColor={accentColor}
          {...itemCartProps(it)}
        />
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
  addable = false,
  qty = 0,
  onAdd,
  onRemove,
}: {
  item: MiniAppItem;
  isTg: boolean;
  accentColor: string;
  compact?: boolean;
  addable?: boolean;
  qty?: number;
  onAdd?: () => void;
  onRemove?: () => void;
}) {
  // Cart controls click-handlers must not propagate to the row's outer
  // <button>, otherwise wrapping clickable content would double-fire.
  const stop = (e: ReactMouseEvent) => e.stopPropagation();
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
      {/* Right side: cart controls take priority over chevron/badge */}
      {addable ? (
        qty > 0 ? (
          <div className="flex items-center gap-1" onClick={stop}>
            <button
              onClick={(e) => {
                stop(e);
                onRemove?.();
              }}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full",
                isTg ? "bg-white/10 hover:bg-white/20" : "bg-black/[0.06] hover:bg-black/10",
              )}
              aria-label="−"
            >
              <Minus className="h-2.5 w-2.5" />
            </button>
            <span className="w-4 text-center text-[10px] font-semibold tabular-nums">{qty}</span>
            <button
              onClick={(e) => {
                stop(e);
                onAdd?.();
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: accentColor }}
              aria-label="+"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              stop(e);
              onAdd?.();
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full text-white transition hover:opacity-90"
            style={{ backgroundColor: accentColor }}
            aria-label="+"
          >
            <Plus className="h-3 w-3" />
          </button>
        )
      ) : item.badge ? (
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
  addable = false,
  qty = 0,
  onAdd,
  onRemove,
}: {
  item: MiniAppItem;
  isTg: boolean;
  accentColor: string;
  addable?: boolean;
  qty?: number;
  onAdd?: () => void;
  onRemove?: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = item.image && !imgFailed;
  const stop = (e: ReactMouseEvent) => e.stopPropagation();
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
        {/* Cart "+" button — bottom-right corner overlay. Each tap adds one;
            for fine control (−/qty) the user opens the bottom-sheet. We show
            a small qty pill if already in cart. */}
        {addable && (
          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1" onClick={stop}>
            {qty > 0 && (
              <span
                className="rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white tabular-nums"
                aria-label={`в корзине ${qty}`}
              >
                ×{qty}
              </span>
            )}
            <button
              onClick={(e) => {
                stop(e);
                onAdd?.();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md transition hover:opacity-90"
              style={{ backgroundColor: accentColor }}
              aria-label="+"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
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
