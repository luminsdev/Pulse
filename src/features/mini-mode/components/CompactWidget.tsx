import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Maximize2, Droplet } from "lucide-react";
import type { SystemStatsPayload, FpsData, FpsSidecarStatusType } from "@/types/stats";
import type { StatsHistoryPoint } from "@/features/dashboard/hooks/useSystemStats";
import { Sparkline } from "./Sparkline";

interface CompactWidgetProps {
  stats: SystemStatsPayload | null;
  sysHistory?: StatsHistoryPoint[];
  onExpand: () => void;
  fpsData?: FpsData | null;
  fpsStatus?: FpsSidecarStatusType;
}

const DEFAULT_OPACITY = 40;
const MINI_OPACITY_STORAGE_KEY = "pulse_mini_mode_opacity";
const LABEL_COLOR = "#94a3b8"; // slate-400
const MUTED_VALUE_COLOR = "#64748b"; // slate-500

function formatGB(bytes: number): string {
  return (bytes / 1024 / 1024 / 1024).toFixed(1);
}

function getFpsColor(fps: number): string {
  if (fps >= 60) return "#a855f7"; // purple in mockup
  if (fps >= 45) return "#3b82f6";
  if (fps >= 30) return "#f59e0b";
  if (fps > 0) return "#ef4444";
  return "#a855f7"; // default purple
}

function getFpsStatusLabel(status: FpsSidecarStatusType): string {
  switch (status) {
    case "no_game":
      return "No game";
    case "not_installed":
      return "No PM";
    case "error":
      return "Error";
    case "stopped":
      return "Stopped";
    case "running":
      return "Waiting";
    case "not_started":
      return "FPS off";
  }
}

function getFpsStatusColor(status: FpsSidecarStatusType): string {
  if (status === "error" || status === "not_installed") return "#ef4444";
  if (status === "no_game") return "#f59e0b";
  return MUTED_VALUE_COLOR;
}

/** Dynamic color based on usage percentage — used for values and sparklines */
function getUsageColor(value: number): string {
  if (value >= 91) return "#ef4444"; // red-500 — critical
  if (value >= 76) return "#f97316"; // orange-500 — high
  if (value >= 51) return "#f59e0b"; // amber-500 — moderate
  return "#22c55e"; // green-500 — normal
}

function readSavedOpacity(): number {
  const saved = window.localStorage.getItem(MINI_OPACITY_STORAGE_KEY);
  if (saved === null) return DEFAULT_OPACITY;

  const parsed = Number(saved);
  if (!Number.isFinite(parsed)) return DEFAULT_OPACITY;

  return Math.min(100, Math.max(0, Math.round(parsed)));
}

