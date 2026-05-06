import { useMemo } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useSelection } from "./SelectionContext";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import { useI18n } from "./I18nContext";
import { TemplateInput } from "./TemplateInput";
import { ConditionBuilder } from "./ConditionBuilder";
import { tryParseCondition } from "@/lib/condition-eval-shared";
import type { NodeKind } from "@/lib/anvl-types";
import { cn } from "@/lib/utils";

/** Param keys per kind that are run through the template engine — they get
 *  the TemplateInput editor with placeholder autocomplete + preview. */
const TEMPLATE_FIELDS: Partial<Record<NodeKind, Set<string>>> = {
  "message.text": new Set(["text"]),
  "message.photo": new Set(["caption"]),
  "action.set_var": new Set(["value"]),
  "action.input": new Set(["prompt"]),
  "action.api": new Set(["url", "body"]),
};

/**
 * Per-kind parameter schema. Each entry describes which fields the inspector
 * shows for a given node kind. Values are stored under node.data.params.
 */
const FIELD_SCHEMAS: Record<NodeKind, { key: string; label: string; type: "text" | "textarea" | "select"; options?: string[]; placeholder?: string }[]> = {
  "trigger.command": [
    { key: "command", label: "Command", type: "text", placeholder: "/start" },
    { key: "description", label: "Description", type: "text", placeholder: "Start the bot" },
  ],
  "trigger.message": [
    { key: "match", label: "Match", type: "text", placeholder: "regex or text" },
  ],
  "trigger.callback": [
    { key: "data", label: "Callback data", type: "text", placeholder: "open_menu" },
  ],
  "message.text": [
    { key: "text", label: "Text", type: "textarea", placeholder: "Hello {first_name}!" },
    { key: "parseMode", label: "Parse mode", type: "select", options: ["HTML", "MarkdownV2", "None"] },
  ],
  "message.photo": [
    { key: "url", label: "Photo URL", type: "text", placeholder: "https://..." },
    { key: "caption", label: "Caption", type: "textarea" },
  ],
  "message.document": [
    { key: "url", label: "Document URL", type: "text" },
    { key: "filename", label: "Filename", type: "text" },
  ],
  "keyboard.inline": [
    { key: "buttons", label: "Buttons (one per line: label|action)", type: "textarea", placeholder: "Order|order\nHelp|help" },
  ],
  "keyboard.reply": [
    { key: "buttons", label: "Buttons (one per line)", type: "textarea", placeholder: "Yes\nNo" },
    { key: "resize", label: "Resize keyboard", type: "select", options: ["true", "false"] },
  ],
  "miniapp.screen": [
    { key: "screenId", label: "Screen id", type: "text", placeholder: "main" },
    { key: "url", label: "WebApp URL", type: "text", placeholder: "https://app.anvl.ai/u/..." },
  ],
  "logic.condition": [
    { key: "expression", label: "Condition", type: "textarea", placeholder: "user.balance > 100" },
    { key: "trueBranch", label: "True → node id", type: "text", placeholder: "n2" },
    { key: "falseBranch", label: "False → node id", type: "text", placeholder: "n3" },
  ],
  "action.api": [
    { key: "method", label: "Method", type: "select", options: ["GET", "POST", "PUT", "DELETE"] },
    { key: "url", label: "URL", type: "text", placeholder: "https://api.example.com/..." },
    { key: "body", label: "Body (JSON)", type: "textarea", placeholder: "{ \"key\": \"value\" }" },
  ],
  "action.set_var": [
    { key: "variable", label: "Variable", type: "text", placeholder: "user_name" },
    { key: "value", label: "Value", type: "textarea", placeholder: "{first_name} or static value" },
    { key: "scope", label: "Scope", type: "select", options: ["session", "user"] },
  ],
  "action.input": [
    { key: "variable", label: "Save to variable", type: "text", placeholder: "user_phone" },
    { key: "prompt", label: "Question to user", type: "textarea", placeholder: "Введите ваш телефон:" },
    { key: "validation", label: "Validation regex (optional)", type: "text", placeholder: "^\\+?\\d{10,12}$" },
    { key: "errorMessage", label: "Error message", type: "text", placeholder: "Неверный формат, попробуйте ещё раз" },
    { key: "scope", label: "Scope", type: "select", options: ["session", "user"] },
  ],
};

