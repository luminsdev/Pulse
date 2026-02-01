import { motion } from "framer-motion";
import { Cpu, MemoryStick, Gauge, Maximize2, GripVertical } from "lucide-react";
import type { SystemStats } from "@/types/stats";

interface CompactWidgetProps {
  stats: SystemStats | null;
  onExpand: () => void;
}

/** Format bytes to GB with 1 decimal */
function formatGB(bytes: number): string {
  return (bytes / 1024 / 1024 / 1024).toFixed(1);
}

/**
 * Compact overlay widget for mini mode
 * Displays essential metrics in a small, always-on-top window
 */
export function CompactWidget({ stats, onExpand }: CompactWidgetProps) {
  const cpu = stats?.cpu;
  const ram = stats?.ram;
  const gpu = stats?.gpu;

  // Format secondary values
  const cpuSecondary = cpu?.temperature 
    ? `${Math.round(cpu.temperature)}°C` 
    : "N/A";
  
  const ramSecondary = ram 
    ? `${formatGB(ram.used)}/${formatGB(ram.total)} GB`
    : "--";
  
  const gpuSecondary = gpu?.temperature 
    ? `${Math.round(gpu.temperature)}°C`
    : gpu ? "--" : "N/A";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mini-widget h-screen w-screen select-none"
    >
      {/* Main container with glassmorphism effect */}
      <div className="relative h-full w-full rounded-xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Drag handle - allows window dragging */}
        <div
          data-tauri-drag-region
          className="absolute inset-0 cursor-move"
        />

        {/* Header with drag indicator and expand button */}
        <div className="relative z-10 flex items-center justify-between px-3 py-1.5 border-b border-white/10">
          <div className="flex items-center gap-2" data-tauri-drag-region>
            <GripVertical className="h-3 w-3 text-white/40" />
            <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">
              Monitor
            </span>
          </div>
          <button
            onClick={onExpand}
            className="p-1 rounded-md hover:bg-white/10 transition-colors"
            title="Expand to full window"
          >
            <Maximize2 className="h-3.5 w-3.5 text-white/60 hover:text-white" />
          </button>
        </div>

        {/* Metrics Grid - 3 columns */}
        <div className="relative z-10 grid grid-cols-3 gap-1 px-2 py-3">
          {/* CPU */}
          <MetricItem
            icon={<Cpu className="h-3.5 w-3.5" />}
            label="CPU"
            value={cpu?.usage ?? 0}
            secondary={cpuSecondary}
            color="text-blue-400"
            bgColor="bg-blue-500/20"
          />

          {/* RAM */}
          <MetricItem
            icon={<MemoryStick className="h-3.5 w-3.5" />}
            label="RAM"
            value={ram?.usage_percent ?? 0}
            secondary={ramSecondary}
            color="text-emerald-400"
            bgColor="bg-emerald-500/20"
          />

          {/* GPU */}
          <MetricItem
            icon={<Gauge className="h-3.5 w-3.5" />}
            label="GPU"
            value={gpu?.usage ?? 0}
            secondary={gpuSecondary}
            color="text-purple-400"
            bgColor="bg-purple-500/20"
            disabled={!gpu}
          />
        </div>
      </div>
    </motion.div>
  );
}

interface MetricItemProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  secondary: string;
  color: string;
  bgColor: string;
  disabled?: boolean;
}

function MetricItem({ 
  icon, 
  label, 
  value, 
  secondary, 
  color, 
  bgColor, 
  disabled 
}: MetricItemProps) {
  const displayValue = disabled ? "--" : `${Math.round(value)}%`;
  
  return (
    <div className={`flex flex-col items-center gap-0.5 ${disabled ? "opacity-40" : ""}`}>
      {/* Icon + Label row */}
      <div className="flex items-center gap-1">
        <div className={`p-1 rounded-md ${bgColor}`}>
          <span className={color}>{icon}</span>
        </div>
        <span className="text-[10px] text-white/50 font-medium">{label}</span>
      </div>
      
      {/* Usage % - Primary metric */}
      <span className={`text-lg font-bold leading-tight ${color}`}>
        {displayValue}
      </span>
      
      {/* Secondary metric (temp/memory) */}
      <span className="text-[10px] text-white/40 leading-tight">
        {secondary}
      </span>
    </div>
  );
}

export default CompactWidget;
