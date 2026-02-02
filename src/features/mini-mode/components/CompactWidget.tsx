import { motion } from "framer-motion";
import { Cpu, MemoryStick, Gpu, Maximize2, X } from "lucide-react";
import type { SystemStats } from "@/types/stats";
import { hideMiniWindow, showMainWindow } from "@/lib/tauri";

interface CompactWidgetProps {
  stats: SystemStats | null;
  onExpand: () => void;
}

/** Format bytes to GB with 1 decimal */
function formatGB(bytes: number): string {
  return (bytes / 1024 / 1024 / 1024).toFixed(1);
}

/** Get color based on usage percentage */
function getUsageColor(value: number): string {
  if (value >= 90) return "#ef4444"; // red-500
  if (value >= 70) return "#f59e0b"; // amber-500
  if (value >= 50) return "#3b82f6"; // blue-500
  return "#22c55e"; // green-500
}

/** Mini ring progress indicator */
function RingProgress({
  value,
  size = 44,
  strokeWidth = 4,
  color,
  children,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-300 ease-out"
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/**
 * Compact overlay widget for mini mode
 * Modern design with ring progress indicators
 */
export function CompactWidget({ stats, onExpand }: CompactWidgetProps) {
  const cpu = stats?.cpu;
  const ram = stats?.ram;
  const gpu = stats?.gpu;

  const cpuValue = cpu?.usage ?? 0;
  const ramValue = ram?.usage_percent ?? 0;
  const gpuValue = gpu?.usage ?? 0;

  const handleClose = async () => {
    try {
      await hideMiniWindow();
      await showMainWindow();
    } catch (error) {
      console.error("Failed to close mini window:", error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="mini-widget h-screen w-screen select-none"
    >
      {/* Main container with glassmorphism */}
      <div className="relative h-full w-full rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/90 backdrop-blur-2xl shadow-2xl overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
        
        {/* Drag region */}
        <div
          data-tauri-drag-region
          className="absolute inset-0 cursor-move"
        />

        {/* Header - minimal */}
        <div className="relative z-10 flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1.5" data-tauri-drag-region>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
              Pulse
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={onExpand}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors group"
              title="Expand to full window"
            >
              <Maximize2 className="h-3 w-3 text-white/30 group-hover:text-white/60 transition-colors" />
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors group"
              title="Close"
            >
              <X className="h-3 w-3 text-white/30 group-hover:text-red-400 transition-colors" />
            </button>
          </div>
        </div>

        {/* Metrics - 3 ring indicators */}
        <div className="relative z-10 flex items-center justify-center gap-4 px-3 pb-3 pt-1">
          {/* CPU */}
          <MetricRing
            icon={<Cpu className="h-3.5 w-3.5" />}
            label="CPU"
            value={cpuValue}
            subValue={cpu?.temperature ? `${Math.round(cpu.temperature)}°` : undefined}
            color={getUsageColor(cpuValue)}
          />

          {/* RAM */}
          <MetricRing
            icon={<MemoryStick className="h-3.5 w-3.5" />}
            label="RAM"
            value={ramValue}
            subValue={ram ? `${formatGB(ram.used)}G` : undefined}
            color={getUsageColor(ramValue)}
          />

          {/* GPU */}
          <MetricRing
            icon={<Gpu className="h-3.5 w-3.5" />}
            label="GPU"
            value={gpuValue}
            subValue={gpu?.temperature ? `${Math.round(gpu.temperature)}°` : undefined}
            color={gpu ? getUsageColor(gpuValue) : "#525252"}
            disabled={!gpu}
          />
        </div>
      </div>
    </motion.div>
  );
}

interface MetricRingProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  subValue?: string;
  color: string;
  disabled?: boolean;
}

function MetricRing({
  icon,
  label,
  value,
  subValue,
  color,
  disabled,
}: MetricRingProps) {
  return (
    <div className={`flex flex-col items-center gap-1 ${disabled ? "opacity-40" : ""}`}>
      <RingProgress value={disabled ? 0 : value} color={color} size={48} strokeWidth={3}>
        <span className={disabled ? "text-white/30" : "text-white"} style={{ color: disabled ? undefined : color }}>
          {icon}
        </span>
      </RingProgress>
      
      <div className="flex flex-col items-center -mt-0.5">
        <span className="text-sm font-semibold text-white/90 tabular-nums leading-none">
          {disabled ? "—" : `${Math.round(value)}%`}
        </span>
        <span className="text-[9px] text-white/40 mt-0.5">
          {subValue || label}
        </span>
      </div>
    </div>
  );
}

export default CompactWidget;