export function NodeInspector() {
  const { t } = useI18n();
  const { selectedId, setSelectedId } = useSelection();
  const { nodes, setNodes, setEdges, updateAiNodeParam, variables } = useAnvlWorkspace();

  const node = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);

  if (!node) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-[12px] leading-relaxed text-muted-foreground">
        {t("inspector.empty") || "Click a node on the canvas to edit its parameters."}
      </div>
    );
  }

  const kind = (node.data?.kind as NodeKind) ?? "message.text";
  const schema = FIELD_SCHEMAS[kind] ?? [];
  const params: Record<string, string> = (node.data?.params as Record<string, string>) ?? {};
  const titleVal: string = (node.data?.title as string) ?? (node.data?.titleKey as string) ?? kind;

  const removeNode = () => {
    setNodes((ns) => ns.filter((n) => n.id !== node.id));
    setEdges((es) => es.filter((e) => e.source !== node.id && e.target !== node.id));
    setSelectedId(null);
  };

  const setTitle = (val: string) => {
    setNodes((ns) =>
      ns.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, title: val, titleKey: undefined } } : n)),
    );
  };

  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="h-full overflow-y-auto px-3 py-3"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{kind}</div>
          <div className="truncate text-[13px] font-semibold">{titleVal}</div>
        </div>
        <button
          onClick={removeNode}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-status-err/10 hover:text-status-err"
          title="Delete node"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <Accordion.Root type="multiple" defaultValue={["general", "params"]} className="space-y-2">
        <AccordionItem value="general" label="General">
          <FieldRow label="Title" value={titleVal} onChange={setTitle} />
        </AccordionItem>

        <AccordionItem value="params" label="Parameters">
          {schema.length === 0 ? (
            <div className="px-1 py-1 text-[11px] text-muted-foreground">No parameters for this node kind.</div>
          ) : (
            schema.map((f) => {
              const isTpl = f.type === "textarea" && TEMPLATE_FIELDS[kind]?.has(f.key);
              if (isTpl) {
                return (
                  <label key={f.key} className="block">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{f.label}</div>
                    <TemplateInput
                      value={params[f.key] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(v) => updateAiNodeParam(node.id, f.key, v)}
                      availableVars={variables}
                    />
                  </label>
                );
              }
              return f.type === "textarea" ? (
                <FieldArea
                  key={f.key}
                  label={f.label}
                  value={params[f.key] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(v) => updateAiNodeParam(node.id, f.key, v)}
                />
              ) : f.type === "select" ? (
                <FieldSelect
                  key={f.key}
                  label={f.label}
                  value={params[f.key] ?? ""}
                  options={f.options ?? []}
                  onChange={(v) => updateAiNodeParam(node.id, f.key, v)}
                />
              ) : (
                <FieldRow
                  key={f.key}
                  label={f.label}
                  value={params[f.key] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(v) => updateAiNodeParam(node.id, f.key, v)}
                />
              );
            })
          )}
        </AccordionItem>

        <AccordionItem value="meta" label="Meta">
          <FieldArea
            label="Preview"
            value={(node.data?.preview as string) ?? ""}
            onChange={(v) =>
              setNodes((ns) =>
                ns.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, preview: v, previewKey: undefined } } : n)),
              )
            }
          />
          <div className="mt-2 rounded-md bg-surface-elevated px-2 py-1.5 text-[10.5px] text-muted-foreground">
            id: <span className="font-mono">{node.id}</span>
          </div>
        </AccordionItem>
      </Accordion.Root>
    </motion.div>
  );
}

function AccordionItem({ value, label, children }: { value: string; label: string; children: React.ReactNode }) {
  return (
    <Accordion.Item value={value} className="hairline overflow-hidden rounded-lg bg-surface">
      <Accordion.Header>
        <Accordion.Trigger
          className={cn(
            "group flex w-full items-center justify-between px-3 py-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-foreground/80 transition hover:bg-accent/40",
          )}
        >
          {label}
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="space-y-2 border-t border-hairline px-3 py-2.5">
        {children}
      </Accordion.Content>
    </Accordion.Item>
  );
}

function FieldRow({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="hairline w-full rounded-md bg-surface-elevated px-2 py-1.5 text-[12px] outline-none focus:border-foreground/30"
      />
    </label>
  );
}

function FieldArea({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="hairline w-full resize-none rounded-md bg-surface-elevated px-2 py-1.5 font-mono text-[11.5px] outline-none focus:border-foreground/30"
      />
    </label>
  );
}

function FieldSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="hairline w-full rounded-md bg-surface-elevated px-2 py-1.5 text-[12px] outline-none focus:border-foreground/30"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
