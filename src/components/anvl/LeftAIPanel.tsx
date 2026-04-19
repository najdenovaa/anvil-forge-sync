import { useState } from "react";
import { Sparkles, ArrowUp, Plus, History, Paperclip } from "lucide-react";
import { useI18n } from "./I18nContext";
import { cn } from "@/lib/utils";

export function LeftAIPanel() {
  const [input, setInput] = useState("");
  const { t } = useI18n();

  const messages = [
    { role: "assistant" as const, text: t("ai.msg.intro") },
    { role: "user" as const, text: t("ai.msg.user_example") },
    { role: "assistant" as const, text: t("ai.msg.assistant_example") },
  ];

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-r border-hairline bg-sidebar">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-foreground text-background">
            <Sparkles className="h-2.5 w-2.5" />
          </div>
          <span className="text-[12.5px] font-semibold tracking-tight">{t("ai.title")}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <IconBtn label={t("ai.history")}>
            <History className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label={t("ai.new")}>
            <Plus className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      </div>

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
                <Sparkles className="h-3 w-3" /> {t("ai.label")}
              </div>
            )}
            {m.text}
          </div>
        ))}
      </div>

      <div className="border-t border-hairline p-3">
        <div className="hairline flex items-end gap-2 rounded-xl bg-surface px-3 py-2 focus-within:border-foreground/30">
          <button className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground">
            <Paperclip className="h-3.5 w-3.5" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder={t("ai.placeholder")}
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
          <span>{t("ai.send_hint")}</span>
          <span>{t("ai.model")}</span>
        </div>
      </div>
    </aside>
  );
}

function IconBtn({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
