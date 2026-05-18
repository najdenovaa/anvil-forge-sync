import { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, LogOut, Settings, Wallet, MessageSquare, Plus } from "lucide-react";
import { useAuth } from "./AuthContext";
import { listFlows } from "@/lib/anvl-flow-storage";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: flows = [] } = useQuery({
    queryKey: ["anvl-flows-list", user?.id],
    queryFn: listFlows,
    enabled: !!user && open,
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!user) {
    return (
      <Link
        to="/auth"
        className="hairline rounded-md bg-surface px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-surface-elevated"
      >
        Войти
      </Link>
    );
  }

  const initial = user.email?.[0]?.toUpperCase() ?? "?";
  const recent = flows.slice(0, 5);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="hairline flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-2 text-[12px] hover:bg-surface-elevated"
        title={user.email ?? ""}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
          {initial}
        </span>
        <span className="max-w-[160px] truncate text-foreground">{user.email}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="hairline absolute left-0 top-[calc(100%+6px)] z-[100] w-[280px] overflow-hidden rounded-lg bg-background shadow-2xl ring-1 ring-black/5">
          {/* Header */}
          <div className="border-b border-hairline px-3 py-2.5">
            <div className="truncate text-[12px] font-medium text-foreground">{user.email}</div>
            <div className="text-[10px] text-muted-foreground">Личный кабинет</div>
          </div>

          {/* Balance */}
          <div className="border-b border-hairline px-3 py-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Wallet className="h-3 w-3" />
              Баланс
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-foreground">0 ₽</span>
              <Link
                to="/billing"
                onClick={() => setOpen(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Пополнить
              </Link>
            </div>
          </div>

          {/* Projects */}
          <div className="border-b border-hairline px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" />
                Проекты
              </span>
              <Link
                to="/flows"
                onClick={() => setOpen(false)}
                className="normal-case tracking-normal hover:text-foreground"
              >
                Все
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="py-1 text-[11px] text-muted-foreground">Пока нет проектов</div>
            ) : (
              <ul className="space-y-0.5">
                {recent.map((f) => (
                  <li key={f.id}>
                    <Link
                      to="/flows/$slug"
                      params={{ slug: f.slug }}
                      onClick={() => setOpen(false)}
                      className="block truncate rounded px-1.5 py-1 text-[12px] text-foreground hover:bg-surface-elevated"
                    >
                      {f.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/flows"
              onClick={() => setOpen(false)}
              className="mt-1.5 flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              Новый проект
            </Link>
          </div>

          {/* Actions */}
          <div className="py-1">
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-foreground hover:bg-surface-elevated"
            >
              <Settings className="h-3.5 w-3.5" />
              Настройки
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-foreground hover:bg-surface-elevated"
            >
              <LogOut className="h-3.5 w-3.5" />
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
