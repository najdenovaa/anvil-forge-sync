import { useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Plus } from "lucide-react";
import type { VariableDef } from "@/lib/anvl-types";
import { cn } from "@/lib/utils";

interface TemplateInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  /** Available flow variables for autocomplete. */
  availableVars?: VariableDef[];
}

const PLACEHOLDER_RE = /\{[\w.]+\}/g;

const SYSTEM_VARS = [
  "{first_name}",
  "{last_name}",
  "{username}",
  "{system.now}",
  "{system.today}",
  "{text}",
];

/** Splits text into segments and renders placeholders in accent color. */
function renderHighlight(text: string) {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE);
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span
        key={`${m.index}-${m[0]}`}
        className="rounded-sm px-0.5"
        style={{
          color: "var(--accent-trigger, oklch(0.78 0.14 85))",
          background: "color-mix(in oklab, var(--accent-trigger, oklch(0.78 0.14 85)) 12%, transparent)",
        }}
      >
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function TemplateInput({ value, onChange, placeholder, rows = 3, availableVars = [] }: TemplateInputProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);

  const insert = (token: string) => {
    const ta = taRef.current;
    if (!ta) {
      onChange(value + token);
      setOpen(false);
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="space-y-1">
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="hairline w-full resize-none rounded-md bg-surface-elevated px-2 py-1.5 font-mono text-[11.5px] outline-none focus:border-foreground/30"
      />
      {value.trim() && PLACEHOLDER_RE.test(value) && (
        <div className="hairline rounded-md bg-surface px-2 py-1 text-[11px] leading-relaxed">
          <div className="mb-0.5 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Preview</div>
          <div className="whitespace-pre-wrap break-words font-mono">{renderHighlight(value)}</div>
        </div>
      )}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded-md bg-surface-elevated px-1.5 py-0.5 text-[10.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground hairline",
            )}
          >
            <Plus className="h-2.5 w-2.5" /> Insert variable
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            align="start"
            className="z-50 w-[260px] rounded-lg border border-hairline bg-popover p-2 text-popover-foreground shadow-lg"
          >
            <div className="mb-1 px-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">System</div>
            <div className="mb-2 grid grid-cols-2 gap-1">
              {SYSTEM_VARS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insert(v)}
                  className="rounded-md bg-surface-elevated px-1.5 py-1 text-left font-mono text-[10.5px] hover:bg-accent"
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="mb-1 px-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Flow variables ({availableVars.length})
            </div>
            {availableVars.length === 0 ? (
              <div className="px-1 py-1 text-[10.5px] text-muted-foreground">
                None yet — add some in the Variables tab.
              </div>
            ) : (
              <div className="space-y-1">
                {availableVars.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insert(`{var.${v.key}}`)}
                    className="flex w-full items-center justify-between rounded-md bg-surface-elevated px-1.5 py-1 text-left hover:bg-accent"
                  >
                    <span className="font-mono text-[10.5px]">{`{var.${v.key}}`}</span>
                    <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                      {v.type} · {v.scope}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
