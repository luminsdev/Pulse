import { useMemo } from "react";
import { Cpu } from "lucide-react";
import { motion } from "framer-motion";
import { LedVuMeter } from "@/components/charts";
import { SkeletonLoader } from "@/components/common/SkeletonLoader";
import {
  formatFrequency,
  formatTemperature,
  formatPower,
  getTemperatureColor,
  formatHardwareName,
} from "@/lib/utils";
import type { CpuStats } from "@/types/stats";

interface CpuCardProps {
  /** Current CPU stats */
  stats: CpuStats | null;
}

/**
 * CPU monitoring cell for Precision Telemetry Console
 */
export function CpuCard({ stats }: CpuCardProps) {
  // Get temperature color info
  const tempColor = useMemo(
    () => getTemperatureColor(stats?.temperature, "cpu"),
    [stats?.temperature]
  );

  // Loading state
  if (!stats) {
    return <SkeletonLoader label="CPU DETECTING / WAITING TELEMETRY..." lines={4} />;
  }

  // Semantic Alerting
  const isAlert = stats.usage >= 90 || (stats.temperature ?? 0) >= 85;
  const accentColor = isAlert ? "text-red-500" : "text-[#3b82f6]";
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
        <Cpu className={`h-4 w-4 ${accentColor}`} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#a3a3a3]">
          01 █ PROCESSOR (CPU)
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

      {/* Stats Table Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-mono">
        <div className="flex justify-between border-b border-[#151515] pb-1">
          <span className="text-[#8a8a8a] uppercase">CORES</span>
          <span className="text-[#bbb] font-medium">{stats.cores}C / {stats.logical_cores}T</span>
        </div>
        <div className="flex justify-between border-b border-[#151515] pb-1">
          <span className="text-[#8a8a8a] uppercase">CLOCK</span>
          <span className="text-[#bbb] font-medium">{formatFrequency(stats.frequency)}</span>
        </div>
        <div className="flex justify-between border-b border-[#151515] pb-1">
          <span className="text-[#8a8a8a] uppercase">TEMP</span>
          <span className={`${tempColor.textColor} font-medium`}>
            {stats.temperature != null ? formatTemperature(stats.temperature) : "N/A"}
          </span>
        </div>
        <div className="flex justify-between border-b border-[#151515] pb-1">
          <span className="text-[#8a8a8a] uppercase">POWER</span>
          <span className="text-[#bbb] font-medium">
            {stats.power != null ? formatPower(stats.power) : "N/A"}
          </span>
        </div>
      </div>

      {/* Segmented LED VU Meter */}
      <LedVuMeter value={stats.usage} label="CPU load" />

      {/* Per-Core Temperature (compact bar map) */}
      {stats.core_temperatures && stats.core_temperatures.length > 0 && (
        <div className="space-y-1 pt-1">
          <div className="text-[10px] font-semibold text-[#8a8a8a] uppercase tracking-wider font-mono">
            CORE TEMPERATURE MAP ({stats.core_temperatures.length} Cores)
          </div>
          <div className="flex flex-wrap gap-1">
            {stats.core_temperatures.slice(0, 16).map((temp, index) => {
              const coreColor = getTemperatureColor(temp, "cpu");
              return (
                <div
                  key={index}
                  className={`px-1 py-0.5 rounded-sm text-[11px] font-mono font-medium ${coreColor.bgColor} ${coreColor.textColor}`}
                  title={`Core ${index}: ${temp != null ? formatTemperature(temp) : "N/A"}`}
                >
                  {temp != null ? `${temp.toFixed(0)}°` : "—"}
                </div>
              );
            })}
            {stats.core_temperatures.length > 16 && (
              <span className="text-[10px] text-[#737373] ml-1 font-mono flex items-center">
                +{stats.core_temperatures.length - 16}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Per-Core Usage Grid (compact pixel load map) */}
      {stats.per_core_usage.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-semibold text-[#8a8a8a] uppercase tracking-wider font-mono">
            THREAD LOAD DISTRIBUTION MAP ({stats.per_core_usage.length} Threads)
          </div>
          <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5">
            {stats.per_core_usage.map((usage, index) => (
              <div
                key={index}
                className="h-2 rounded-sm transition-all duration-200"
                style={{
                  backgroundColor:
                    usage >= 85
                      ? "#ef4444"
                      : usage >= 65
                      ? "#f59e0b"
                      : usage >= 25
                      ? "#3b82f6"
                      : "#151515",
                }}
                title={`Thread ${index + 1}: ${usage.toFixed(1)}%`}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
