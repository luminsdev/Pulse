import { useMemo } from "react";
import { MonitorSpeaker, Thermometer, Fan, Gauge, Zap, Clock } from "lucide-react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SystemChart, CircularProgress, ProgressBar, type ChartDataPoint } from "@/components/charts";
import {
  formatBytes,
  formatPercent,
  formatTemperature,
  formatPower,
  formatClock,
  getTemperatureColor,
} from "@/lib/utils";
import type { GpuStats } from "@/types/stats";
import type { StatsHistoryPoint } from "../hooks/useSystemStats";

interface GpuCardProps {
  /** Current GPU stats (null if no GPU detected) */
  stats: GpuStats | null | undefined;
  /** History data for chart */
  history: StatsHistoryPoint[];
  /** Whether GPU support is available */
  isAvailable?: boolean;
}

/**
 * GPU monitoring card with realtime chart and metrics
 * Shows a placeholder if no GPU is detected
 */
export function GpuCard({ stats, history, isAvailable = true }: GpuCardProps) {
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
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <Card className="relative overflow-hidden">
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
