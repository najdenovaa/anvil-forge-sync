import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/anvl/AuthContext";
import { Loader2 } from "lucide-react";
import anvlLogo from "@/assets/anvl-logo.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Вход — ANVL" }],
  }),
  component: AuthPage,
});

type Tab = "login" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/flows" });
  }, [user, loading, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (tab === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMsg({ type: "ok", text: "Вход выполнен. Перенаправляем…" });
      } else if (tab === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        setMsg({
          type: "ok",
          text: "Аккаунт создан. Проверьте почту для подтверждения, затем войдите.",
        });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMsg({ type: "ok", text: "Письмо для сброса пароля отправлено." });
      }
    } catch (err: any) {
      setMsg({ type: "err", text: err?.message ?? "Что-то пошло не так" });
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

        <div className="mb-6 flex rounded-lg bg-surface-elevated p-1">
          {(["login", "signup", "forgot"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setMsg(null);
              }}
              className={`flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition ${
                tab === t
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "login" ? "Вход" : t === "signup" ? "Регистрация" : "Забыли?"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="hairline w-full rounded-md bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-foreground"
          />
          {tab !== "forgot" && (
            <input
              type="password"
              required
              minLength={6}
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="hairline w-full rounded-md bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-foreground"
            />
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-foreground py-2 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {tab === "login" ? "Sign in" : tab === "signup" ? "Create account" : "Send reset link"}
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

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
