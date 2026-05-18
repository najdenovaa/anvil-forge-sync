import { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "./AuthContext";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        Sign in
      </Link>
    );
  }

  const initial = user.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="hairline flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 text-[12px] hover:bg-surface-elevated"
        title={user.email ?? ""}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
          {initial}
        </span>
        <span className="max-w-[140px] truncate text-foreground">{user.email}</span>
      </button>
      {open && (
        <div className="hairline absolute right-0 top-[calc(100%+6px)] z-50 min-w-[180px] overflow-hidden rounded-md bg-surface shadow-lg">
          <div className="border-b border-hairline px-3 py-2 text-[11px] text-muted-foreground">
            <UserIcon className="mr-1.5 inline h-3 w-3" />
            Signed in
          </div>
          <button
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-foreground hover:bg-surface-elevated"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
