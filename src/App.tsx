import { ThemeProvider } from "@/providers/ThemeProvider";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Dashboard } from "@/features/dashboard";
import { APP_NAME } from "@/lib/constants";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="hardware-monitor-theme">
      <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <header className="sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm">
          <h1 className="text-xl font-semibold">{APP_NAME}</h1>
          <ThemeToggle />
        </header>

        {/* Main Content */}
        <main className="container mx-auto p-4">
          <Dashboard />
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
