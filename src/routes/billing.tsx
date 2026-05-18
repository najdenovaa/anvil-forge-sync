import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/anvl/AuthGate";

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [{ title: "Баланс — ANVL" }] }),
  component: () => (
    <AuthGate>
      <BillingPage />
    </AuthGate>
  ),
});

function BillingPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <Link to="/flows" className="text-[12px] text-muted-foreground hover:text-foreground">
          ← К проектам
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">Баланс</h1>

        <section className="hairline mt-8 rounded-xl bg-surface p-5">
          <h2 className="text-[12px] uppercase tracking-wider text-muted-foreground">
            Текущий баланс
          </h2>
          <p className="mt-2 text-3xl font-semibold text-foreground">0 ₽</p>
        </section>

        <section className="hairline mt-4 rounded-xl bg-surface p-5">
          <h2 className="text-[13px] font-medium text-foreground">Тарифы скоро</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            Сейчас Anvl работает в бесплатном режиме без лимитов. Подключение оплаты
            и тарифные планы в разработке.
          </p>
        </section>
      </div>
    </div>
  );
}
