// System stats types - mirrors Rust models

export interface CpuStats {
  name: string;
  usage: number; // 0-100%
  frequency: number; // MHz
  cores: number;
  logical_cores: number;
  per_core_usage: number[];
  temperature?: number; // Celsius (from LibreHardwareMonitor sidecar)
  core_temperatures?: number[]; // Per-core temps (from sidecar)
  power?: number; // Watts (from sidecar)
}

export interface RamStats {
  total: number; // bytes
  used: number; // bytes
  available: number; // bytes
  usage_percent: number; // 0-100%
}

export interface GpuStats {
  name: string;
  usage: number; // 0-100%
  memory_total: number; // bytes
  memory_used: number; // bytes
  temperature?: number; // Celsius
  hot_spot_temperature?: number; // Celsius - GPU hottest point (from sidecar)
  fan_speed?: number; // 0-100%
  power?: number; // Watts (from sidecar)
  core_clock?: number; // MHz (from sidecar)
  memory_clock?: number; // MHz (from sidecar)
}

export interface SystemInfo {
  cpu_name: string;
  cpu_cores: number;
  cpu_threads: number;
  ram_total: number; // bytes
  gpu_name?: string;
  gpu_vram_total?: number; // bytes
  os_name: string;
  os_version: string;
  hostname: string;
  uptime_seconds: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_usage: number; // 0-100%
  memory: number; // bytes
}

export interface SystemStats {
  cpu: CpuStats;
  ram: RamStats;
  gpu?: GpuStats;
  system_info: SystemInfo;
  processes: ProcessInfo[];
  timestamp: number;
}

// Sidecar status types - mirrors Rust SidecarStatusInfo

export type SidecarStatusType =
  | "not_started"
  | "running"
  | "stopped"
  | "error"
  | "requires_admin"
  | "binary_not_found";

export interface SidecarStatusPayload {
  status: SidecarStatusType;
  message?: string; // Error message when status is "error"
  restart_count: number;
  can_restart: boolean;
}

/**
 * Check if sidecar is in a healthy state
 */
export function isSidecarHealthy(status: SidecarStatusPayload): boolean {
  return status.status === "running";
}

/**
 * Check if sidecar has a recoverable error
 */
export function isSidecarRecoverable(status: SidecarStatusPayload): boolean {
  return status.status === "stopped" && status.can_restart;
}

/**
 * Get user-friendly message for sidecar status
 */
export function getSidecarStatusMessage(status: SidecarStatusPayload): string {
  switch (status.status) {
    case "not_started":
      return "Temperature monitoring initializing...";
    case "running":
      return "Temperature monitoring active";
    case "stopped":
      return status.can_restart
        ? `Temperature monitoring stopped. Restarting... (${status.restart_count}/3)`
        : "Temperature monitoring unavailable";
    case "requires_admin":
      return "Run as Administrator to enable temperature monitoring";
    case "binary_not_found":
      return "Temperature monitoring component not found";
    case "error":
      return status.message || "Temperature monitoring error";
    default:
      return "Unknown status";
  }
}
