import { I18nProvider } from "./I18nContext";
import { PlatformProvider } from "./PlatformContext";
import { MiniAppProvider } from "./MiniAppContext";
import { AnvlWorkspaceProvider } from "./AnvlWorkspaceContext";
import { AnvlAppShellProvider, useAnvlShell } from "./AnvlAppShellContext";
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

export function AnvlApp() {
  return (
    <I18nProvider>
      <PlatformProvider>
        <MiniAppProvider>
          <AnvlWorkspaceProvider>
            <AnvlAppShellProvider>
              <Shell />
            </AnvlAppShellProvider>
          </AnvlWorkspaceProvider>
        </MiniAppProvider>
      </PlatformProvider>
    </I18nProvider>
  );
}
