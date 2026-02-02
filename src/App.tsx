import { ThemeProvider } from "@/providers/ThemeProvider";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Dashboard } from "@/features/dashboard";
import { MiniMode } from "@/features/mini-mode";
import { useWindowType } from "@/hooks/useWindowType";
import { APP_NAME } from "@/lib/constants";
import { toggleMiniMode } from "@/lib/tauri";
import { Minimize2 } from "lucide-react";

function App() {
  const windowType = useWindowType();

  // Render mini mode for mini window
  if (windowType === "mini") {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="hardware-monitor-theme">
        <MiniMode />
      </ThemeProvider>
    );
  }

  // Render main dashboard
  return (
    <ThemeProvider defaultTheme="dark" storageKey="hardware-monitor-theme">
      <div className="min-h-screen bg-background text-foreground scrollbar-thin">
        {/* Header */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-3 sm:px-4 py-3 border-b bg-background/80 backdrop-blur-md">
          <h1 className="text-base sm:text-xl font-semibold tracking-tight">{APP_NAME}</h1>
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Mini Mode Toggle Button */}
            <button
              onClick={() => toggleMiniMode().catch(console.error)}
              className="p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer"
              title="Switch to Mini Mode"
            >
              <Minimize2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <ThemeToggle />
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto max-w-7xl">
          <Dashboard />
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
