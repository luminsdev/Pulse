import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Activity, Wifi, WifiOff, Minimize2 } from "lucide-react";
import { CardErrorBoundary } from "@/components/common/CardErrorBoundary";
import { toggleMiniMode } from "@/lib/tauri";
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
    <div className="space-y-4 p-2 sm:p-4 bg-[#030303] text-[#e2e8f0] min-h-screen scrollbar-thin">
      {/* Header with Connection Status */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-between gap-3 border-b border-[#151515] pb-3"
      >
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm font-semibold tracking-widest font-mono text-white">
            PULSE TELEMETRY SYSTEM v2.0
          </h1>
          <button
            type="button"
            onClick={() => toggleMiniMode().catch(console.error)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#8a8a8a] transition-colors hover:bg-[#1a1a1a] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3b82f6]"
            aria-label="Switch to Mini Mode"
            title="Switch to Mini Mode"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          {isConnected ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-500 uppercase tracking-wider hidden xs:inline">Live</span>
              <Activity className="h-2.5 w-2.5 animate-pulse text-emerald-500" />
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-[#8a8a8a]" />
              <span className="text-[#8a8a8a] uppercase tracking-wider">Connecting...</span>
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

      {/* Integrated Console Grid with hairline borders */}
      <div className="console-grid">
        {/* CPU Cell */}
        <div className="grid-cell col-span-12 md:col-span-4">
          <CardErrorBoundary>
            <CpuCard stats={stats?.cpu ?? null} temperatureStatus={sidecarStatus?.status} />
          </CardErrorBoundary>
        </div>

        {/* RAM Cell */}
        <div className="grid-cell col-span-12 md:col-span-4">
          <CardErrorBoundary>
            <RamCard stats={stats?.ram ?? null} />
          </CardErrorBoundary>
        </div>

        {/* GPU Cell */}
        <div className="grid-cell col-span-12 md:col-span-4">
          <CardErrorBoundary>
            <GpuCard
              stats={stats ? stats.gpu : null}
              isAvailable={stats ? stats.gpu != null : true}
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

        {/* Oscilloscope Chart Cell */}
        <div className="grid-cell col-span-12">
          <PerformanceChart
            history={history}
            hasGpu={stats?.gpu != null}
          />
        </div>

        {/* System Info Table Cell */}
        <div className="grid-cell col-span-12 lg:col-span-6">
          <SystemInfoCard info={systemInfo} />
        </div>

        {/* Processes Cell */}
        <div className="grid-cell col-span-12 lg:col-span-6">
          <TopProcessesCard processes={processes} />
        </div>

        {/* Diagnostics Cell */}
        <div className="grid-cell col-span-12">
          <CardErrorBoundary>
            <TelemetryDiagnosticsCard diagnostics={telemetryDiagnostics} />
          </CardErrorBoundary>
        </div>
      </div>

      {/* Footer */}
      {stats && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-[10px] text-muted-foreground pt-2 font-mono"
        >
          [LAST TELEMETRY REFRESH:{" "}
          {new Date(stats.timestamp).toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
          ]
        </motion.div>
      )}
    </div>
  );
}

// Default export for easier imports
export default Dashboard;
