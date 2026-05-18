import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/anvl/AuthGate";
import { useAuth } from "@/components/anvl/AuthContext";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Настройки — ANVL" }] }),
  component: () => (
    <AuthGate>
      <SettingsPage />
    </AuthGate>
  ),
});

function SettingsPage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <Link to="/flows" className="text-[12px] text-muted-foreground hover:text-foreground">
          ← К проектам
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">Настройки</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{user?.email}</p>

        <section className="hairline mt-8 rounded-xl bg-surface p-5">
          <h2 className="text-[13px] font-medium text-foreground">Аккаунт</h2>
          <p className="mt-2 text-[12px] text-muted-foreground">
            ID: <span className="font-mono">{user?.id}</span>
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">Email: {user?.email}</p>
        </section>

        <section className="hairline mt-4 rounded-xl bg-surface p-5">
          <h2 className="text-[13px] font-medium text-foreground">В разработке</h2>
          <ul className="mt-2 space-y-1 text-[12px] text-muted-foreground">
            <li>• Смена пароля</li>
            <li>• API-ключи для интеграций</li>
            <li>• Уведомления</li>
            <li>• Двухфакторная аутентификация</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
