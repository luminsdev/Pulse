import { invoke } from "@tauri-apps/api/core";
import type {
  FpsEventPayload,
  SidecarStatusPayload,
  SystemStats,
  TelemetryDiagnosticsPayload,
} from "@/types/stats";

/**
 * Type-safe wrapper for Tauri invoke commands
 */
export async function getSystemStats(): Promise<SystemStats> {
  return invoke<SystemStats>("get_system_stats");
}

export async function getLogPath(): Promise<string> {
  return invoke<string>("get_log_path");
}

export async function toggleMiniMode(): Promise<void> {
  return invoke("toggle_mini_mode");
}

export async function showMainWindow(): Promise<void> {
  return invoke("show_main_window");
}

export async function hideMiniWindow(): Promise<void> {
  return invoke("hide_mini_window");
}

export async function startFpsMonitoring(): Promise<void> {
  return invoke("start_fps_monitoring");
}

export async function stopFpsMonitoring(): Promise<void> {
  return invoke("stop_fps_monitoring");
}

export async function getFpsMonitoringStatus(): Promise<FpsEventPayload> {
  return invoke<FpsEventPayload>("get_fps_monitoring_status");
}

export async function startSensorMonitoring(): Promise<void> {
  return invoke("start_sensor_monitoring");
}

export async function acquireSensorMonitoring(surface: string): Promise<void> {
  return invoke("acquire_sensor_monitoring", { surface });
}

export async function releaseSensorMonitoring(surface: string): Promise<void> {
  return invoke("release_sensor_monitoring", { surface });
}

export async function getSensorMonitoringStatus(): Promise<SidecarStatusPayload> {
  return invoke<SidecarStatusPayload>("get_sensor_monitoring_status");
}

export async function getTelemetryDiagnostics(): Promise<TelemetryDiagnosticsPayload> {
  return invoke<TelemetryDiagnosticsPayload>("get_telemetry_diagnostics");
}
