import { useState } from "react";
import { Sparkles, ArrowUp, Plus, History, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

export function LeftAIPanel() {
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
    <aside className="flex w-[340px] shrink-0 flex-col border-r border-hairline bg-sidebar">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-foreground text-background">
            <Sparkles className="h-2.5 w-2.5" />
          </div>
          <span className="text-[12.5px] font-semibold tracking-tight">AI Architect</span>
        </div>
        <div className="flex items-center gap-0.5">
          <IconBtn label="History">
            <History className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label="New chat">
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
                <Sparkles className="h-3 w-3" /> Architect
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
