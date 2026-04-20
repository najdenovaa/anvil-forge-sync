import { I18nProvider } from "./I18nContext";
import { PlatformProvider } from "./PlatformContext";
import { MiniAppProvider } from "./MiniAppContext";
import { TopBar } from "./TopBar";
import { LeftAIPanel } from "./LeftAIPanel";
import { ForgeCanvas } from "./ForgeCanvas";
import { RightInspector } from "./RightInspector";

export function AnvlApp() {
  return (
    <I18nProvider>
      <PlatformProvider>
        <MiniAppProvider>
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
        </MiniAppProvider>
      </PlatformProvider>
    </I18nProvider>
  );
}
