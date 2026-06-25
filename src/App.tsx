import { ThemeProvider } from "@/providers/ThemeProvider";
import { Dashboard } from "@/features/dashboard";
import { MiniMode } from "@/features/mini-mode";
import { useWindowType } from "@/hooks/useWindowType";

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
      <div className="min-h-screen bg-[#030303] text-foreground scrollbar-thin antialiased">
        {/* Main Content */}
        <main className="w-full min-h-screen">
          <Dashboard />
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
