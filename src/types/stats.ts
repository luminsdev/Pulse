// System stats types - mirrors Rust models

export interface CpuStats {
  name: string;
  usage: number; // 0-100%
  frequency: number; // MHz
  cores: number;
  logical_cores: number;
  per_core_usage: number[];
  temperature?: number | null; // Celsius (from external sensor provider)
  core_temperatures?: number[] | null; // Per-core temps (from external sensor provider)
  power?: number | null; // Watts (from external sensor provider)
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
  hot_spot_temperature?: number | null; // Celsius - GPU hottest point (from external sensor provider)
  fan_speed?: number | null; // 0-100%
  power?: number | null; // Watts (from external sensor provider)
  core_clock?: number | null; // MHz (from external sensor provider)
  memory_clock?: number | null; // MHz (from external sensor provider)
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

// Sensor provider status types - mirrors Rust HwinfoSensorStatusInfo

export type SidecarStatusType =
  | "not_started"
  | "running"
  | "stopped"
  | "error"
  | "provider_unavailable"
  | "binary_not_found";

export interface SidecarStatusPayload {
  status: SidecarStatusType;
  message?: string; // Provider or error detail
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
  if (status.message) return status.message;

  switch (status.status) {
    case "not_started":
      return "Sensor provider initializing...";
    case "running":
      return "Sensor monitoring active";
    case "stopped":
      return status.can_restart
        ? "Sensor provider paused"
        : "Sensor provider unavailable";
    case "provider_unavailable":
    case "binary_not_found":
      return "Hardware sensors require HWiNFO64 running in Sensor mode with Shared Memory Support enabled.";
    case "error":
      return "Sensor provider error";
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

// Telemetry diagnostics types - mirrors Rust diagnostics models

export type DiagnosticProcessRole =
  | "pulse"
  | "web_view"
  | "fps_sidecar"
  | "present_mon"
  | "other";

export interface DiagnosticProcess {
  pid: number;
  name: string;
  role: DiagnosticProcessRole;
  memory_bytes: number;
  cpu_usage: number;
}

export interface TelemetryDiagnosticsPayload {
  processes: DiagnosticProcess[];
  total_memory_bytes: number;
  timestamp: number;
}
