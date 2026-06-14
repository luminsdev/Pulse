import { ActivitySquare } from "lucide-react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBytes, formatPercent, cn } from "@/lib/utils";
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
  "lhm_sidecar",
  "fps_sidecar",
  "present_mon",
  "other",
];

function formatRoleLabel(role: DiagnosticProcessRole): string {
  switch (role) {
    case "pulse":
      return "Pulse host";
    case "web_view":
      return "WebView2 UI runtime";
    case "lhm_sidecar":
      return "Temperature sidecar";
    case "fps_sidecar":
      return "FPS sidecar";
    case "present_mon":
      return "PresentMon";
    case "other":
      return "Other";
    default:
      return "Unknown";
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
  return `${count} ${count === 1 ? "process" : "processes"}`;
}

export function TelemetryDiagnosticsCard({ diagnostics }: TelemetryDiagnosticsCardProps) {
  const groups = diagnostics ? groupDiagnostics(diagnostics) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <Card className="relative overflow-hidden h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ActivitySquare className="h-4 w-4 text-primary" />
            Pulse Footprint
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="flex justify-between text-sm pb-3">
            <span className="text-muted-foreground">Pulse process tree memory</span>
            <span className="font-mono font-medium">
              {diagnostics ? formatBytes(diagnostics.total_memory_bytes, 1) : "--"}
            </span>
          </div>

          {!diagnostics ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground text-sm">
              Waiting for diagnostics...
            </div>
          ) : diagnostics.processes.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground text-sm">
              No Pulse processes detected
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_86px_64px_78px] gap-2 text-xs text-muted-foreground px-2 pb-1 border-b">
                <span>Component</span>
                <span className="text-right">Count</span>
                <span className="text-right">CPU</span>
                <span className="text-right">Memory</span>
              </div>

              <div className="space-y-0.5">
                {groups.map((group) => (
                  <div
                    key={group.role}
                    className={cn(
                      "grid grid-cols-[1fr_86px_64px_78px] gap-2 items-center py-1.5 px-2 rounded-md text-sm",
                      "hover:bg-muted/50 transition-colors"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{group.label}</div>
                    </div>
                    <span className="text-right font-mono text-xs text-muted-foreground">
                      {formatProcessCount(group.processCount)}
                    </span>
                    <span className="text-right font-mono text-xs text-muted-foreground">
                      {formatPercent(group.cpuUsage, 1)}
                    </span>
                    <span className="text-right font-mono text-xs text-muted-foreground">
                      {formatBytes(group.memoryBytes, 1)}
                    </span>
                  </div>
                ))}
              </div>

              <p className="pt-2 text-xs leading-relaxed text-muted-foreground">
                WebView2 may also appear in System Top Processes because it renders Pulse's UI.
                Memory values can differ from Task Manager's default Memory column.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
