import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Settings2, LayoutGrid, Cloud, Check, AlertCircle, Code2, MousePointer2 } from "lucide-react";
import { usePlatform } from "./PlatformContext";
import { useI18n } from "./I18nContext";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import { useSelection } from "./SelectionContext";
import { NodeInspector } from "./NodeInspector";
import { NODE_CATALOG, NODE_GROUPS } from "@/lib/anvl-catalog";
import type { NodeKind } from "@/lib/anvl-types";
import { cn } from "@/lib/utils";

type Tab = "components" | "node" | "settings" | "code";

export function RightInspector() {
  const [tab, setTab] = useState<Tab>("components");
  const { t } = useI18n();
  const { selectedId } = useSelection();

  // Auto-switch to "Node" tab when a node is selected on the canvas.
  useEffect(() => {
    if (selectedId) setTab("node");
  }, [selectedId]);

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-l border-hairline bg-sidebar">
      <div className="flex items-center gap-1 border-b border-hairline px-2 py-2">
        <TabBtn active={tab === "components"} onClick={() => setTab("components")} icon={<LayoutGrid className="h-3.5 w-3.5" />}>
          {t("inspector.components")}
        </TabBtn>
        <TabBtn active={tab === "node"} onClick={() => setTab("node")} icon={<MousePointer2 className="h-3.5 w-3.5" />}>
          Node
        </TabBtn>
        <TabBtn active={tab === "settings"} onClick={() => setTab("settings")} icon={<Settings2 className="h-3.5 w-3.5" />}>
          {t("inspector.settings")}
        </TabBtn>
        <TabBtn active={tab === "code"} onClick={() => setTab("code")} icon={<Code2 className="h-3.5 w-3.5" />}>
          {t("inspector.code")}
        </TabBtn>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="absolute inset-0"
          >
            {tab === "components" ? <ComponentsPane /> : tab === "node" ? <NodeInspector /> : tab === "settings" ? <SettingsPane /> : <CodePane />}
          </motion.div>
        </AnimatePresence>
      </div>
    </aside>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium transition",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function ComponentsPane() {
  const { t } = useI18n();
  const all = Object.values(NODE_CATALOG);

  const onDragStart = (e: React.DragEvent, kind: NodeKind) => {
    e.dataTransfer.setData("application/anvl-node", kind);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="h-full overflow-y-auto px-3 py-3">
      {NODE_GROUPS.map((group) => {
        const items = all.filter((n) => n.group === group);
        return (
          <div key={group} className="mb-4">
            <div className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {t(`group.${group}`)}
            </div>
            <div className="space-y-1">
              {items.map((item, idx) => (
                <motion.div
                  key={item.kind}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02, type: "spring", stiffness: 300, damping: 24 }}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  draggable
                  onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, item.kind)}
                  className="group flex cursor-grab items-center gap-2.5 rounded-lg border border-transparent bg-transparent px-2 py-1.5 transition hover:border-hairline hover:bg-accent active:cursor-grabbing"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-md border border-hairline bg-surface-elevated text-foreground/80 transition group-hover:text-foreground">
                    <item.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium leading-tight">
                      {t(item.labelKey)}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {t(item.descKey)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SettingsPane() {
  const { platform } = usePlatform();
  const { t } = useI18n();

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <SectionHeader title={t("settings.cloud_status")} />
      <div className="hairline mb-5 grid grid-cols-2 gap-2 rounded-lg bg-surface p-3">
        <Stat icon={<Cloud className="h-3 w-3" />} label={t("settings.production")} value="anvl.app" />
        <Stat
          icon={<Check className="h-3 w-3 text-status-ok" />}
          label={t("settings.webhook")}
          value={t("settings.healthy")}
        />
        <Stat
          icon={<Check className="h-3 w-3 text-status-ok" />}
          label={t("settings.tg_status")}
          value="200 OK"
        />
        <Stat
          icon={<AlertCircle className="h-3 w-3 text-status-warn" />}
          label={t("settings.max_status")}
          value={t("settings.reauth")}
        />
      </div>

      {platform === "telegram" ? <TelegramSettings /> : <MaxSettings />}

      <SectionHeader title={t("settings.miniapp")} className="mt-6" />
      <Field label={t("settings.webview_url")} value="https://app.anvl.ai/u/welcome-bot" />
      <Field label={t("settings.init_mode")} value="Telegram.WebApp · Max SDK" />
    </div>
  );
}

function CodePane() {
  const { t } = useI18n();
  const { generatedCode } = useAnvlWorkspace();

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="hairline rounded-lg bg-surface p-3">
        {generatedCode.trim() ? (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/90">
            <code>{generatedCode}</code>
          </pre>
        ) : (
          <p className="text-[12px] leading-relaxed text-muted-foreground">{t("code.empty")}</p>
        )}
      </div>
    </div>
  );
}

function TelegramSettings() {
  const { t } = useI18n();
  return (
    <>
      <SectionHeader title={t("settings.tg_section")} />
      <Field label={t("settings.bot_username")} value="@welcome_anvl_bot" />
      <Field label={t("settings.bot_token")} value="••••••••••••:AAFx-9KQ" mono />
      <Field label={t("settings.webhook_field")} value="https://api.anvl.ai/tg/wh/3a91" mono />
    </>
  );
}

function MaxSettings() {
  const { t } = useI18n();
  return (
    <>
      <SectionHeader title={t("settings.max_section")} />
      <Field label={t("settings.app_id")} value="max_app_8821" mono />
      <Field label={t("settings.api_key")} value="••••••••••••mx_4f" mono />
      <Field label={t("settings.channel")} value="welcome-bot" />
    </>
  );
}

function SectionHeader({ title, className }: { title: string; className?: string }) {
  return (
    <div
      className={cn(
        "mb-2 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
        className,
      )}
    >
      {title}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="hairline mb-2 rounded-lg bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 truncate text-[12.5px]", mono && "font-mono")}>{value}</div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-elevated px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-[12px] font-medium">{value}</div>
    </div>
  );
}
