import { Monitor } from "lucide-react";
import { motion } from "framer-motion";
import { formatBytes, formatUptime, formatHardwareName } from "@/lib/utils";
import { SkeletonLoader } from "@/components/common/SkeletonLoader";
import type { SystemInfo } from "@/types/stats";

interface SystemInfoCardProps {
  /** System information */
  info: SystemInfo | null;
}

/**
 * System information cell for Precision Telemetry Console
 */
export function SystemInfoCard({ info }: SystemInfoCardProps) {
  // Loading state
  if (!info) {
    return <SkeletonLoader label="LOADING SYSTEM SPECIFICATION..." lines={8} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4 text-[#3b82f6]" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#a3a3a3]">
          05 █ SYSTEM SPECIFICATION
        </span>
      </div>

      {/* Specification Table */}
      <div className="font-mono text-sm space-y-1">
        <div className="flex justify-between border-b border-[#111] py-1.5">
          <span className="text-[#8a8a8a] uppercase">HOST SYSTEM</span>
          <span className="text-white truncate flex-1 min-w-0 text-right ml-4 font-bold" title={info.hostname}>
            {info.hostname.toUpperCase()}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-b border-[#111] py-1.5">
          <span className="text-[#8a8a8a] uppercase">OPERATING SYS</span>
          <span className="min-w-0 flex-1 truncate text-right text-[#bbb]" title={`${info.os_name} (${info.os_version})`}>
            {info.os_name.toUpperCase()} ({info.os_version})
          </span>
        </div>
        <div className="flex justify-between border-b border-[#111] py-1.5">
          <span className="text-[#8a8a8a] uppercase">CENTRAL PROC</span>
          <span className="text-[#bbb] truncate flex-1 min-w-0 text-right ml-4" title={info.cpu_name}>
            {formatHardwareName(info.cpu_name)}
          </span>
        </div>
        <div className="flex justify-between border-b border-[#111] py-1.5">
          <span className="text-[#8a8a8a] uppercase">PROC CONFIG</span>
          <span className="text-[#bbb]">{info.cpu_cores} Cores / {info.cpu_threads} Threads</span>
        </div>
        <div className="flex justify-between border-b border-[#111] py-1.5">
          <span className="text-[#8a8a8a] uppercase">SYSTEM RAM</span>
          <span className="text-[#bbb]">{formatBytes(info.ram_total, 0)}</span>
        </div>
        {info.gpu_name && (
          <>
            <div className="flex justify-between border-b border-[#111] py-1.5">
              <span className="text-[#8a8a8a] uppercase">DISCRETE GPU</span>
              <span className="text-[#bbb] truncate flex-1 min-w-0 text-right ml-4" title={info.gpu_name}>
                {formatHardwareName(info.gpu_name)}
              </span>
            </div>
            {info.gpu_vram_total && (
              <div className="flex justify-between border-b border-[#111] py-1.5">
                <span className="text-[#8a8a8a] uppercase">GPU VRAM</span>
                <span className="text-[#bbb]">{formatBytes(info.gpu_vram_total, 0)}</span>
              </div>
            )}
          </>
        )}
        <div className="flex justify-between border-b border-[#111] py-1.5">
          <span className="text-[#8a8a8a] uppercase">SYSTEM UPTIME</span>
          <span className="text-[#10b981] font-bold">{formatUptime(info.uptime_seconds)}</span>
        </div>
      </div>
    </motion.div>
  );
}
