import { useMemo } from "react";
import { MemoryStick, HardDrive } from "lucide-react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SystemChart, CircularProgress, ProgressBar, type ChartDataPoint } from "@/components/charts";
import { formatBytes, formatPercent } from "@/lib/utils";
import type { RamStats } from "@/types/stats";
import type { StatsHistoryPoint } from "../hooks/useSystemStats";

interface RamCardProps {
  /** Current RAM stats */
  stats: RamStats | null;
  /** History data for chart */
  history: StatsHistoryPoint[];
}

/**
 * RAM/Memory monitoring card with realtime chart and metrics
 */
export function RamCard({ stats, history }: RamCardProps) {
  // Prepare chart data
  const chartData: ChartDataPoint[] = useMemo(() => {
    return history.map((point) => ({
      timestamp: point.timestamp,
      value: point.ramUsage,
    }));
  }, [history]);

  // Loading state
  if (!stats) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MemoryStick className="h-4 w-4" />
            Memory
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
      transition={{ duration: 0.3, delay: 0.05 }}
    >
      <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/5 hover:border-emerald-500/20 cursor-default">
        {/* Header */}
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <MemoryStick className="h-4 w-4 text-emerald-500" />
                Memory
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                {formatBytes(stats.total)} Total
              </CardDescription>
            </div>
            <CircularProgress
              value={stats.usage_percent}
              size={56}
              strokeWidth={5}
              color="hsl(152 69% 45%)"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Memory Usage Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Used</span>
              <span className="font-medium">
                {formatBytes(stats.used)} / {formatBytes(stats.total)}
              </span>
            </div>
            <ProgressBar
              value={stats.usage_percent}
              color="hsl(152 69% 45%)"
              height={10}
            />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* Used */}
            <div className="space-y-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <HardDrive className="h-3 w-3" />
                Used
              </span>
              <p className="font-medium">{formatBytes(stats.used)}</p>
            </div>

            {/* Available */}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Available</span>
              <p className="font-medium">{formatBytes(stats.available)}</p>
            </div>

            {/* Usage Percent */}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Usage</span>
              <p className="font-medium">{formatPercent(stats.usage_percent)}</p>
            </div>

            {/* Free */}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Free</span>
              <p className="font-medium">
                {formatPercent(100 - stats.usage_percent)}
              </p>
            </div>
          </div>

          {/* Realtime Chart */}
          <div className="pt-2">
            <SystemChart
              data={chartData}
              color="hsl(152 69% 45%)"
              height={60}
              label="RAM Usage"
              gradientId="ramChart"
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
