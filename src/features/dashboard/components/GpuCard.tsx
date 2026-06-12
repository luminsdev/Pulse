import { useMemo } from "react";
import { MonitorSpeaker, Thermometer, Fan, Gauge, Zap, Clock, Gamepad2, Timer, TrendingDown, AlertCircle, Download, Play, Square } from "lucide-react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SystemChart, CircularProgress, ProgressBar, type ChartDataPoint } from "@/components/charts";
import {
  formatBytes,
  formatPercent,
  formatTemperature,
  formatPower,
  formatClock,
  getTemperatureColor,
} from "@/lib/utils";
import type { GpuStats, FpsData, FpsSidecarStatusType } from "@/types/stats";
import type { StatsHistoryPoint } from "../hooks/useSystemStats";
import { getFpsColor, getFpsColorClass, formatFps, formatFrameTime } from "../hooks/useFpsStats";

interface GpuCardProps {
  /** Current GPU stats (null if no GPU detected) */
  stats: GpuStats | null | undefined;
  /** History data for chart */
  history: StatsHistoryPoint[];
  /** Whether GPU support is available */
  isAvailable?: boolean;
  /** FPS data from PresentMon */
  fpsData?: FpsData | null;
  /** FPS monitoring status */
  fpsStatus?: FpsSidecarStatusType;
  /** FPS error message from backend */
  fpsErrorMessage?: string | null;
  /** Whether PresentMon is installed */
  presentMonInstalled?: boolean;
  /** Whether a start command is in flight */
  isFpsStarting?: boolean;
  /** Whether a stop command is in flight */
  isFpsStopping?: boolean;
  /** Start FPS monitoring */
  onStartFpsMonitoring?: () => Promise<void>;
  /** Stop FPS monitoring */
  onStopFpsMonitoring?: () => Promise<void>;
}

/**
 * GPU monitoring card with realtime chart and metrics
 * Shows a placeholder if no GPU is detected
 */
