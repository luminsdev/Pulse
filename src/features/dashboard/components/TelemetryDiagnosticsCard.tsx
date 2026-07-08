import { ActivitySquare } from "lucide-react";
import { motion } from "framer-motion";
import { formatBytes, formatPercent } from "@/lib/utils";
import { SkeletonLoader } from "@/components/common/SkeletonLoader";
import type { DiagnosticProcessRole, TelemetryDiagnosticsPayload } from "@/types/stats";

interface TelemetryDiagnosticsCardProps {
  diagnostics: TelemetryDiagnosticsPayload | null;
}

interface DiagnosticsGroup {
  role: DiagnosticProcessRole;
  label: string;
  processCount: number;
  memoryBytes: number;
  cpuUsage: number;
}

const GROUP_ORDER: DiagnosticProcessRole[] = [
  "pulse",
  "web_view",
  "fps_sidecar",
  "present_mon",
  "other",
];

function formatRoleLabel(role: DiagnosticProcessRole): string {
  switch (role) {
    case "pulse":
      return "PULSE APP HOST";
    case "web_view":
      return "WEBVIEW2 UI RUNTIME";
    case "fps_sidecar":
      return "FPS TELEMETRY SIDECAR";
    case "present_mon":
      return "PRESENTMON CAPTURE SVCS";
    case "other":
      return "OTHER DIAGNOSTIC PROCESSES";
    default:
      return "UNKNOWN ENGINE";
  }
}

function groupDiagnostics(diagnostics: TelemetryDiagnosticsPayload): DiagnosticsGroup[] {
  const groups = new Map<DiagnosticProcessRole, DiagnosticsGroup>();

  for (const process of diagnostics.processes) {
    const group = groups.get(process.role) ?? {
      role: process.role,
      label: formatRoleLabel(process.role),
      processCount: 0,
      memoryBytes: 0,
      cpuUsage: 0,
    };

    group.processCount += 1;
    group.memoryBytes += process.memory_bytes;
    group.cpuUsage += process.cpu_usage;
    groups.set(process.role, group);
  }

  return GROUP_ORDER.flatMap((role) => {
    const group = groups.get(role);
    return group ? [group] : [];
  });
}

function formatProcessCount(count: number): string {
  return `${count} ${count === 1 ? "PROC" : "PROCS"}`;
}

/**
 * Telemetry diagnostics footprint cell for Precision Telemetry Console
 */
export function TelemetryDiagnosticsCard({ diagnostics }: TelemetryDiagnosticsCardProps) {
  const groups = diagnostics ? groupDiagnostics(diagnostics) : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515] pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <ActivitySquare className="h-4 w-4 text-[#3b82f6]" />
          <span className="min-w-0 text-[11px] font-bold uppercase tracking-widest text-[#8a8a8a]">
            07 █ TELEMETRY SYSTEM FOOTPRINT & PROCESS DIAGNOSTICS
          </span>
        </div>
        <div className="shrink-0 text-sm font-mono text-[#8a8a8a]">
          TOTAL MEMORY ROOT:{" "}
          <span className="text-white font-bold">
            {diagnostics ? formatBytes(diagnostics.total_memory_bytes, 1) : "--"}
          </span>
        </div>
      </div>

      {!diagnostics ? (
        <SkeletonLoader label="WAITING FOR TELEMETRY DIAGNOSTICS..." lines={5} />
      ) : diagnostics.processes.length === 0 ? (
        <div className="flex h-24 items-center justify-center font-mono text-sm text-muted-foreground">
          [NO DIAGNOSTIC SUB-PROCESSES RUNNING]
        </div>
      ) : (
        <div className="space-y-1 font-mono text-sm">
          {/* Header Row */}
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_3.75rem_5rem] gap-2 text-[11px] text-[#8a8a8a] font-bold uppercase pb-1.5 border-b border-[#151515]">
            <span>SYSTEM LAYER</span>
            <span className="text-right">PROCS</span>
            <span className="text-right">CPU</span>
            <span className="text-right">MEM FOOTPRINT</span>
          </div>

          {/* Diagnostics rows */}
          <div className="space-y-0.5">
            {groups.map((group) => (
              <div
                key={group.role}
                className="grid grid-cols-[minmax(0,1fr)_4.5rem_3.75rem_5rem] gap-2 items-center py-1.5 border-b border-[#111] hover:bg-[#0c0c0c] transition-colors"
              >
                <span className="text-white font-bold truncate">{group.label}</span>
                <span className="text-right text-[#8a8a8a]">
                  {formatProcessCount(group.processCount)}
                </span>
                <span className="text-right text-[#bbb] font-bold">
                  {formatPercent(group.cpuUsage, 1)}
                </span>
                <span className="text-right text-[#bbb] font-bold">
                  {formatBytes(group.memoryBytes, 1)}
                </span>
              </div>
            ))}
          </div>

          <p className="pt-2 text-[10px] leading-relaxed text-[#737373] uppercase">
            * WEBVIEW2 PROCESSES CAN ALSO APPEAR IN THE SYSTEM PROCESS LIST BECAUSE THEY RENDER PULSE'S UI SURFACE.
          </p>
        </div>
      )}
    </motion.div>
  );
}
