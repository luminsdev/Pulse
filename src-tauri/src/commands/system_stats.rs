use std::sync::Mutex;
use tauri::State;

use crate::models::SystemStats;
use crate::services::SystemMonitor;

/// Shared state for the system monitor
pub struct MonitorState(pub Mutex<SystemMonitor>);

/// Tauri command to get current system statistics
#[tauri::command]
pub fn get_system_stats(state: State<'_, MonitorState>) -> Result<SystemStats, String> {
    let mut monitor = state
        .0
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    // Refresh data before returning
    monitor.refresh();

    Ok(monitor.get_system_stats())
}

/// Tauri command to check if GPU monitoring is available
#[tauri::command]
pub fn has_gpu_support(state: State<'_, MonitorState>) -> Result<bool, String> {
    let monitor = state
        .0
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    Ok(monitor.has_gpu())
}
