import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import anvlLogo from "@/assets/anvl-logo.png";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — ANVL" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMsg({ type: "ok", text: "Password updated. Redirecting…" });
      setTimeout(() => navigate({ to: "/flows" }), 1200);
    } catch (err: any) {
      setMsg({ type: "err", text: err?.message ?? "Failed to update password" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="hairline w-full max-w-sm rounded-2xl bg-surface p-8 shadow-xl">
        <Link to="/" className="mb-6 flex justify-center">
          <img src={anvlLogo} alt="ANVL" className="h-12 w-auto object-contain" />
        </Link>
        <h1 className="mb-4 text-center text-lg font-semibold">Set a new password</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="hairline w-full rounded-md bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-foreground"
          />
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-foreground py-2 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Update password
          </button>
        </form>
        {msg && (
          <p
            className={`mt-4 text-center text-[12px] ${
              msg.type === "ok" ? "text-foreground" : "text-status-err"
            }`}
          >
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
