import { useMemo } from "react";
import { MonitorSpeaker, Gamepad2, Timer, TrendingDown, AlertCircle, Download, Play, Square } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LedVuMeter } from "@/components/charts";
import { SkeletonLoader } from "@/components/common/SkeletonLoader";
import {
  formatBytes,
  formatPercent,
  formatTemperature,
  formatPower,
  formatClock,
  getTemperatureColor,
  formatHardwareName,
} from "@/lib/utils";
import type { GpuStats, FpsData, FpsSidecarStatusType } from "@/types/stats";
import { getFpsColor, formatFps, formatFrameTime } from "../hooks/useFpsStats";

interface GpuCardProps {
  /** Current GPU stats (null if no GPU detected) */
  stats: GpuStats | null | undefined;
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
 * GPU monitoring cell for Precision Telemetry Console
 */
export function GpuCard({ 
  stats, 
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
  // Calculate VRAM usage percentage
  const vramUsagePercent = useMemo(() => {
    if (!stats || stats.memory_total === 0) return 0;
    const usage = (stats.memory_used / stats.memory_total) * 100;
    return Number.isFinite(usage) ? Math.min(Math.max(usage, 0), 100) : 0;
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
      <div className="flex h-32 flex-col items-center justify-center font-mono text-xs text-muted-foreground opacity-60">
        <MonitorSpeaker className="mb-1 h-6 w-6 opacity-40" />
        <p>[NO GPU DETECTED]</p>
        <p className="text-[10px] opacity-60">NVIDIA GPU REQUIRED</p>
      </div>
    );
  }

  // Loading state
  if (!stats) {
    return <SkeletonLoader label="GPU DETECTING / WAITING TELEMETRY..." lines={4} />;
  }

  // Semantic Alerting
  const isAlert = stats.usage >= 90 || (stats.temperature ?? 0) >= 85 || (stats.hot_spot_temperature ?? 0) >= 95;
  const accentColor = isAlert ? "text-red-500" : "text-orange-500";
  const pulseClass = isAlert ? "animate-pulse" : "";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className={`flex items-center gap-2 ${pulseClass}`}>
        <MonitorSpeaker className={`h-4 w-4 ${accentColor}`} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#a3a3a3]">
          03 █ GRAPHICS (GPU)
        </span>
      </div>

      {/* Hardware Name */}
      <div className="text-sm font-bold text-white tracking-wide font-mono truncate border-b border-[#151515] pb-2" title={stats.name}>
        {formatHardwareName(stats.name)}
      </div>

      {/* Large Stat Display */}
      <div className="flex items-baseline gap-1">
        <span className="text-4xl font-bold font-mono tracking-tight text-white tabular-nums">
          {stats.usage.toFixed(1)}
        </span>
        <span className="text-sm font-semibold text-[#737373] font-mono">%</span>
      </div>

      {/* VRAM Progress Line */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] font-mono text-[#8a8a8a]">
          <span>VRAM USAGE</span>
          <span className="text-[#bbb]">
            {formatBytes(stats.memory_used)} / {formatBytes(stats.memory_total)}
          </span>
        </div>
        <div className="h-2 bg-[#0d0d0d] border border-[#1a1a1a] p-[0.5px] rounded-sm">
          <motion.div
            className="h-full bg-orange-500 rounded-sm"
            animate={{ width: `${vramUsagePercent}%` }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          />
        </div>
      </div>

      {/* Segmented LED VU Meter */}
      <LedVuMeter value={stats.usage} label="GPU load" />

      {/* Stats Table Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-mono">
        <div className="flex justify-between border-b border-[#151515] pb-1">
          <span className="text-[#8a8a8a] uppercase">TEMP</span>
          <span className={`${tempColor.textColor} font-medium`}>
            {stats.temperature != null ? formatTemperature(stats.temperature) : "N/A"}
          </span>
        </div>
        <div className="flex justify-between border-b border-[#151515] pb-1">
          <span className="text-[#8a8a8a] uppercase">HOT SPOT</span>
          <span className={`${hotSpotColor.textColor} font-medium`}>
            {stats.hot_spot_temperature != null
              ? formatTemperature(stats.hot_spot_temperature)
              : "N/A"}
          </span>
        </div>
        <div className="flex justify-between border-b border-[#151515] pb-1">
          <span className="text-[#8a8a8a] uppercase">POWER</span>
          <span className="text-[#bbb] font-medium">
            {stats.power != null ? formatPower(stats.power) : "N/A"}
          </span>
        </div>
        <div className="flex justify-between border-b border-[#151515] pb-1">
          <span className="text-[#8a8a8a] uppercase">FAN SPEED</span>
          <span className="text-[#bbb] font-medium">
            {stats.fan_speed != null ? formatPercent(stats.fan_speed) : "N/A"}
          </span>
        </div>
        <div className="flex justify-between border-b border-[#151515] pb-1">
          <span className="text-[#8a8a8a] uppercase">CORE CLK</span>
          <span className="text-[#bbb] font-medium">
            {stats.core_clock != null ? formatClock(stats.core_clock) : "N/A"}
          </span>
        </div>
        <div className="flex justify-between border-b border-[#151515] pb-1">
          <span className="text-[#8a8a8a] uppercase">MEM CLK</span>
          <span className="text-[#bbb] font-medium">
            {stats.memory_clock != null ? formatClock(stats.memory_clock) : "N/A"}
          </span>
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
    <div className="flex items-center justify-between gap-2 text-xs font-mono">
      <div className="flex items-center gap-2">
        <Gamepad2 className={`h-4 w-4 ${active ? "text-emerald-500" : "text-[#8a8a8a]"}`} />
        <span className="text-[#8a8a8a] font-bold uppercase tracking-widest">FPS HUD</span>
      </div>
      {active ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] font-mono hover:bg-[#1a1a1a] hover:text-white text-muted-foreground border border-[#222]"
          disabled={isStopping || !onStopMonitoring}
          onClick={() => void onStopMonitoring?.()}
        >
          <Square className="h-2.5 w-2.5 mr-1" />
          {isStopping ? "STOPPING" : "STOP CAPTURE"}
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-6 px-2 text-[10px] font-mono bg-[#111] hover:bg-[#222] text-[#bbb] border border-[#222]"
          disabled={isStarting || !onStartMonitoring}
          onClick={() => void onStartMonitoring?.()}
        >
          <Play className="h-2.5 w-2.5 mr-1" />
          {isStarting ? "STARTING" : "RUN CAPTURE"}
        </Button>
      )}
    </div>
  );
}

/** 
 * FPS monitoring section within GPU cell
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
      <div className="pt-3 border-t border-[#151515]">
        <FpsSectionHeader
          active={false}
          isStarting={isStarting}
          isStopping={isStopping}
          onStartMonitoring={onStartMonitoring}
          onStopMonitoring={onStopMonitoring}
        />
        <div className="mt-2 p-2 rounded-sm bg-[#110505] border border-red-950 text-[10px] font-mono">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-red-400">PRESENTMON IS REQUIRED FOR GAME FPS STATS</p>
              <a
                href="https://github.com/GameTechDev/PresentMon/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Download className="h-3 w-3" />
                GET PRESENTMON (GITHUB)
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
      <div className="pt-3 border-t border-[#151515]">
        <FpsSectionHeader
          active={isMonitoring}
          isStarting={isStarting}
          isStopping={isStopping}
          onStartMonitoring={onStartMonitoring}
          onStopMonitoring={onStopMonitoring}
        />
        <div className="mt-2 flex items-center justify-center py-4 bg-[#0a0a0a] border border-[#111] rounded-sm font-mono text-[10px] text-muted-foreground text-center">
          <div>
            <Gamepad2 className="h-5 w-5 mx-auto mb-1 opacity-20" />
            <p>[WAITING FOR GAME PROCESS...]</p>
            <p className="text-[9px] opacity-60">LAUNCH A GAME TO STREAM FPS</p>
          </div>
        </div>
      </div>
    );
  }

  // Not started or stopped
  if (fpsStatus === "not_started" || fpsStatus === "stopped") {
    return (
      <div className="pt-3 border-t border-[#151515]">
        <FpsSectionHeader
          active={false}
          isStarting={isStarting}
          isStopping={isStopping}
          onStartMonitoring={onStartMonitoring}
          onStopMonitoring={onStopMonitoring}
        />
        <div className="mt-2 flex items-center justify-center py-3 bg-[#0a0a0a] border border-[#111] rounded-sm font-mono text-[10px] text-muted-foreground text-center">
          <p>
            {fpsStatus === "not_started"
              ? "HUD SERVICE IDLE"
              : "FPS SERVICE STOPPED"}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (fpsStatus === "error") {
    const normalizedErrorMessage = fpsErrorMessage?.toLowerCase();
    const isAdminError =
      normalizedErrorMessage?.includes("administrator") ||
      normalizedErrorMessage?.includes("admin");
    return (
      <div className="pt-3 border-t border-[#151515]">
        <FpsSectionHeader
          active={false}
          isStarting={isStarting}
          isStopping={isStopping}
          onStartMonitoring={onStartMonitoring}
          onStopMonitoring={onStopMonitoring}
        />
        <div className="mt-2 p-2 rounded-sm bg-[#110505] border border-red-950 text-[10px] font-mono">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-red-400">
                {isAdminError
                  ? "RUN PULSE AS ADMINISTRATOR TO ENABLE FPS TRACKING"
                  : fpsErrorMessage?.toUpperCase() || "ERROR CAPTURING FPS DATA"}
              </p>
              {isAdminError && (
                <p className="text-[9px] text-[#8a8a8a]">
                  OR ADD USER TO "PERFORMANCE LOG USERS" GROUP
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
    
    return (
      <div className="pt-3 border-t border-[#151515] space-y-2">
        {/* Header with game name */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-mono">
            <Gamepad2 className="h-4 w-4" style={{ color: fpsColor }} />
            <span className="text-[#8a8a8a] font-bold uppercase tracking-widest">FPS HUD</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] font-mono hover:bg-[#1a1a1a] hover:text-white text-muted-foreground border border-[#222]"
            disabled={isStopping || !onStopMonitoring}
            onClick={() => void onStopMonitoring?.()}
          >
            <Square className="h-2.5 w-2.5 mr-1" />
            {isStopping ? "STOPPING" : "STOP CAPTURE"}
          </Button>
        </div>

        {/* Process title tag */}
        <div className="text-[9px] font-mono text-[#8b5cf6] bg-[#8b5cf6]/5 border border-[#8b5cf6]/10 px-1.5 py-0.5 rounded-sm inline-block max-w-full truncate">
          TARGET: {fpsData.process_name.toUpperCase()}
        </div>

        {/* Main FPS display */}
        <div className="flex items-baseline justify-center gap-1.5 py-1">
          <span
            className="text-4xl font-extrabold font-mono tracking-tight tabular-nums"
            style={{ color: fpsColor }}
          >
            {formatFps(fpsData.fps)}
          </span>
          <span className="text-xs font-bold font-mono opacity-50" style={{ color: fpsColor }}>FPS</span>
        </div>

        {/* FPS metrics grid */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono border-t border-[#111] pt-2">
          {/* Frame Time */}
          <div className="space-y-0.5">
            <span className="flex items-center justify-center gap-1 text-[9px] text-[#8a8a8a] uppercase tracking-wider font-semibold">
              <Timer className="h-2.5 w-2.5" />
              FR-TIME
            </span>
            <p className="font-bold text-white tabular-nums">
              {formatFrameTime(fpsData.frame_time)}
            </p>
          </div>

          {/* 1% Low */}
          <div className="space-y-0.5">
            <span className="flex items-center justify-center gap-1 text-[9px] text-[#8a8a8a] uppercase tracking-wider font-semibold">
              <TrendingDown className="h-2.5 w-2.5" />
              1% LOW
            </span>
            <p className="font-bold text-white tabular-nums">
              {formatFps(fpsData.fps_1_percent_low)}
            </p>
          </div>

          {/* 0.1% Low */}
          <div className="space-y-0.5">
            <span className="flex items-center justify-center gap-1 text-[9px] text-[#8a8a8a] uppercase tracking-wider font-semibold">
              <TrendingDown className="h-2.5 w-2.5" />
              0.1% LOW
            </span>
            <p className="font-bold text-white tabular-nums">
              {formatFps(fpsData.fps_01_percent_low)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
