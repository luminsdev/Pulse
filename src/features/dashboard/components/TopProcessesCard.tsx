import { ListOrdered } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatBytes, formatPercent } from "@/lib/utils";
import { SkeletonLoader } from "@/components/common/SkeletonLoader";
import type { ProcessInfo } from "@/types/stats";

interface TopProcessesCardProps {
  /** List of top processes */
  processes: ProcessInfo[];
}

/**
 * Top processes cell for Precision Telemetry Console
 */
export function TopProcessesCard({ processes }: TopProcessesCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <ListOrdered className="h-4 w-4 text-[#3b82f6]" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#a3a3a3]">
          06 █ HOT RESOURCE PROCESSES (TOP CONSUMERS)
        </span>
      </div>

      {processes.length === 0 ? (
        <SkeletonLoader label="NO PROCESS TELEMETRY AVAILABLE" lines={5} />
      ) : (
        <div className="space-y-1 font-mono text-sm">
          {/* Header Row */}
          <div className="grid grid-cols-[50px_1fr_60px_70px] gap-2 text-[11px] text-[#8a8a8a] font-bold uppercase pb-1.5 border-b border-[#151515]">
            <span>PID</span>
            <span>PROCESS NAME</span>
            <span className="text-right">CPU</span>
            <span className="text-right">MEM</span>
          </div>

          {/* Process list */}
          <div className="space-y-0.5 max-h-[220px] overflow-y-auto scrollbar-thin">
            <AnimatePresence mode="popLayout">
              {processes.slice(0, 8).map((process, index) => (
                <motion.div
                  key={process.pid}
                  layout
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 5 }}
                  transition={{ duration: 0.15, delay: index * 0.02 }}
                  className="grid grid-cols-[50px_1fr_60px_70px] gap-2 items-center py-1.5 border-b border-[#111] hover:bg-[#0c0c0c] transition-colors"
                >
                  {/* PID */}
                  <span className="text-[#737373] text-xs">{process.pid}</span>

                  {/* Process name */}
                  <span className="truncate text-white font-bold" title={process.name}>
                    {process.name}
                  </span>

                  {/* CPU usage */}
                  <div className="text-right">
                    <span
                      className={
                        process.cpu_usage >= 50
                          ? "text-[#ef4444] font-bold"
                          : process.cpu_usage >= 20
                          ? "text-[#f59e0b] font-bold"
                          : "text-[#bbb]"
                      }
                    >
                      {formatPercent(process.cpu_usage, 1)}
                    </span>
                  </div>

                  {/* Memory usage */}
                  <div className="text-right text-[#bbb]">
                    {formatBytes(process.memory, 0)}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Show more indicator */}
          {processes.length > 8 && (
            <div className="text-center text-[10px] text-[#737373] pt-1.5 uppercase font-bold">
              + {processes.length - 8} MORE SYSTEM PROCESSES ACTIVE
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
