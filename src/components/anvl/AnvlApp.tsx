import { PlatformProvider } from "./PlatformContext";
import { TopBar } from "./TopBar";
import { ComponentLibrary } from "./ComponentLibrary";
import { ForgeCanvas } from "./ForgeCanvas";
import { RightPanel } from "./RightPanel";

export function AnvlApp() {
  return (
    <PlatformProvider>
      <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <ComponentLibrary />
          <main className="relative min-w-0 flex-1">
            <ForgeCanvas />
          </main>
          <RightPanel />
        </div>
      </div>
    </PlatformProvider>
  );
}
