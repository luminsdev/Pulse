import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { CardErrorBoundary } from "@/components/common/CardErrorBoundary";
import { useSystemStats } from "./hooks/useSystemStats";
import { useSystemInfo } from "./hooks/useSystemInfo";
import { useProcessList } from "./hooks/useProcessList";
import { useSidecarStatus } from "./hooks/useSidecarStatus";
import { useFpsStats } from "./hooks/useFpsStats";
import { useTelemetryDiagnostics } from "./hooks/useTelemetryDiagnostics";
import {
  CpuCard,
  RamCard,
  GpuCard,
  SystemInfoCard,
  TopProcessesCard,
  PerformanceChart,
  SidecarWarning,
  TelemetryDiagnosticsCard,
} from "./components";

/**
 * Main Dashboard component
 * Displays realtime system metrics in a professional grid layout
 */
export function Dashboard() {
  const { stats, history, isConnected } = useSystemStats();
  const { info: systemInfo } = useSystemInfo();
  const { processes } = useProcessList();
  const {
    status: sidecarStatus,
    message: sidecarMessage,
    showWarning,
    isStarting: isSensorStarting,
    retryMonitoring: retrySensorMonitoring,
  } = useSidecarStatus();
  const {
    data: fpsData,
    status: fpsStatus,
    errorMessage: fpsErrorMessage,
    presentMonInstalled,
    isStarting: isFpsStarting,
    isStopping: isFpsStopping,
    startMonitoring: startFpsMonitoring,
    stopMonitoring: stopFpsMonitoring,
  } = useFpsStats();
  const telemetryDiagnostics = useTelemetryDiagnostics();
  const [warningDismissed, setWarningDismissed] = useState(false);

  const handleDismissWarning = useCallback(() => {
    setWarningDismissed(true);
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 scrollbar-thin">
      {/* Header with Connection Status */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-between"
      >
        <h1 className="text-lg sm:text-xl font-semibold">Hardware Monitor</h1>
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          {isConnected ? (
            <>
              <Wifi className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
              <span className="text-muted-foreground hidden xs:inline">Live</span>
              <Activity className="h-2.5 w-2.5 sm:h-3 sm:w-3 animate-pulse text-emerald-500" />
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Connecting...</span>
            </>
          )}
        </div>
      </motion.div>

      {/* Sidecar Warning Banner */}
      <SidecarWarning
        status={sidecarStatus}
        message={sidecarMessage}
        show={showWarning && !warningDismissed}
        onDismiss={handleDismissWarning}
        onRetry={retrySensorMonitoring}
        isRetrying={isSensorStarting}
      />

      {/* Top Row: Hardware Cards - Responsive grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <CardErrorBoundary>
          <CpuCard stats={stats?.cpu ?? null} history={history} />
        </CardErrorBoundary>
        <CardErrorBoundary>
          <RamCard stats={stats?.ram ?? null} history={history} />
        </CardErrorBoundary>
        <CardErrorBoundary>
          <GpuCard
            stats={stats?.gpu}
            history={history}
            isAvailable={stats?.gpu != null}
            fpsData={fpsData}
            fpsStatus={fpsStatus}
            fpsErrorMessage={fpsErrorMessage}
            presentMonInstalled={presentMonInstalled}
            isFpsStarting={isFpsStarting}
            isFpsStopping={isFpsStopping}
            onStartFpsMonitoring={startFpsMonitoring}
            onStopFpsMonitoring={stopFpsMonitoring}
          />
        </CardErrorBoundary>
      </div>

      {/* Middle Row: Performance Chart */}
      <PerformanceChart
        history={history}
        hasGpu={stats?.gpu != null}
      />

      {/* Bottom Row: System Info + Top Processes - Stack on mobile */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
        <SystemInfoCard info={systemInfo} />
        <TopProcessesCard processes={processes} />
      </div>

      <CardErrorBoundary>
        <TelemetryDiagnosticsCard diagnostics={telemetryDiagnostics} />
      </CardErrorBoundary>

      {/* Footer */}
      {stats && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-[10px] sm:text-xs text-muted-foreground pt-2"
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
