import { useState } from "react";
import { Sparkles, Settings2, ArrowUp, Cloud, Check, AlertCircle } from "lucide-react";
import { usePlatform } from "./PlatformContext";
import { cn } from "@/lib/utils";

type Tab = "ai" | "settings";

export function RightPanel() {
  const [tab, setTab] = useState<Tab>("ai");

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-hairline bg-sidebar">
      <div className="flex items-center gap-1 border-b border-hairline px-3 py-2">
        <TabBtn active={tab === "ai"} onClick={() => setTab("ai")} icon={<Sparkles className="h-3.5 w-3.5" />}>
          AI Architect
        </TabBtn>
        <TabBtn active={tab === "settings"} onClick={() => setTab("settings")} icon={<Settings2 className="h-3.5 w-3.5" />}>
          Settings
        </TabBtn>
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === "ai" ? <AIChat /> : <PlatformSettings />}
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

function AIChat() {
  const [input, setInput] = useState("");

  const messages = [
    {
      role: "assistant" as const,
      text: "I'm your AI Architect. Describe the bot you want and I'll lay out the flow on the canvas.",
    },
    {
      role: "user" as const,
      text: "Add a /pricing command that sends an inline keyboard with three plans.",
    },
    {
      role: "assistant" as const,
      text: "Done — I added a Command trigger, a Text message, and an Inline keyboard with Basic / Pro / Team. Connected them on the canvas.",
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[88%] rounded-xl px-3 py-2 text-[12.5px] leading-relaxed",
              m.role === "user"
                ? "ml-auto border border-hairline bg-surface-elevated text-foreground"
                : "border border-hairline bg-surface text-foreground/90",
            )}
          >
            {m.role === "assistant" && (
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                <Sparkles className="h-3 w-3" /> Architect
              </div>
            )}
            {m.text}
          </div>
        ))}
      </div>
      <div className="border-t border-hairline p-3">
        <div className="hairline flex items-end gap-2 rounded-xl bg-surface px-3 py-2 focus-within:border-foreground/30">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder="Describe your bot…"
            className="flex-1 resize-none bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
          />
          <button
            disabled={!input.trim()}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background transition disabled:opacity-30"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
          <span>⌘↵ to send</span>
          <span>gpt-5 · architect</span>
        </div>
      </div>
    </div>
  );
}

function PlatformSettings() {
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
