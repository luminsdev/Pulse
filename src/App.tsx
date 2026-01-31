import { ThemeProvider } from "@/providers/ThemeProvider";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, HardDrive, MonitorSpeaker } from "lucide-react";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="hardware-monitor-theme">
      <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b">
          <h1 className="text-xl font-semibold">Hardware Monitor</h1>
          <ThemeToggle />
        </header>

        {/* Main Content */}
        <main className="container mx-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* CPU Card Placeholder */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CPU</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">---%</div>
                <p className="text-xs text-muted-foreground">
                  Waiting for data...
                </p>
              </CardContent>
            </Card>

            {/* RAM Card Placeholder */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">---%</div>
                <p className="text-xs text-muted-foreground">
                  Waiting for data...
                </p>
              </CardContent>
            </Card>

            {/* GPU Card Placeholder */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">GPU</CardTitle>
                <MonitorSpeaker className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">---%</div>
                <p className="text-xs text-muted-foreground">
                  Waiting for data...
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart Placeholder */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>System Activity</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
              Chart will be rendered here (Phase 3)
            </CardContent>
          </Card>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
