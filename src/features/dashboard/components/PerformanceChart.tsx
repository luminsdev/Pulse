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
import { SkeletonLoader } from "@/components/common/SkeletonLoader";
import type { StatsHistoryPoint } from "../hooks/useSystemStats";

interface PerformanceChartProps {
  /** History data points */
  history: StatsHistoryPoint[];
  /** Whether GPU is available */
  hasGpu?: boolean;
}

const METRICS = {
  cpu: { label: "CPU", color: "#3b82f6" },      // Steel Blue
  ram: { label: "RAM", color: "#10b981" },      // Emerald Green
  gpu: { label: "GPU", color: "#f59e0b" },      // Telemetry Orange
};

/**
 * Oscilloscope-style timeline chart cell for Precision Telemetry Console
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#3b82f6]" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#a3a3a3]">
            04 █ REAL-TIME SYSTEM OSCILLOSCOPE (60s HISTORY)
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono">
          HISTORY SIZE: {history.length}s
        </span>
      </div>

      {/* Current values row - Flat console grid layout */}
      <div className="grid grid-cols-1 gap-2 font-mono text-xs sm:grid-cols-3">
        {/* CPU */}
        <div className="border border-[#151515] bg-[#0c0c0c] px-3 py-2 rounded-sm space-y-0.5">
          <div className="flex items-center gap-1.5 text-[#8a8a8a] font-semibold text-[11px]">
            <div className="h-2 w-2 rounded-full bg-[#3b82f6]" />
            CPU TELEMETRY
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold text-white tabular-nums">
              {current?.cpuUsage.toFixed(1) ?? "—"}%
            </span>
            <span className="text-[10px] text-[#737373] hidden xs:inline font-bold">
              AVG {getAvg("cpuUsage").toFixed(0)}%
            </span>
          </div>
        </div>

        {/* RAM */}
        <div className="border border-[#151515] bg-[#0c0c0c] px-3 py-2 rounded-sm space-y-0.5">
          <div className="flex items-center gap-1.5 text-[#8a8a8a] font-semibold text-[11px]">
            <div className="h-2 w-2 rounded-full bg-[#10b981]" />
            RAM TELEMETRY
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold text-white tabular-nums">
              {current?.ramUsage.toFixed(1) ?? "—"}%
            </span>
            <span className="text-[10px] text-[#737373] hidden xs:inline font-bold">
              AVG {getAvg("ramUsage").toFixed(0)}%
            </span>
          </div>
        </div>

        {/* GPU */}
        <div className="border border-[#151515] bg-[#0c0c0c] px-3 py-2 rounded-sm space-y-0.5">
          <div className="flex items-center gap-1.5 text-[#8a8a8a] font-semibold text-[11px]">
            <div className="h-2 w-2 rounded-full bg-[#f59e0b]" />
            GPU TELEMETRY
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold text-white tabular-nums">
              {hasGpu ? `${current?.gpuUsage.toFixed(1) ?? "—"}%` : "N/A"}
            </span>
            <span className="text-[10px] text-[#737373] hidden xs:inline font-bold">
              {hasGpu ? `AVG ${getAvg("gpuUsage").toFixed(0)}%` : "NO GPU"}
            </span>
          </div>
        </div>
      </div>

      {/* Combined Oscilloscope Chart */}
      <div className="h-[180px] sm:h-[200px] w-full bg-[#050505] border border-[#151515] p-2 rounded-sm relative">
        {chartData.length === 0 ? (
          <SkeletonLoader label="COLLECTING DATA FOR SWEEP..." lines={5} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
            >
              <defs>
                <filter id="glow-cpu" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={METRICS.cpu.color} floodOpacity="0.6"/>
                </filter>
                <filter id="glow-ram" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={METRICS.ram.color} floodOpacity="0.6"/>
                </filter>
                <filter id="glow-gpu" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={METRICS.gpu.color} floodOpacity="0.6"/>
                </filter>
              </defs>

              <CartesianGrid
                strokeDasharray="2 2"
                stroke="#151515"
                vertical={false}
              />

              <XAxis
                dataKey="time"
                axisLine={{ stroke: "#151515" }}
                tickLine={false}
                tick={{ fill: "#737373", fontSize: 9, fontFamily: "monospace" }}
                interval="preserveStartEnd"
                minTickGap={50}
              />

              <YAxis
                domain={[0, 100]}
                axisLine={{ stroke: "#151515" }}
                tickLine={false}
                tick={{ fill: "#737373", fontSize: 9, fontFamily: "monospace" }}
                width={35}
                tickFormatter={(value) => `${value}%`}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-sm border border-[#151515] bg-[#0c0c0c]/95 px-2.5 py-1.5 font-mono text-[11px] shadow-2xl">
                        <div className="space-y-1">
                          {payload.map((entry) => (
                            <div key={entry.dataKey} className="flex items-center gap-2">
                              <div
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-[#8a8a8a] uppercase font-bold">
                                {entry.dataKey === "cpu" ? "CPU" : entry.dataKey === "ram" ? "RAM" : "GPU"}:
                              </span>
                              <span className="font-bold text-white tabular-nums">
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
                height={25}
                iconType="circle"
                iconSize={6}
                formatter={(value) => (
                  <span className="text-[11px] font-mono font-bold text-[#8a8a8a] uppercase tracking-wider">
                    {value === "cpu" ? "CPU LOAD" : value === "ram" ? "RAM LOAD" : "GPU LOAD"}
                  </span>
                )}
              />

              {/* CPU Line */}
              <Area
                type="monotone"
                dataKey="cpu"
                stroke={METRICS.cpu.color}
                strokeWidth={1.5}
                fill="none"
                isAnimationActive={false}
                style={{ filter: "url(#glow-cpu)" }}
              />

              {/* RAM Line */}
              <Area
                type="monotone"
                dataKey="ram"
                stroke={METRICS.ram.color}
                strokeWidth={1.5}
                fill="none"
                isAnimationActive={false}
                style={{ filter: "url(#glow-ram)" }}
              />

              {/* GPU Line */}
              {hasGpu && (
                <Area
                  type="monotone"
                  dataKey="gpu"
                  stroke={METRICS.gpu.color}
                  strokeWidth={1.5}
                  fill="none"
                  isAnimationActive={false}
                  style={{ filter: "url(#glow-gpu)" }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
