import { ListOrdered } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBytes, formatPercent, cn } from "@/lib/utils";
import type { ProcessInfo } from "@/types/stats";

interface TopProcessesCardProps {
  /** List of top processes */
  processes: ProcessInfo[];
}

/**
 * Top processes card showing CPU and memory usage
 */
export function TopProcessesCard({ processes }: TopProcessesCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
    >
      <Card className="relative overflow-hidden h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListOrdered className="h-4 w-4 text-primary" />
            Top Processes
          </CardTitle>
        </CardHeader>

        <CardContent>
          {processes.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground text-sm">
              No process data available
            </div>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-[1fr_60px_70px] gap-2 text-xs text-muted-foreground px-2 pb-1 border-b">
                <span>Process</span>
                <span className="text-right">CPU</span>
                <span className="text-right">Memory</span>
              </div>

              {/* Process list */}
              <div className="space-y-0.5 max-h-[240px] overflow-y-auto scrollbar-thin">
                <AnimatePresence mode="popLayout">
                  {processes.slice(0, 8).map((process, index) => (
                    <motion.div
                      key={process.pid}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      className={cn(
                        "grid grid-cols-[1fr_60px_70px] gap-2 items-center py-1.5 px-2 rounded-md text-sm",
                        "hover:bg-muted/50 transition-colors"
                      )}
                    >
                      {/* Process name */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground w-4 shrink-0">
                          {index + 1}
                        </span>
                        <span className="truncate font-medium" title={process.name}>
                          {process.name}
                        </span>
                      </div>

                      {/* CPU usage */}
                      <div className="text-right">
                        <span
                          className={cn(
                            "font-mono text-xs",
                            process.cpu_usage >= 50
                              ? "text-red-500"
                              : process.cpu_usage >= 20
                              ? "text-orange-500"
                              : "text-muted-foreground"
                          )}
                        >
                          {formatPercent(process.cpu_usage, 1)}
                        </span>
                      </div>

                      {/* Memory usage */}
                      <div className="text-right">
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatBytes(process.memory, 0)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Show more indicator */}
              {processes.length > 8 && (
                <div className="text-center text-xs text-muted-foreground pt-2">
                  +{processes.length - 8} more processes
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
