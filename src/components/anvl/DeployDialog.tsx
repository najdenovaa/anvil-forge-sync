import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Eye, EyeOff, Loader2, Check, X, Send, Rocket, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "./I18nContext";

const TOKEN_FORMAT = /^\d{8,10}:[A-Za-z0-9_-]{35}$/;

type ValidationState =
  | { kind: "idle" }
  | { kind: "format_error" }
  | { kind: "checking" }
  | { kind: "ok"; username: string | null; first_name: string | null }
  | { kind: "rejected" }
  | { kind: "network" };

interface DeployDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowId: string | null;
  /** Existing bot username when re-issuing (used in the "replace" confirm). */
  existingBotUsername?: string | null;
  /** Called after a successful deploy so the parent can invalidate the bot query. */
  onDeployed?: (info: { bot_id: string; bot_username: string | null }) => void;
}

export function DeployDialog({
  open,
  onOpenChange,
  flowId,
  existingBotUsername,
  onDeployed,
}: DeployDialogProps) {
  const { t } = useI18n();
  const [platform, setPlatform] = useState<"telegram" | "max">("telegram");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [consent, setConsent] = useState(false);
  const [validation, setValidation] = useState<ValidationState>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ username: string | null; bot_id: string } | null>(null);
  const [confirmReplace, setConfirmReplace] = useState<null | { newUsername: string | null }>(null);

  const debounceRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);

  // Reset on close.
  useEffect(() => {
    if (!open) {
      setToken("");
      setShowToken(false);
      setConsent(false);
      setValidation({ kind: "idle" });
      setSubmitting(false);
      setSubmitError(null);
      setSuccess(null);
      setConfirmReplace(null);
    }
  }, [open]);

  // Debounced validation.
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!token) {
      setValidation({ kind: "idle" });
      return;
    }
    if (!TOKEN_FORMAT.test(token)) {
      setValidation({ kind: "format_error" });
      return;
    }
    setValidation({ kind: "checking" });
    const myReq = ++reqIdRef.current;
    debounceRef.current = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("validate-bot-token", {
          body: { token, platform: "telegram" },
        });
        if (myReq !== reqIdRef.current) return;
        if (error) {
          setValidation({ kind: "network" });
          return;
        }
        if (data?.ok) {
          setValidation({ kind: "ok", username: data.username, first_name: data.first_name });
        } else if (data?.error === "telegram_rejected" || data?.error === "bad_format") {
          setValidation({ kind: "rejected" });
        } else if (data?.error === "network") {
          setValidation({ kind: "network" });
        } else {
          setValidation({ kind: "rejected" });
        }
      } catch {
        if (myReq !== reqIdRef.current) return;
        setValidation({ kind: "network" });
      }
    }, 800);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [token]);

  const canSubmit =
    !submitting &&
    consent &&
    platform === "telegram" &&
    validation.kind === "ok" &&
    !!flowId;

  async function performDeploy() {
    if (!flowId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data, error } = await supabase.functions.invoke("deploy-bot", {
        body: { flow_id: flowId, platform, token },
      });
      if (error || !data || data.error) {
        const msg = (data?.error as string) || error?.message || "unknown";
        if (/telegram/i.test(msg)) {
          setSubmitError(t("deploy.token.error.rejected"));
        } else {
          setSubmitError(t("deploy.error.server"));
          toast.error(t("deploy.error.server"));
        }
        setSubmitting(false);
        return;
      }
      setSuccess({ username: data.bot_username ?? null, bot_id: data.bot_id });
      onDeployed?.({ bot_id: data.bot_id, bot_username: data.bot_username ?? null });
    } catch {
      setSubmitError(t("deploy.error.network"));
      toast.error(t("deploy.error.network"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmitClick() {
    if (!canSubmit) return;
    const newUsername = validation.kind === "ok" ? validation.username : null;
    if (
      existingBotUsername &&
      newUsername &&
      existingBotUsername !== newUsername
    ) {
      setConfirmReplace({ newUsername });
      return;
    }
    void performDeploy();
  }

  // ---------- Success screen ----------
  if (success) {
    const username = success.username;
    const url = username ? `https://t.me/${username}` : null;
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                <Check className="h-4 w-4" />
              </span>
              {t("deploy.success.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 pt-2">
            {username && (
              <div className="text-center">
                <div className="text-lg font-semibold">@{username}</div>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {url} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
            {url && (
              <div className="rounded-lg border border-hairline bg-white p-3">
                <QRCodeSVG value={url} size={200} />
              </div>
            )}
            <p className="text-center text-sm text-muted-foreground">
              {t("deploy.success.hint")}
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => onOpenChange(false)}>
              {t("deploy.success.done")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ---------- Form screen ----------
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              {t("deploy.dialog.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Platform */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("deploy.dialog.platform")}
              </Label>
              <TooltipProvider delayDuration={200}>
                <RadioGroup
                  value={platform}
                  onValueChange={(v) => setPlatform(v as "telegram" | "max")}
                  className="flex gap-2"
                >
                  <PlatformOption
                    value="telegram"
                    label={t("platform.telegram")}
                    icon={<Send className="h-3.5 w-3.5" />}
                    selected={platform === "telegram"}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <PlatformOption
                          value="max"
                          label={t("platform.max")}
                          icon={<span className="text-[10px]">M</span>}
                          selected={false}
                          disabled
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t("deploy.dialog.platform.max_soon")}
                    </TooltipContent>
                  </Tooltip>
                </RadioGroup>
              </TooltipProvider>
            </div>

            {/* Token */}
            <div className="space-y-1.5">
              <Label
                htmlFor="bot-token"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                {t("deploy.token.label")}
              </Label>
              <div className="relative">
                <Input
                  id="bot-token"
                  type={showToken ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t("deploy.token.placeholder")}
                  value={token}
                  onChange={(e) => setToken(e.target.value.trim())}
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((s) => !s)}
                  aria-label={showToken ? t("deploy.token.hide") : t("deploy.token.show")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <ValidationLine state={validation} />
            </div>

            {/* Consent */}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-hairline bg-surface p-3 text-sm">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5"
              />
              <span className="text-muted-foreground">{t("deploy.consent")}</span>
            </label>

            {submitError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {submitError}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("deploy.cancel")}
            </Button>
            <Button onClick={handleSubmitClick} disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {t("deploy.submitting")}
                </>
              ) : (
                <>
                  <Rocket className="mr-1.5 h-3.5 w-3.5" />
                  {t("deploy.submit")}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmReplace}
        onOpenChange={(v) => !v && setConfirmReplace(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deploy.replace.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deploy.replace.body", {
                old: existingBotUsername ? `@${existingBotUsername}` : "—",
                new: confirmReplace?.newUsername ? `@${confirmReplace.newUsername}` : "—",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("deploy.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmReplace(null);
                void performDeploy();
              }}
            >
              {t("deploy.replace.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PlatformOption({
  value,
  label,
  icon,
  selected,
  disabled,
}: {
  value: string;
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  disabled?: boolean;
}) {
  return (
    <Label
      htmlFor={`pf-${value}`}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-hairline bg-surface text-muted-foreground hover:text-foreground",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <RadioGroupItem id={`pf-${value}`} value={value} disabled={disabled} className="sr-only" />
      {icon}
      {label}
    </Label>
  );
}

function ValidationLine({ state }: { state: ValidationState }) {
  const { t } = useI18n();
  if (state.kind === "idle") {
    return <p className="h-4 text-xs text-muted-foreground/70">&nbsp;</p>;
  }
  if (state.kind === "format_error") {
    return (
      <p className="flex items-center gap-1 text-xs text-destructive">
        <X className="h-3 w-3" /> {t("deploy.token.error.format")}
      </p>
    );
  }
  if (state.kind === "checking") {
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> {t("deploy.token.checking")}
      </p>
    );
  }
  if (state.kind === "ok") {
    return (
      <p className="flex items-center gap-1 text-xs text-emerald-500">
        <Check className="h-3 w-3" />{" "}
        {state.username ? `@${state.username}` : t("deploy.token.ok")}
      </p>
    );
  }
  if (state.kind === "rejected") {
    return (
      <p className="flex items-center gap-1 text-xs text-destructive">
        <X className="h-3 w-3" /> {t("deploy.token.error.rejected")}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1 text-xs text-amber-500">
      <X className="h-3 w-3" /> {t("deploy.token.error.network")}
    </p>
  );
}
