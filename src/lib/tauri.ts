import { invoke } from "@tauri-apps/api/core";
import type { SystemStats } from "@/types/stats";

/**
 * Type-safe wrapper for Tauri invoke commands
 */
export async function getSystemStats(): Promise<SystemStats> {
  return invoke<SystemStats>("get_system_stats");
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
