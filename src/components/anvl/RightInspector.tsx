import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { Settings2, LayoutGrid, Cloud, Check, AlertCircle, Code2, MousePointer2, Variable, Trash2, Plus, X } from "lucide-react";
import { usePlatform } from "./PlatformContext";
import { useI18n } from "./I18nContext";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import { useSelection } from "./SelectionContext";
import { NodeInspector } from "./NodeInspector";
import { NODE_CATALOG, NODE_GROUPS } from "@/lib/anvl-catalog";
import type { NodeKind, VariableDef, VariableScope, VariableType } from "@/lib/anvl-types";
import { cn } from "@/lib/utils";

type Tab = "components" | "node" | "variables" | "settings" | "code";

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
        <TabBtn active={tab === "variables"} onClick={() => setTab("variables")} icon={<Variable className="h-3.5 w-3.5" />}>
          Vars
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
            {tab === "components" ? <ComponentsPane /> : tab === "node" ? <NodeInspector /> : tab === "variables" ? <VariablesPane /> : tab === "settings" ? <SettingsPane /> : <CodePane />}
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

function VariablesPane() {
  const { variables, setVariables } = useAnvlWorkspace();
  const [showAdd, setShowAdd] = useState(false);

  const byScope = useMemo(
    () => ({
      session: variables.filter((v) => v.scope === "session"),
      user: variables.filter((v) => v.scope === "user"),
      global: variables.filter((v) => v.scope === "global"),
    }),
    [variables],
  );

  return (
    <div className="h-full overflow-y-auto px-3 py-3">
      <button
        onClick={() => setShowAdd(true)}
        className="hairline mb-3 flex w-full items-center justify-center gap-1 rounded-md bg-surface-elevated px-2 py-1.5 text-[12px] font-medium hover:bg-accent"
      >
        <Plus className="h-3 w-3" /> New variable
      </button>

      {(["session", "user"] as const).map((scope) => (
        <div key={scope} className="mb-4">
          <div className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {scope === "session" ? "Session" : "User"}
          </div>
          {byScope[scope].length === 0 ? (
            <div className="px-1 py-1 text-[11px] text-muted-foreground">No variables yet</div>
          ) : (
            <div className="space-y-1">
              {byScope[scope].map((v) => (
                <VariableRow
                  key={v.key + v.scope}
                  def={v}
                  onDelete={() => setVariables((vs) => vs.filter((x) => !(x.key === v.key && x.scope === v.scope)))}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="hairline mt-4 rounded-md bg-surface px-2.5 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
        <div className="mb-1 font-semibold uppercase tracking-[0.12em] text-foreground/70">System variables</div>
        <div className="font-mono">{"{first_name} {last_name} {username}"}</div>
        <div className="font-mono">{"{system.now} {system.today}"}</div>
        <div className="font-mono">{"{text}"} — last user message</div>
      </div>

      {showAdd && (
        <AddVariableDialog
          existing={variables}
          onClose={() => setShowAdd(false)}
          onAdd={(def) => {
            setVariables((vs) => [...vs, def]);
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}

function VariableRow({ def, onDelete }: { def: VariableDef; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="hairline flex items-center justify-between gap-2 rounded-md bg-surface px-2 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[11.5px]">{def.key}</div>
        {def.description && (
          <div className="truncate text-[10px] text-muted-foreground">{def.description}</div>
        )}
      </div>
      <span className="hairline rounded bg-surface-elevated px-1 py-0.5 text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
        {def.type}
      </span>
      <button
        onClick={() => (confirm ? onDelete() : setConfirm(true))}
        onBlur={() => setConfirm(false)}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-status-err/10 hover:text-status-err",
          confirm && "bg-status-err/10 text-status-err",
        )}
        title={confirm ? "Click again to confirm" : "Delete"}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

const KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function AddVariableDialog({
  existing,
  onClose,
  onAdd,
}: {
  existing: VariableDef[];
  onClose: () => void;
  onAdd: (def: VariableDef) => void;
}) {
  const [key, setKey] = useState("");
  const [scope, setScope] = useState<VariableScope>("session");
  const [type, setType] = useState<VariableType>("string");
  const [defaultValue, setDefaultValue] = useState("");
  const [description, setDescription] = useState("");

  const trimmed = key.trim();
  const error = !trimmed
    ? "Key is required"
    : !KEY_RE.test(trimmed)
      ? "Latin letters, digits and _, must not start with digit"
      : existing.some((v) => v.key === trimmed)
        ? "Key already exists"
        : null;

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-hairline bg-popover p-4 text-popover-foreground shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-[13px] font-semibold">New variable</Dialog.Title>
            <Dialog.Close className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></Dialog.Close>
          </div>

          <div className="space-y-2.5">
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Key</div>
              <input
                autoFocus
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="user_name"
                className="hairline w-full rounded-md bg-surface-elevated px-2 py-1.5 font-mono text-[12px] outline-none focus:border-foreground/30"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Scope</div>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as VariableScope)}
                  className="hairline w-full rounded-md bg-surface-elevated px-2 py-1.5 text-[12px] outline-none"
                >
                  <option value="session">session</option>
                  <option value="user">user</option>
                </select>
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Type</div>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as VariableType)}
                  className="hairline w-full rounded-md bg-surface-elevated px-2 py-1.5 text-[12px] outline-none"
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="json">json</option>
                </select>
              </label>
            </div>

            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Default (optional)</div>
              <input
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                className="hairline w-full rounded-md bg-surface-elevated px-2 py-1.5 text-[12px] outline-none"
              />
            </label>

            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Description (optional)</div>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="hairline w-full rounded-md bg-surface-elevated px-2 py-1.5 text-[12px] outline-none"
              />
            </label>

            {error && <div className="text-[11px] text-status-err">{error}</div>}
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button onClick={onClose} className="rounded-md px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-accent">Cancel</button>
            <button
              disabled={!!error}
              onClick={() =>
                onAdd({
                  key: trimmed,
                  scope,
                  type,
                  defaultValue: defaultValue || undefined,
                  description: description || undefined,
                })
              }
              className="rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
