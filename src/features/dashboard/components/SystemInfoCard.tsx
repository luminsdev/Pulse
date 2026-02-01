import { Monitor, Cpu, MemoryStick, MonitorPlay, Clock } from "lucide-react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBytes, formatUptime } from "@/lib/utils";
import type { SystemInfo } from "@/types/stats";

interface SystemInfoCardProps {
  /** System information */
  info: SystemInfo | null;
}

/**
 * System information card showing static hardware details
 */
export function SystemInfoCard({ info }: SystemInfoCardProps) {
  // Loading state
  if (!info) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-4 w-4" />
            System Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            Loading system info...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <Card className="relative overflow-hidden h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-4 w-4 text-primary" />
            System Info
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* CPU */}
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-blue-500/10 p-2">
              <Cpu className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Processor</p>
              <p className="text-sm font-medium truncate" title={info.cpu_name}>
                {info.cpu_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {info.cpu_cores} cores / {info.cpu_threads} threads
              </p>
            </div>
          </div>

          {/* RAM */}
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-green-500/10 p-2">
              <MemoryStick className="h-4 w-4 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Memory</p>
              <p className="text-sm font-medium">
                {formatBytes(info.ram_total, 0)} RAM
              </p>
            </div>
          </div>

          {/* GPU */}
          {info.gpu_name && (
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-purple-500/10 p-2">
                <MonitorPlay className="h-4 w-4 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Graphics</p>
                <p className="text-sm font-medium truncate" title={info.gpu_name}>
                  {info.gpu_name}
                </p>
                {info.gpu_vram_total && (
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(info.gpu_vram_total, 0)} VRAM
                  </p>
                )}
              </div>
            </div>
          )}

          {/* OS & Uptime */}
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-orange-500/10 p-2">
              <Clock className="h-4 w-4 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                {info.os_name} {info.os_version}
              </p>
              <p className="text-sm font-medium">
                Uptime: {formatUptime(info.uptime_seconds)}
              </p>
              {info.hostname && (
                <p className="text-xs text-muted-foreground truncate">
                  {info.hostname}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