export function GpuCard({ 
  stats, 
  history, 
  isAvailable = true,
  fpsData,
  fpsStatus = "not_started",
  fpsErrorMessage,
  presentMonInstalled = true,
  isFpsStarting = false,
  isFpsStopping = false,
  onStartFpsMonitoring,
  onStopFpsMonitoring,
}: GpuCardProps) {
  // Prepare chart data
  const chartData: ChartDataPoint[] = useMemo(() => {
    return history.map((point) => ({
      timestamp: point.timestamp,
      value: point.gpuUsage,
    }));
  }, [history]);

  // Calculate VRAM usage percentage
  const vramUsagePercent = useMemo(() => {
    if (!stats || stats.memory_total === 0) return 0;
    return (stats.memory_used / stats.memory_total) * 100;
  }, [stats]);

  // Get temperature color info
  const tempColor = useMemo(
    () => getTemperatureColor(stats?.temperature, "gpu"),
    [stats?.temperature]
  );

  // Get hot spot temperature color
  const hotSpotColor = useMemo(
    () => getTemperatureColor(stats?.hot_spot_temperature, "gpu"),
    [stats?.hot_spot_temperature]
  );

  // No GPU available
  if (!isAvailable || stats === undefined) {
    return (
      <Card className="relative overflow-hidden opacity-60">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MonitorSpeaker className="h-4 w-4" />
            GPU
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
            <MonitorSpeaker className="mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">No GPU detected</p>
            <p className="text-xs">NVIDIA GPU required</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (!stats) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MonitorSpeaker className="h-4 w-4" />
            GPU
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            Waiting for data...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/5 hover:border-orange-500/20 cursor-default">
        {/* Header */}
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <MonitorSpeaker className="h-4 w-4 text-orange-500" />
                GPU
              </CardTitle>
              <CardDescription className="mt-1 text-xs truncate max-w-[200px]">
                {stats.name}
              </CardDescription>
            </div>
            <CircularProgress
              value={stats.usage}
              size={56}
              strokeWidth={5}
              color="hsl(25 95% 53%)"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* VRAM Usage Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VRAM</span>
              <span className="font-medium">
                {formatBytes(stats.memory_used)} / {formatBytes(stats.memory_total)}
              </span>
            </div>
            <ProgressBar
              value={vramUsagePercent}
              color="hsl(25 95% 53%)"
              height={8}
            />
          </div>

          {/* Stats Grid - First Row */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* Temperature with color coding */}
            <div className="space-y-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Thermometer className="h-3 w-3" />
                Temperature
              </span>
              <p className={`font-medium ${tempColor.textColor}`}>
                {stats.temperature != null
                  ? formatTemperature(stats.temperature)
                  : "N/A"}
              </p>
            </div>

            {/* Hot Spot Temperature */}
            <div className="space-y-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Thermometer className="h-3 w-3" />
                Hot Spot
              </span>
              <p className={`font-medium ${hotSpotColor.textColor}`}>
                {stats.hot_spot_temperature != null
                  ? formatTemperature(stats.hot_spot_temperature)
                  : "N/A"}
              </p>
            </div>

            {/* Power consumption */}
            <div className="space-y-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Zap className="h-3 w-3" />
                Power
              </span>
              <p className="font-medium">
                {stats.power != null ? formatPower(stats.power) : "N/A"}
              </p>
            </div>

            {/* Fan Speed */}
            <div className="space-y-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Fan className="h-3 w-3" />
                Fan Speed
              </span>
              <p className="font-medium">
                {stats.fan_speed != null
                  ? formatPercent(stats.fan_speed)
                  : "N/A"}
              </p>
            </div>
          </div>

          {/* Stats Grid - Second Row (Clocks) */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* Core Clock */}
            <div className="space-y-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Core Clock
              </span>
              <p className="font-medium">
                {stats.core_clock != null
                  ? formatClock(stats.core_clock)
                  : "N/A"}
              </p>
            </div>

            {/* Memory Clock */}
            <div className="space-y-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Mem Clock
              </span>
              <p className="font-medium">
                {stats.memory_clock != null
                  ? formatClock(stats.memory_clock)
                  : "N/A"}
              </p>
            </div>
          </div>

          {/* FPS Section */}
          <FpsSection 
            fpsData={fpsData}
            fpsStatus={fpsStatus}
            fpsErrorMessage={fpsErrorMessage}
            presentMonInstalled={presentMonInstalled}
            isStarting={isFpsStarting}
            isStopping={isFpsStopping}
            onStartMonitoring={onStartFpsMonitoring}
            onStopMonitoring={onStopFpsMonitoring}
          />

          {/* Usage indicator */}
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Gauge className="h-3 w-3" />
              GPU Load
            </span>
            <p className="font-medium">{formatPercent(stats.usage)}</p>
          </div>

          {/* Realtime Chart */}
          <div className="pt-2">
            <SystemChart
              data={chartData}
              color="hsl(25 95% 53%)"
              height={60}
              label="GPU Usage"
              gradientId="gpuChart"
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** FPS Section Props */
interface FpsSectionProps {
  fpsData?: FpsData | null;
  fpsStatus: FpsSidecarStatusType;
  fpsErrorMessage?: string | null;
  presentMonInstalled: boolean;
  isStarting: boolean;
  isStopping: boolean;
  onStartMonitoring?: () => Promise<void>;
  onStopMonitoring?: () => Promise<void>;
}

function FpsSectionHeader({
  active,
  onStartMonitoring,
  onStopMonitoring,
  isStarting,
  isStopping,
}: {
  active: boolean;
  onStartMonitoring?: () => Promise<void>;
  onStopMonitoring?: () => Promise<void>;
  isStarting: boolean;
  isStopping: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-2">
        <Gamepad2 className={`h-4 w-4 ${active ? "text-emerald-500" : "text-muted-foreground"}`} />
        <span className="text-muted-foreground font-medium">FPS Monitoring</span>
      </div>
      {active ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          disabled={isStopping || !onStopMonitoring}
          onClick={() => void onStopMonitoring?.()}
        >
          <Square className="h-3 w-3" />
          {isStopping ? "Stopping" : "Stop"}
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 px-2 text-[11px]"
          disabled={isStarting || !onStartMonitoring}
          onClick={() => void onStartMonitoring?.()}
        >
          <Play className="h-3 w-3" />
          {isStarting ? "Starting" : "Start"}
        </Button>
      )}
    </div>
  );
}

/** 
 * FPS monitoring section within GPU card 
 * Shows current FPS, frame time, and low percentiles
 */
function FpsSection({
  fpsData,
  fpsStatus,
  fpsErrorMessage,
  presentMonInstalled,
  isStarting,
  isStopping,
  onStartMonitoring,
  onStopMonitoring,
}: FpsSectionProps) {
  const isMonitoring = fpsStatus === "running" || fpsStatus === "no_game";

  // PresentMon not installed - show install prompt
  if (!presentMonInstalled || fpsStatus === "not_installed") {
    return (
      <div className="pt-3 border-t border-border/50">
        <FpsSectionHeader
          active={false}
          isStarting={isStarting}
          isStopping={isStopping}
          onStartMonitoring={onStartMonitoring}
          onStopMonitoring={onStopMonitoring}
        />
        <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border/50">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                PresentMon is required for FPS monitoring
              </p>
              <a
                href="https://github.com/GameTechDev/PresentMon/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 transition-colors"
              >
                <Download className="h-3 w-3" />
                Download PresentMon
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No game detected
  if (fpsStatus === "no_game" || (fpsStatus === "running" && !fpsData)) {
    return (
      <div className="pt-3 border-t border-border/50">
        <FpsSectionHeader
          active={isMonitoring}
          isStarting={isStarting}
          isStopping={isStopping}
          onStartMonitoring={onStartMonitoring}
          onStopMonitoring={onStopMonitoring}
        />
        <div className="mt-2 flex items-center justify-center py-4 text-muted-foreground">
          <div className="text-center">
            <Gamepad2 className="h-6 w-6 mx-auto mb-1 opacity-50" />
            <p className="text-xs">No game detected</p>
            <p className="text-[10px] opacity-70">Start a game to see FPS stats</p>
          </div>
        </div>
      </div>
    );
  }

  // Not started or stopped
  if (fpsStatus === "not_started" || fpsStatus === "stopped") {
    return (
      <div className="pt-3 border-t border-border/50">
        <FpsSectionHeader
          active={false}
          isStarting={isStarting}
          isStopping={isStopping}
          onStartMonitoring={onStartMonitoring}
          onStopMonitoring={onStopMonitoring}
        />
        <div className="mt-2 flex items-center justify-center py-3 text-muted-foreground">
          <p className="text-xs">
            {fpsStatus === "not_started"
              ? "Start FPS monitoring when you need game telemetry"
              : "FPS monitoring stopped"}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (fpsStatus === "error") {
    const isAdminError = fpsErrorMessage?.includes("administrator") || fpsErrorMessage?.includes("admin");
    return (
      <div className="pt-3 border-t border-border/50">
        <FpsSectionHeader
          active={false}
          isStarting={isStarting}
          isStopping={isStopping}
          onStartMonitoring={onStartMonitoring}
          onStopMonitoring={onStopMonitoring}
        />
        <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs text-amber-200/90">
                {isAdminError
                  ? "Run Pulse as Administrator to enable FPS tracking"
                  : fpsErrorMessage || "Error reading FPS data"}
              </p>
              {isAdminError && (
                <p className="text-[10px] text-muted-foreground">
                  Or add your user to the "Performance Log Users" group
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active with FPS data
  if (fpsData) {
    const fpsColor = getFpsColor(fpsData.fps);
    const fpsColorClass = getFpsColorClass(fpsData.fps);
    
    return (
      <div className="pt-3 border-t border-border/50">
        {/* Header with game name */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Gamepad2 className="h-4 w-4" style={{ color: fpsColor }} />
            <span className="text-muted-foreground font-medium">FPS</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            disabled={isStopping || !onStopMonitoring}
            onClick={() => void onStopMonitoring?.()}
          >
            <Square className="h-3 w-3" />
            {isStopping ? "Stopping" : "Stop"}
          </Button>
          <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
            {fpsData.process_name}
          </span>
        </div>

        {/* Main FPS display */}
        <div className="mt-2 flex items-center justify-center">
          <div className="text-center">
            <span className={`text-3xl font-bold tabular-nums ${fpsColorClass}`}>
              {formatFps(fpsData.fps)}
            </span>
            <span className="text-sm text-muted-foreground ml-1">FPS</span>
          </div>
        </div>

        {/* FPS metrics grid */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          {/* Frame Time */}
          <div className="space-y-0.5 text-center">
            <span className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
              <Timer className="h-2.5 w-2.5" />
              Frame Time
            </span>
            <p className="font-medium text-xs tabular-nums">
              {formatFrameTime(fpsData.frame_time)}
            </p>
          </div>

          {/* 1% Low */}
          <div className="space-y-0.5 text-center">
            <span className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
              <TrendingDown className="h-2.5 w-2.5" />
              1% Low
            </span>
            <p className="font-medium text-xs tabular-nums">
              {formatFps(fpsData.fps_1_percent_low)}
            </p>
          </div>

          {/* 0.1% Low */}
          <div className="space-y-0.5 text-center">
            <span className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
              <TrendingDown className="h-2.5 w-2.5" />
              0.1% Low
            </span>
            <p className="font-medium text-xs tabular-nums">
              {formatFps(fpsData.fps_01_percent_low)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
