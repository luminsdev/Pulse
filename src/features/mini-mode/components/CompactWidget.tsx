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

/** Color constants for sub-labels */
const COLORS = {
  temp: "#f97316",    // orange-500 - warm color for temperature
  power: "#eab308",   // yellow-500 - energy color
  ram: "#38bdf8",     // sky-400 - cool color for memory
  separator: "rgba(255, 255, 255, 0.3)",
} as const;

/** Mini ring progress indicator */
function RingProgress({
  value,
  size = 52,
  strokeWidth = 3.5,
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
          stroke="rgba(255, 255, 255, 0.08)"
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
          className="transition-all duration-500 ease-out"
          style={{
            filter: `drop-shadow(0 0 4px ${color}40)`,
          }}
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
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-black/20 pointer-events-none" />
        
        {/* Drag region */}
        <div
          data-tauri-drag-region
          className="absolute inset-0 cursor-move"
        />

        {/* Header - minimal */}
        <div className="relative z-10 flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1.5" data-tauri-drag-region>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
            <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
              Pulse
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={onExpand}
              className="p-1.5 rounded-lg hover:bg-white/10 active:bg-white/5 transition-all duration-150 group"
              title="Expand to full window"
            >
              <Maximize2 className="h-3 w-3 text-white/40 group-hover:text-white/80 transition-colors" />
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-red-500/20 active:bg-red-500/10 transition-all duration-150 group"
              title="Close"
            >
              <X className="h-3 w-3 text-white/40 group-hover:text-red-400 transition-colors" />
            </button>
          </div>
        </div>

        {/* Metrics - 3 ring indicators */}
        <div className="relative z-10 flex items-center justify-center gap-5 px-4 pb-3.5 pt-0.5">
          {/* CPU */}
          <MetricRing
            icon={<Cpu className="h-4 w-4" />}
            label="CPU"
            value={cpuValue}
            color={getUsageColor(cpuValue)}
            subLabelContent={
              <TempPowerLabel temp={cpu?.temperature} power={cpu?.power} />
            }
          />

          {/* RAM */}
          <MetricRing
            icon={<MemoryStick className="h-4 w-4" />}
            label="RAM"
            value={ramValue}
            color={getUsageColor(ramValue)}
            subLabelContent={
              ram ? <RamLabel used={ram.used} total={ram.total} /> : undefined
            }
          />

          {/* GPU */}
          <MetricRing
            icon={<Gpu className="h-4 w-4" />}
            label="GPU"
            value={gpuValue}
            color={gpu ? getUsageColor(gpuValue) : "#525252"}
            disabled={!gpu}
            subLabelContent={
              gpu ? <TempPowerLabel temp={gpu.temperature} power={gpu.power} /> : undefined
            }
          />
        </div>
      </div>
    </motion.div>
  );
}

/** Temperature and Power label with colors */
function TempPowerLabel({ temp, power }: { temp?: number; power?: number }) {
  const hasTemp = temp !== undefined && temp > 0;
  const hasPower = power !== undefined && power > 0;

  if (!hasTemp && !hasPower) {
    return null;
  }

  return (
    <span className="text-[11px] font-medium tabular-nums flex items-center gap-1">
      {hasTemp && (
        <span style={{ color: COLORS.temp }}>{Math.round(temp)}°</span>
      )}
      {hasTemp && hasPower && (
        <span style={{ color: COLORS.separator }}>•</span>
      )}
      {hasPower && (
        <span style={{ color: COLORS.power }}>{Math.round(power)}W</span>
      )}
    </span>
  );
}

/** RAM usage label with color */
function RamLabel({ used, total }: { used: number; total: number }) {
  return (
    <span className="text-[11px] font-medium tabular-nums" style={{ color: COLORS.ram }}>
      {formatGB(used)}/{formatGB(total)}G
    </span>
  );
}

interface MetricRingProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  disabled?: boolean;
  subLabelContent?: React.ReactNode;
}

function MetricRing({
  icon,
  label,
  value,
  color,
  disabled,
  subLabelContent,
}: MetricRingProps) {
  return (
    <motion.div 
      className={`flex flex-col items-center gap-1.5 ${disabled ? "opacity-40" : ""}`}
      whileHover={disabled ? undefined : { scale: 1.05 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <RingProgress value={disabled ? 0 : value} color={color} size={52} strokeWidth={3.5}>
        <span 
          className={disabled ? "text-white/30" : "text-white/90"} 
          style={{ color: disabled ? undefined : color }}
        >
          {icon}
        </span>
      </RingProgress>
      
      <div className="flex flex-col items-center">
        {/* Percentage value - larger and more prominent */}
        <span className="text-[15px] font-semibold text-white/95 tabular-nums leading-none tracking-tight">
          {disabled ? "—" : `${Math.round(value)}%`}
        </span>
        {/* Sub-label: colored temp/power or RAM usage */}
        <div className="mt-1 min-h-[14px] flex items-center justify-center">
          {subLabelContent || (
            <span className="text-[11px] text-white/40 font-medium">{label}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default CompactWidget;
