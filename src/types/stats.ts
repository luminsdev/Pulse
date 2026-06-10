// System stats types - mirrors Rust models

export interface CpuStats {
  name: string;
  usage: number; // 0-100%
  frequency: number; // MHz
  cores: number;
  logical_cores: number;
  per_core_usage: number[];
  temperature?: number | null; // Celsius (from LibreHardwareMonitor sidecar)
  core_temperatures?: number[] | null; // Per-core temps (from sidecar)
  power?: number | null; // Watts (from sidecar)
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
  temperature?: number | null; // Celsius
  hot_spot_temperature?: number | null; // Celsius - GPU hottest point (from sidecar)
  fan_speed?: number | null; // 0-100%
  power?: number | null; // Watts (from sidecar)
  core_clock?: number | null; // MHz (from sidecar)
  memory_clock?: number | null; // MHz (from sidecar)
}

export interface SystemInfo {
  cpu_name: string;
  cpu_cores: number;
  cpu_threads: number;
  ram_total: number; // bytes
  gpu_name?: string | null;
  gpu_vram_total?: number | null; // bytes
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
  gpu: GpuStats | null;
  system_info: SystemInfo;
  processes: ProcessInfo[];
  timestamp: number;
}

export interface SystemStatsPayload {
  cpu: CpuStats;
  ram: RamStats;
  gpu: GpuStats | null;
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

// FPS stats types - mirrors Rust fps models

/**
 * FPS data from a monitored game/application
 */
export interface FpsData {
  /** Name of the monitored process (e.g., "game.exe") */
  process_name: string;
  /** Process ID */
  process_id: number;
  /** Current FPS (frames per second) */
  fps: number;
  /** Average frame time in milliseconds */
  frame_time: number;
  /** 1% low FPS (worst 1% of frames) - indicates stutter */
  fps_1_percent_low: number;
  /** 0.1% low FPS (worst 0.1% of frames) - indicates severe stutter */
  fps_01_percent_low: number;
  /** Timestamp in milliseconds */
  timestamp: number;
}

/**
 * FPS sidecar status types
 */
export type FpsSidecarStatusType =
  | "not_started"
  | "running"
  | "no_game"
  | "stopped"
  | "error"
  | "not_installed";

/**
 * FPS event payload from the backend
 * Uses flattened status enum from Rust
 */
export interface FpsEventPayload {
  /** Current status of the FPS sidecar */
  status: FpsSidecarStatusType;
  /** Error message (only present when status is "error") */
  message?: string;
  /** FPS data (present when a game is being monitored) */
  data?: FpsData | null;
  /** Whether PresentMon is installed on the system */
  present_mon_installed: boolean;
}

/**
 * Check if FPS monitoring is active and receiving data
 */
export function isFpsActive(payload: FpsEventPayload): boolean {
  return payload.status === "running" && payload.data != null;
}

/**
 * Check if no game is currently detected
 */
export function isFpsNoGame(payload: FpsEventPayload): boolean {
  return payload.status === "no_game";
}

/**
 * Get user-friendly message for FPS status
 */
export function getFpsStatusMessage(payload: FpsEventPayload): string {
  switch (payload.status) {
    case "not_started":
      return "FPS monitoring initializing...";
    case "running":
      return payload.data
        ? `Monitoring ${payload.data.process_name}`
        : "FPS monitoring active";
    case "no_game":
      return "No game detected";
    case "stopped":
      return "FPS monitoring stopped";
    case "not_installed":
      return "PresentMon not installed";
    case "error":
      return payload.message || "FPS monitoring error";
    default:
      return "Unknown status";
  }
}
