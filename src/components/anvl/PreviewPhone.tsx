import { motion, AnimatePresence } from "framer-motion";
import { usePlatform } from "./PlatformContext";
import { useI18n } from "./I18nContext";
import { Battery, Signal, Wifi, ArrowLeft, MoreVertical, Mic, Paperclip, Smile } from "lucide-react";
import { cn } from "@/lib/utils";

export function PreviewPhone() {
  const { platform } = usePlatform();
  const { t } = useI18n();
  const isTg = platform === "telegram";

  return (
    <div className="hairline relative w-[280px] overflow-hidden rounded-[36px] bg-black p-2 shadow-[0_30px_80px_-30px_oklch(0_0_0_/_80%)]">
      <div className="relative overflow-hidden rounded-[28px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={platform}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "flex h-[520px] flex-col",
              isTg ? "bg-[oklch(0.22_0.03_260)]" : "bg-[oklch(0.96_0_0)] text-[oklch(0.16_0_0)]",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-between px-4 pt-2 text-[10px] font-medium",
                isTg ? "text-white/80" : "text-black/70",
              )}
            >
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <Signal className="h-2.5 w-2.5" />
                <Wifi className="h-2.5 w-2.5" />
                <Battery className="h-3 w-3" />
              </div>
            </div>

            <div
              className={cn(
                "flex items-center gap-2 border-b px-3 py-2",
                isTg ? "border-white/5 bg-[oklch(0.27_0.04_260)]" : "border-black/5 bg-white",
              )}
            >
              <ArrowLeft className="h-4 w-4 opacity-70" />
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold",
                  isTg ? "bg-tg text-white" : "bg-max text-white",
                )}
              >
                {isTg ? "TG" : "M"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold">{t("preview.bot_name")}</div>
                <div
                  className={cn(
                    "truncate text-[10px]",
                    isTg ? "text-white/50" : "text-black/50",
                  )}
                >
                  {t("preview.bot_status")}
                </div>
              </div>
              <MoreVertical className="h-4 w-4 opacity-70" />
            </div>

            <div
              className={cn(
                "flex-1 space-y-2 overflow-hidden px-3 py-3",
                isTg
                  ? "bg-[radial-gradient(circle_at_30%_20%,oklch(0.3_0.05_260)_0%,oklch(0.18_0.03_260)_70%)]"
                  : "bg-[oklch(0.97_0_0)]",
              )}
            >
              <UserBubble platform={platform}>{t("preview.user_msg")}</UserBubble>
              <BotBubble platform={platform}>{t("preview.bot_msg_1")}</BotBubble>
              <BotBubble platform={platform}>
                <div className="space-y-1">
                  <span>{t("preview.bot_msg_2")}</span>
                  <InlineKb platform={platform} />
                </div>
              </BotBubble>
            </div>

            <div
              className={cn(
                "flex items-center gap-2 border-t px-3 py-2",
                isTg ? "border-white/5 bg-[oklch(0.24_0.03_260)]" : "border-black/5 bg-white",
              )}
            >
              <Paperclip className={cn("h-4 w-4", isTg ? "text-white/50" : "text-black/40")} />
              <div
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 text-[11px]",
                  isTg ? "bg-white/5 text-white/40" : "bg-black/5 text-black/40",
                )}
              >
                {t("preview.composer")}
              </div>
              <Smile className={cn("h-4 w-4", isTg ? "text-white/50" : "text-black/40")} />
              <Mic className={cn("h-4 w-4", isTg ? "text-tg" : "text-max")} />
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="absolute left-1/2 top-0 h-4 w-20 -translate-x-1/2 rounded-b-2xl bg-black" />
      </div>

      <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full border border-hairline bg-surface px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {platform}
      </div>
    </div>
  );
}

function UserBubble({
  children,
  platform,
}: {
  children: React.ReactNode;
  platform: "telegram" | "max";
}) {
  const isTg = platform === "telegram";
  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-1.5 text-[11px]",
          isTg
            ? "rounded-br-sm bg-[oklch(0.45_0.13_230)] text-white"
            : "rounded-br-sm bg-[oklch(0.72_0.18_30)] text-white",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function BotBubble({
  children,
  platform,
}: {
  children: React.ReactNode;
  platform: "telegram" | "max";
}) {
  const isTg = platform === "telegram";
  return (
    <div className="flex justify-start">
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-1.5 text-[11px] leading-snug",
          isTg
            ? "rounded-bl-sm bg-white/10 text-white"
            : "rounded-bl-sm bg-white text-black shadow-sm",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function InlineKb({ platform }: { platform: "telegram" | "max" }) {
  const isTg = platform === "telegram";
  const { t } = useI18n();
  const items = [t("preview.btn.open"), t("preview.btn.pricing"), t("preview.btn.help")];
  return (
    <div className="mt-1.5 grid grid-cols-1 gap-1">
      {items.map((it) => (
        <button
          key={it}
          className={cn(
            "rounded-lg px-2 py-1 text-[10.5px] font-medium transition",
            isTg
              ? "bg-white/5 text-tg hover:bg-white/10"
              : "bg-[oklch(0.97_0_0)] text-max hover:bg-[oklch(0.94_0_0)]",
          )}
        >
          {it}
        </button>
      ))}
    </div>
  );
}
