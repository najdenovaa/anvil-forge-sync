import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { I18nProvider } from "./I18nContext";
import { PlatformProvider } from "./PlatformContext";
import { MiniAppProvider } from "./MiniAppContext";
import { AnvlWorkspaceProvider } from "./AnvlWorkspaceContext";
import { AnvlAppShellProvider, useAnvlShell } from "./AnvlAppShellContext";
import { TelegramWebAppProvider } from "./TelegramWebAppContext";
import { SelectionProvider } from "./SelectionContext";
import { BotSimulatorProvider } from "./BotSimulatorContext";
import { TopBar } from "./TopBar";
import { LeftAIPanel } from "./LeftAIPanel";
import { ForgeCanvas } from "./ForgeCanvas";
import { RightInspector } from "./RightInspector";
import { LandingHero } from "./LandingHero";

function Shell() {
  const { stage } = useAnvlShell();
  if (stage === "landing") {
    return <LandingHero />;
  }
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <LeftAIPanel />
        <main className="relative min-w-0 flex-1">
          <ForgeCanvas />
        </main>
        <RightInspector />
      </div>
    </div>
  );
}

function generateSlug(): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `flow-${rand}`;
}

interface AnvlAppProps {
  slug?: string;
  persist?: boolean;
  /**
   * Landing mode: persist=true with a freshly-generated slug; the flow row is
   * created on the first significant edit and the URL is replaced with
   * /flows/$slug without a full page reload.
   */
  autoCreate?: boolean;
}

export function AnvlApp({ slug, persist = true, autoCreate = false }: AnvlAppProps = {}) {
  // For autoCreate (landing), generate a stable slug once per mount so the
  // first save targets a deterministic row and the navigate() URL matches.
  const [generatedSlug] = useState(() => (autoCreate && !slug ? generateSlug() : null));
  const effectiveSlug = slug ?? generatedSlug ?? undefined;

  const navigate = useNavigate();
  const handleFlowCreated = useCallback(
    (createdSlug: string) => {
      navigate({
        to: "/flows/$slug",
        params: { slug: createdSlug },
        replace: true,
      });
    },
    [navigate],
  );

  return (
    <I18nProvider>
      <PlatformProvider>
        <MiniAppProvider>
          <TelegramWebAppProvider>
            <AnvlWorkspaceProvider
              slug={effectiveSlug}
              persist={persist}
              autoCreate={autoCreate}
              onFlowCreated={autoCreate ? handleFlowCreated : undefined}
            >
              <SelectionProvider>
                <BotSimulatorProvider>
                  <AnvlAppShellProvider>
                    <Shell />
                  </AnvlAppShellProvider>
                </BotSimulatorProvider>
              </SelectionProvider>
            </AnvlWorkspaceProvider>
          </TelegramWebAppProvider>
        </MiniAppProvider>
      </PlatformProvider>
    </I18nProvider>
  );
}
