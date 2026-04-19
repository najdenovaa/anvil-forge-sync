import { useState } from "react";
import { Settings2, LayoutGrid, Cloud, Check, AlertCircle } from "lucide-react";
import { usePlatform } from "./PlatformContext";
import { NODE_CATALOG, NODE_GROUPS } from "@/lib/anvl-catalog";
import type { NodeKind } from "@/lib/anvl-types";
import { cn } from "@/lib/utils";

type Tab = "components" | "settings";

export function RightInspector() {
  const [tab, setTab] = useState<Tab>("components");

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-l border-hairline bg-sidebar">
      <div className="flex items-center gap-1 border-b border-hairline px-3 py-2">
        <TabBtn
          active={tab === "components"}
          onClick={() => setTab("components")}
          icon={<LayoutGrid className="h-3.5 w-3.5" />}
        >
          Components
        </TabBtn>
        <TabBtn
          active={tab === "settings"}
          onClick={() => setTab("settings")}
          icon={<Settings2 className="h-3.5 w-3.5" />}
        >
          Settings
        </TabBtn>
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === "components" ? <ComponentsPane /> : <SettingsPane />}
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
              {group}
            </div>
            <div className="space-y-1">
              {items.map((item) => (
                <div
                  key={item.kind}
                  draggable
                  onDragStart={(e) => onDragStart(e, item.kind)}
                  className="group flex cursor-grab items-center gap-2.5 rounded-md border border-transparent bg-transparent px-2 py-1.5 transition hover:border-hairline hover:bg-accent active:cursor-grabbing"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-md border border-hairline bg-surface-elevated text-foreground/80 transition group-hover:text-foreground">
                    <item.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium leading-tight">
                      {item.label}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {item.description}
                    </div>
                  </div>
                </div>
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

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <SectionHeader title="Cloud status" />
      <div className="hairline mb-5 grid grid-cols-2 gap-2 rounded-lg bg-surface p-3">
        <Stat icon={<Cloud className="h-3 w-3" />} label="Production" value="anvl.app" />
        <Stat icon={<Check className="h-3 w-3 text-status-ok" />} label="Webhook" value="Healthy" />
        <Stat icon={<Check className="h-3 w-3 text-status-ok" />} label="Telegram" value="200 OK" />
        <Stat
          icon={<AlertCircle className="h-3 w-3 text-status-warn" />}
          label="Max"
          value="Reauth"
        />
      </div>

      {platform === "telegram" ? <TelegramSettings /> : <MaxSettings />}

      <SectionHeader title="Mini App" className="mt-6" />
      <Field label="WebView URL" value="https://app.anvl.ai/u/welcome-bot" />
      <Field label="Init mode" value="Telegram.WebApp · Max SDK" />
    </div>
  );
}

function TelegramSettings() {
  return (
    <>
      <SectionHeader title="Telegram · BotFather" />
      <Field label="Bot username" value="@welcome_anvl_bot" />
      <Field label="Bot token" value="••••••••••••:AAFx-9KQ" mono />
      <Field label="Webhook" value="https://api.anvl.ai/tg/wh/3a91" mono />
    </>
  );
}

function MaxSettings() {
  return (
    <>
      <SectionHeader title="Max Messenger · Developer" />
      <Field label="App ID" value="max_app_8821" mono />
      <Field label="API key" value="••••••••••••mx_4f" mono />
      <Field label="Channel" value="welcome-bot" />
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
