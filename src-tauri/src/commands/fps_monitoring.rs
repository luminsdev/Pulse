use std::sync::Mutex;

use tauri::{AppHandle, State};

use crate::models::fps::{FpsEventPayload, FpsSidecarStatus};
use crate::services::FpsManager;
use crate::AppState;

#[tauri::command]
pub fn start_fps_monitoring(
    app: AppHandle,
    state: State<'_, AppState>,
    manager: State<'_, Mutex<FpsManager>>,
) -> Result<(), String> {
    if matches!(
        state.fps_sidecar.get_status(),
        FpsSidecarStatus::Running | FpsSidecarStatus::NoGame
    ) {
        return Ok(());
    }

    let manager = manager
        .lock()
        .map_err(|_| "Failed to access FPS sidecar manager".to_string())?;

    manager.start(&app);
    Ok(())
}

#[tauri::command]
pub fn stop_fps_monitoring(manager: State<'_, Mutex<FpsManager>>) -> Result<(), String> {
    let manager = manager
        .lock()
        .map_err(|_| "Failed to access FPS sidecar manager".to_string())?;

    manager.stop();
    Ok(())
}

#[tauri::command]
pub fn get_fps_monitoring_status(state: State<'_, AppState>) -> FpsEventPayload {
    state.fps_sidecar.get_event_payload()
}
