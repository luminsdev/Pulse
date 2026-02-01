import { useMemo } from "react";
import { Cpu, Thermometer, Activity } from "lucide-react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SystemChart, CircularProgress, type ChartDataPoint } from "@/components/charts";
import { formatFrequency, formatTemperature, formatPercent } from "@/lib/utils";
import type { CpuStats } from "@/types/stats";
import type { StatsHistoryPoint } from "../hooks/useSystemStats";

interface CpuCardProps {
  /** Current CPU stats */
  stats: CpuStats | null;
  /** History data for chart */
  history: StatsHistoryPoint[];
}

/**
 * CPU monitoring card with realtime chart and metrics
 */
export function CpuCard({ stats, history }: CpuCardProps) {
  // Prepare chart data
  const chartData: ChartDataPoint[] = useMemo(() => {
    return history.map((point) => ({
      timestamp: point.timestamp,
      value: point.cpuUsage,
    }));
  }, [history]);

  // Loading state
  if (!stats) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4" />
            CPU
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
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden">
        {/* Header */}
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="h-4 w-4 text-primary" />
                CPU
              </CardTitle>
              <CardDescription className="mt-1 text-xs truncate max-w-[200px]">
                {stats.name}
              </CardDescription>
            </div>
            <CircularProgress
              value={stats.usage}
              size={56}
              strokeWidth={5}
              color="hsl(217.2 91.2% 59.8%)"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* Cores */}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Cores</span>
              <p className="font-medium">
                {stats.cores}C / {stats.logical_cores}T
              </p>
            </div>

            {/* Frequency */}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Frequency</span>
              <p className="font-medium">{formatFrequency(stats.frequency)}</p>
            </div>

            {/* Temperature */}
            <div className="space-y-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Thermometer className="h-3 w-3" />
                Temperature
              </span>
              <p className="font-medium">
                {stats.temperature != null
                  ? formatTemperature(stats.temperature)
                  : "N/A"}
              </p>
            </div>

            {/* Usage */}
            <div className="space-y-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Activity className="h-3 w-3" />
                Usage
              </span>
              <p className="font-medium">{formatPercent(stats.usage)}</p>
            </div>
          </div>

          {/* Per-Core Usage (compact view) */}
          {stats.per_core_usage.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">
                Core Usage ({stats.per_core_usage.length} threads)
              </span>
              <div className="flex flex-wrap gap-1">
                {stats.per_core_usage.slice(0, 16).map((usage, index) => (
                  <div
                    key={index}
                    className="h-2 w-2 rounded-sm transition-colors"
                    style={{
                      backgroundColor:
                        usage >= 90
                          ? "hsl(var(--destructive))"
                          : usage >= 70
                          ? "hsl(38 92% 50%)"
                          : usage >= 30
                          ? "hsl(217.2 91.2% 59.8%)"
                          : "hsl(var(--muted))",
                    }}
                    title={`Thread ${index + 1}: ${usage.toFixed(1)}%`}
                  />
                ))}
                {stats.per_core_usage.length > 16 && (
                  <span className="text-xs text-muted-foreground ml-1">
                    +{stats.per_core_usage.length - 16}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Realtime Chart */}
          <div className="pt-2">
            <SystemChart
              data={chartData}
              color="hsl(217.2 91.2% 59.8%)"
              height={60}
              label="CPU Usage"
              gradientId="cpuChart"
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
