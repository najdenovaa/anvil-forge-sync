import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { I18nProvider } from "@/components/anvl/I18nContext";
import { PlatformProvider } from "@/components/anvl/PlatformContext";
import { MiniAppProvider } from "@/components/anvl/MiniAppContext";
import { DynamicMiniAppView } from "@/components/anvl/DynamicMiniApp";
import type { AnvlMiniAppState } from "@/lib/anvl-blueprint";

export const Route = createFileRoute("/m/$flowId")({
  head: ({ params }) => ({
    meta: [
      { title: `Mini App — ${params.flowId}` },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
    // CRITICAL: load the official Telegram WebApp SDK so window.Telegram.WebApp
    // is the REAL one (sendData reaches the bot), not our preview mock.
    scripts: [{ src: "https://telegram.org/js/telegram-web-app.js", async: false }],
  }),
  component: PublicMiniApp,
});

function PublicMiniApp() {
  const { flowId } = Route.useParams();
  const [miniApp, setMiniApp] = useState<Partial<AnvlMiniAppState> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const isUuid = /^[0-9a-f-]{36}$/i.test(flowId);
      const q = isUuid
        ? supabase.from("flows").select("miniapp").eq("id", flowId).maybeSingle()
        : supabase.from("flows").select("miniapp").eq("slug", flowId).maybeSingle();
      const { data, error } = await q;
      if (!alive) return;
      if (error) {
        setError(error.message);
        return;
      }
      setMiniApp((data?.miniapp as Partial<AnvlMiniAppState>) ?? {});
    })();
    return () => {
      alive = false;
    };
  }, [flowId]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-red-500">
        {error}
      </div>
    );
  }
  if (!miniApp) {
    return (
      <div className="flex h-screen items-center justify-center text-sm opacity-60">
        Loading…
      </div>
    );
  }

  return (
    <I18nProvider>
      <PlatformProvider>
        <MiniAppProvider>
          <div className="h-screen w-screen overflow-hidden">
            <DynamicMiniAppView miniApp={miniApp} flowId={flowId} />
          </div>
        </MiniAppProvider>
      </PlatformProvider>
    </I18nProvider>
  );
}
