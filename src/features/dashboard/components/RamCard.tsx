import { MemoryStick } from "lucide-react";
import { motion } from "framer-motion";
import { LedVuMeter } from "@/components/charts";
import { SkeletonLoader } from "@/components/common/SkeletonLoader";
import { formatBytes } from "@/lib/utils";
import type { RamStats } from "@/types/stats";

interface RamCardProps {
  /** Current RAM stats */
  stats: RamStats | null;
}

/**
 * RAM monitoring cell for Precision Telemetry Console
 */
export function RamCard({ stats }: RamCardProps) {
  // Loading state
  if (!stats) {
    return <SkeletonLoader label="RAM DETECTING / WAITING TELEMETRY..." lines={3} />;
  }

  // Semantic Alerting
  const isAlert = stats.usage_percent >= 90;
  const accentColor = isAlert ? "text-red-500" : "text-emerald-500";
  const pulseClass = isAlert ? "animate-pulse" : "";
  const clampedUsagePercent = Number.isFinite(stats.usage_percent)
    ? Math.min(Math.max(stats.usage_percent, 0), 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Header and Total */}
      <div className={`flex items-center justify-between ${pulseClass}`}>
        <div className="flex items-center gap-2">
          <MemoryStick className={`h-4 w-4 ${accentColor}`} />
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#a3a3a3]">
            02 █ SYSTEM MEMORY (RAM)
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {formatBytes(stats.total)} TOTAL
        </span>
      </div>

      {/* Large Stat Display */}
      <div className="flex items-baseline gap-1 pt-2">
        <span className="text-4xl font-bold font-mono tracking-tight text-white tabular-nums">
          {stats.usage_percent.toFixed(1)}
        </span>
        <span className="text-sm font-semibold text-[#737373] font-mono">%</span>
      </div>

      {/* RAM Progress Line */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] font-mono text-[#8a8a8a]">
          <span>MEMORY USAGE</span>
          <span className="text-[#bbb]">
            {formatBytes(stats.used)} / {formatBytes(stats.total)}
          </span>
        </div>
        <div className="h-2 bg-[#0d0d0d] border border-[#1a1a1a] p-[0.5px] rounded-sm">
          <motion.div
            className="h-full bg-emerald-500 rounded-sm"
            animate={{ width: `${clampedUsagePercent}%` }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          />
        </div>
      </div>

      {/* Segmented LED VU Meter */}
      <LedVuMeter value={stats.usage_percent} label="RAM load" />

      {/* Stats Table Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-mono">
        <div className="flex justify-between border-b border-[#151515] pb-1">
          <span className="text-[#8a8a8a] uppercase">USED</span>
          <span className="text-[#bbb] font-medium">{formatBytes(stats.used)}</span>
        </div>
        <div className="flex justify-between border-b border-[#151515] pb-1">
          <span className="text-[#8a8a8a] uppercase">AVAILABLE</span>
          <span className="text-[#bbb] font-medium">{formatBytes(stats.available)}</span>
        </div>
        <div className="flex justify-between border-b border-[#151515] pb-1">
          <span className="text-[#8a8a8a] uppercase">PERCENT USAGE</span>
          <span className="text-[#bbb] font-medium">{stats.usage_percent.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between border-b border-[#151515] pb-1">
          <span className="text-[#8a8a8a] uppercase">FREE PERCENT</span>
          <span className="text-[#bbb] font-medium">{(100 - stats.usage_percent).toFixed(1)}%</span>
        </div>
      </div>
    </motion.div>
  );
}
