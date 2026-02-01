import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { StatsHistoryPoint } from "../hooks/useSystemStats";

interface PerformanceChartProps {
  /** History data points */
  history: StatsHistoryPoint[];
  /** Whether GPU is available */
  hasGpu?: boolean;
}

const METRICS = {
  cpu: { label: "CPU", color: "#3b82f6" },      // Blue
  ram: { label: "RAM", color: "#22c55e" },      // Green  
  gpu: { label: "GPU", color: "#a855f7" },      // Purple
};

/**
 * Large performance chart showing all metrics together
 */
export function PerformanceChart({ history, hasGpu = true }: PerformanceChartProps) {
  // Prepare chart data
  const chartData = useMemo(() => {
    return history.map((point, index) => {
      const secondsAgo = history.length - index;
      return {
        index,
        time: secondsAgo <= 60 ? `${secondsAgo}s` : `${Math.floor(secondsAgo / 60)}m`,
        cpu: point.cpuUsage,
        ram: point.ramUsage,
        gpu: point.gpuUsage,
      };
    });
  }, [history]);

  // Get current values
  const current = history.length > 0 ? history[history.length - 1] : null;

  // Calculate averages
  const getAvg = (key: "cpuUsage" | "ramUsage" | "gpuUsage") => {
    if (history.length === 0) return 0;
    return history.reduce((sum, p) => sum + p[key], 0) / history.length;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Performance History
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Last {history.length} seconds
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Current values row */}
          <div className="grid grid-cols-3 gap-4">
            {/* CPU */}
            <div className="flex items-center gap-3 rounded-lg bg-blue-500/10 px-3 py-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">CPU</p>
                <p className="text-lg font-semibold text-blue-500">
                  {current?.cpuUsage.toFixed(1) ?? "—"}%
                </p>
                <p className="text-xs text-muted-foreground">
                  avg {getAvg("cpuUsage").toFixed(0)}%
                </p>
              </div>
            </div>

            {/* RAM */}
            <div className="flex items-center gap-3 rounded-lg bg-green-500/10 px-3 py-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">RAM</p>
                <p className="text-lg font-semibold text-green-500">
                  {current?.ramUsage.toFixed(1) ?? "—"}%
                </p>
                <p className="text-xs text-muted-foreground">
                  avg {getAvg("ramUsage").toFixed(0)}%
                </p>
              </div>
            </div>

            {/* GPU */}
            <div className="flex items-center gap-3 rounded-lg bg-purple-500/10 px-3 py-2">
              <div className="h-3 w-3 rounded-full bg-purple-500" />
              <div>
                <p className="text-xs text-muted-foreground">GPU</p>
                <p className="text-lg font-semibold text-purple-500">
                  {hasGpu ? `${current?.gpuUsage.toFixed(1) ?? "—"}%` : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {hasGpu ? `avg ${getAvg("gpuUsage").toFixed(0)}%` : "No GPU"}
                </p>
              </div>
            </div>
          </div>

          {/* Combined Chart */}
          <div className="h-[220px] w-full">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Collecting data...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    {/* CPU gradient */}
                    <linearGradient id="gradientCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={METRICS.cpu.color} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={METRICS.cpu.color} stopOpacity={0} />
                    </linearGradient>
                    {/* RAM gradient */}
                    <linearGradient id="gradientRam" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={METRICS.ram.color} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={METRICS.ram.color} stopOpacity={0} />
                    </linearGradient>
                    {/* GPU gradient */}
                    <linearGradient id="gradientGpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={METRICS.gpu.color} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={METRICS.gpu.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--muted))"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    interval="preserveStartEnd"
                    minTickGap={50}
                  />

                  <YAxis
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    width={35}
                    tickFormatter={(value) => `${value}%`}
                  />

                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-popover px-3 py-2 shadow-lg">
                            <div className="space-y-1">
                              {payload.map((entry) => (
                                <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
                                  <div
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span className="text-muted-foreground">
                                    {entry.dataKey === "cpu" ? "CPU" : entry.dataKey === "ram" ? "RAM" : "GPU"}:
                                  </span>
                                  <span className="font-medium">
                                    {Number(entry.value).toFixed(1)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  <Legend
                    verticalAlign="top"
                    height={30}
                    formatter={(value) => (
                      <span className="text-xs text-muted-foreground">
                        {value === "cpu" ? "CPU" : value === "ram" ? "RAM" : "GPU"}
                      </span>
                    )}
                  />

                  {/* CPU Area */}
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    stroke={METRICS.cpu.color}
                    strokeWidth={2}
                    fill="url(#gradientCpu)"
                    isAnimationActive={false}
                  />

                  {/* RAM Area */}
                  <Area
                    type="monotone"
                    dataKey="ram"
                    stroke={METRICS.ram.color}
                    strokeWidth={2}
                    fill="url(#gradientRam)"
                    isAnimationActive={false}
                  />

                  {/* GPU Area (only if available) */}
                  {hasGpu && (
                    <Area
                      type="monotone"
                      dataKey="gpu"
                      stroke={METRICS.gpu.color}
                      strokeWidth={2}
                      fill="url(#gradientGpu)"
                      isAnimationActive={false}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