export function CompactWidget({ 
  stats, 
  sysHistory = [], 
  onExpand, 
  fpsData, 
  fpsStatus = "not_started"
}: CompactWidgetProps) {
  const cpu = stats?.cpu;
  const ram = stats?.ram;
  const gpu = stats?.gpu;
  const hasGpu = gpu != null;

  const cpuValue = cpu?.usage ?? 0;
  const ramValue = ram?.usage_percent ?? 0;
  const gpuValue = gpu?.usage ?? 0;
  
  const fpsValue = fpsData?.fps ?? 0;
  const hasFps = fpsStatus === "running" && fpsData != null;
  const fpsColor = hasFps ? getFpsColor(fpsValue) : "#525252";
  const fpsDisplayColor = hasFps ? fpsColor : getFpsStatusColor(fpsStatus);

  const cpuColor = getUsageColor(cpuValue);
  const gpuColor = hasGpu ? getUsageColor(gpuValue) : MUTED_VALUE_COLOR;
  const ramColor = getUsageColor(ramValue);

  const cpuHistory = sysHistory.map(h => h.cpuUsage);
  const gpuHistory = hasGpu ? sysHistory.map(h => h.gpuUsage) : [];
  const ramHistory = sysHistory.map(h => h.ramUsage);

  const [opacity, setOpacity] = useState(readSavedOpacity);

  useEffect(() => {
    window.localStorage.setItem(MINI_OPACITY_STORAGE_KEY, opacity.toString());
  }, [opacity]);

  const isOsdMode = opacity < 20;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="mini-widget h-screen w-screen select-none"
    >
      <div className="relative h-full w-full rounded-2xl flex flex-col justify-center overflow-hidden">
        
        {/* Layer 1: The Color & Blur Box */}
        <div 
          className="absolute inset-0 z-0 rounded-2xl transition-all duration-200 pointer-events-none"
          style={{ 
            backgroundColor: `rgba(15, 15, 15, ${opacity / 100})`,
            border: opacity >= 20 ? `1px solid rgba(255, 255, 255, ${(opacity / 100) * 0.15})` : 'none',
            boxShadow: opacity >= 20 ? `0 10px 30px rgba(0,0,0, ${(opacity / 100) * 0.5})` : 'none',
            backdropFilter: opacity >= 20 ? 'blur(12px)' : 'none',
            WebkitBackdropFilter: opacity >= 20 ? 'blur(12px)' : 'none'
          }}
        />
        
        {/* Drag region */}
        <div data-tauri-drag-region className="absolute inset-0 cursor-move z-10" />

        {/* Floating actions */}
        <div className="absolute top-1 right-2 z-30 flex items-center gap-1 group/slider">
          <input 
            type="range" 
            min="0" max="100" 
            value={opacity}
            onChange={(e) => setOpacity(Math.min(100, Math.max(0, Number(e.currentTarget.value))))}
            className="pointer-events-none w-20 opacity-0 group-hover/slider:pointer-events-auto group-hover/slider:opacity-100 group-focus-within/slider:pointer-events-auto group-focus-within/slider:opacity-100 focus:pointer-events-auto focus:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/70 transition-opacity accent-white/80 cursor-pointer"
            aria-label="Background opacity"
            title="Background Opacity"
          />
          <div className="p-1.5 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-help" title="Opacity Slider" aria-hidden="true">
            <Droplet className="h-3 w-3 text-white/40" />
          </div>
          <button
            type="button"
            onClick={onExpand}
            className="p-1.5 rounded-lg hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/70 transition-colors"
            aria-label="Expand to full window"
            title="Expand"
          >
            <Maximize2 className="h-3 w-3 text-white/40 hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className={`relative z-20 flex items-center justify-center px-3 gap-3 ${isOsdMode ? 'osd-text' : ''}`}>
          
          {/* CPU */}
          <div className="flex w-20 flex-col gap-[3px] relative">
            <div className="flex justify-between items-baseline">
              <span className="text-[14px] font-mono" style={{ color: LABEL_COLOR }}>CPU</span>
              <span className="text-[19px] font-bold font-mono" style={{ color: cpuColor }}>{Math.round(cpuValue)}%</span>
            </div>
            <div className="flex justify-between items-center text-[14px] font-mono">
              <span className="text-[#f97316] font-medium">{cpu?.temperature ? Math.round(cpu.temperature) + '°' : '--'}</span>
              <span className="text-[#eab308] font-medium">{cpu?.power ? Math.round(cpu.power) + 'W' : '--'}</span>
            </div>
            <div className={`mt-[2px] ${isOsdMode ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : ''}`}><Sparkline data={cpuHistory} color={cpuColor} width={80} /></div>
          </div>

          {/* GPU */}
          <div className="flex w-20 flex-col gap-[3px] relative">
            <div className="flex justify-between items-baseline">
              <span className="text-[14px] font-mono" style={{ color: LABEL_COLOR }}>GPU</span>
              <span className="text-[19px] font-bold font-mono" style={{ color: gpuColor }}>{hasGpu ? `${Math.round(gpuValue)}%` : "--"}</span>
            </div>
            <div className="flex justify-between items-center text-[14px] font-mono">
              <span className="text-[#f97316] font-medium">{gpu?.temperature ? Math.round(gpu.temperature) + '°' : '--'}</span>
              <span className="text-[#eab308] font-medium">{gpu?.power ? Math.round(gpu.power) + 'W' : '--'}</span>
            </div>
            <div className={`mt-[2px] ${isOsdMode ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : ''}`}><Sparkline data={gpuHistory} color={gpuColor} width={80} /></div>
          </div>

          {/* RAM */}
          <div className="flex w-20 flex-col gap-[3px]">
            <div className="flex justify-between items-baseline">
              <span className="text-[14px] font-mono" style={{ color: LABEL_COLOR }}>RAM</span>
              <span className="text-[19px] font-bold font-mono" style={{ color: ramColor }}>{Math.round(ramValue)}%</span>
            </div>
            <div className="flex justify-center text-[11px] font-mono text-[#38bdf8] font-medium whitespace-nowrap">
              {ram ? `${formatGB(ram.used)}/${formatGB(ram.total)}GB` : '--'}
            </div>
            <div className={`mt-[2px] ${isOsdMode ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : ''}`}><Sparkline data={ramHistory} color={ramColor} width={80} /></div>
          </div>

          {/* FPS */}
          <div className={`flex h-[48px] w-[52px] flex-col justify-center gap-[2px] border-l pl-3 ${isOsdMode ? 'border-transparent' : 'border-white/10'}`}>
            <div className="text-center text-[12px] font-mono tracking-[1px]" style={{ color: fpsDisplayColor, opacity: 0.8 }}>FPS</div>
            {hasFps ? (
              <div className="text-center text-[26px] font-bold font-mono leading-none" style={{ color: fpsDisplayColor }}>
                {Math.round(fpsValue)}
              </div>
            ) : (
              <div className="whitespace-nowrap text-center text-[10px] font-semibold font-mono leading-none" style={{ color: fpsDisplayColor }}>
                {getFpsStatusLabel(fpsStatus)}
              </div>
            )}
          </div>

        </div>
      </div>
    </motion.div>
  );
}
