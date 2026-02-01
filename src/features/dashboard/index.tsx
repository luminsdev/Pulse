import { motion } from "framer-motion";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { useSystemStats } from "./hooks/useSystemStats";
import {
  CpuCard,
  RamCard,
  GpuCard,
  SystemInfoCard,
  TopProcessesCard,
  PerformanceChart,
} from "./components";

/**
 * Main Dashboard component
 * Displays realtime system metrics in a professional grid layout
 */
export function Dashboard() {
  const { stats, history, isConnected } = useSystemStats();

  return (
    <div className="space-y-4 p-4">
      {/* Header with Connection Status */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-between"
      >
        <h1 className="text-xl font-semibold">Hardware Monitor</h1>
        <div className="flex items-center gap-2 text-sm">
          {isConnected ? (
            <>
              <Wifi className="h-4 w-4 text-emerald-500" />
              <span className="text-muted-foreground">Live</span>
              <Activity className="h-3 w-3 animate-pulse text-emerald-500" />
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Connecting...</span>
            </>
          )}
        </div>
      </motion.div>

      {/* Top Row: Hardware Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CpuCard stats={stats?.cpu ?? null} history={history} />
        <RamCard stats={stats?.ram ?? null} history={history} />
        <GpuCard
          stats={stats?.gpu}
          history={history}
          isAvailable={stats?.gpu !== undefined}
        />
      </div>

      {/* Middle Row: Performance Chart */}
      <PerformanceChart
        history={history}
        hasGpu={stats?.gpu !== undefined}
      />

      {/* Bottom Row: System Info + Top Processes */}
      <div className="grid gap-4 md:grid-cols-2">
        <SystemInfoCard info={stats?.system_info ?? null} />
        <TopProcessesCard processes={stats?.processes ?? []} />
      </div>

      {/* Footer */}
      {stats && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-xs text-muted-foreground pt-2"
        >
          Last updated:{" "}
          {new Date(stats.timestamp).toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </motion.div>
      )}
    </div>
  );
}

// Default export for easier imports
export default Dashboard;
