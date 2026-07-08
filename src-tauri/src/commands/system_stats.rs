use std::sync::Mutex;
use tauri::State;

use crate::models::SystemStats;
use crate::services::{apply_snapshot_to_system_stats, SystemMonitor};
use crate::AppState;

/// Shared state for the system monitor
pub struct MonitorState(pub Mutex<SystemMonitor>);

/// Tauri command to get current system statistics
#[tauri::command]
pub fn get_system_stats(
    state: State<'_, MonitorState>,
    app_state: State<'_, AppState>,
) -> Result<SystemStats, String> {
    app_state.sensors.poll();
    let sensor_snapshot = app_state.sensors.latest_snapshot();

    let mut stats = {
        let mut monitor = state
            .0
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;

        // Refresh data before returning
        monitor.refresh();
        monitor.get_system_stats()
    };

    if let Some(snapshot) = sensor_snapshot {
        apply_snapshot_to_system_stats(&mut stats, &snapshot);
    }

    Ok(stats)
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
