use std::sync::Mutex;

use tauri::{AppHandle, Manager, State};

use super::sensor_monitoring::{
    acquire_sensor_monitoring_surface, release_sensor_monitoring_surface, SensorMonitorLeaseState,
};
use crate::services::SidecarManager;

fn log_sensor_lifecycle(action: &str, result: Result<(), String>) {
    if let Err(error) = result {
        tracing::error!("[Window] Failed to {} sensor monitoring: {}", action, error);
    }
}

/// Toggle between main window and mini mode
#[tauri::command]
pub async fn toggle_mini_mode(
    app: AppHandle,
    leases: State<'_, SensorMonitorLeaseState>,
    manager: State<'_, Mutex<SidecarManager>>,
) -> Result<(), String> {
    // Get window references
    let main_window = app.get_webview_window("main");
    let mini_window = app.get_webview_window("mini");

    match (main_window, mini_window) {
        (Some(main), Some(mini)) => {
            // Check which one is visible and toggle
            if main.is_visible().unwrap_or(false) {
                log_sensor_lifecycle(
                    "acquire mini",
                    acquire_sensor_monitoring_surface("mini", &app, &leases, &manager),
                );
                main.hide().map_err(|e| e.to_string())?;
                log_sensor_lifecycle(
                    "release dashboard",
                    release_sensor_monitoring_surface("dashboard", &leases, &manager),
                );
                mini.show().map_err(|e| e.to_string())?;
                mini.set_focus().map_err(|e| e.to_string())?;
            } else {
                log_sensor_lifecycle(
                    "acquire dashboard",
                    acquire_sensor_monitoring_surface("dashboard", &app, &leases, &manager),
                );
                mini.hide().map_err(|e| e.to_string())?;
                log_sensor_lifecycle(
                    "release mini",
                    release_sensor_monitoring_surface("mini", &leases, &manager),
                );
                main.show().map_err(|e| e.to_string())?;
                main.set_focus().map_err(|e| e.to_string())?;
            }
            Ok(())
        }
        _ => Err("Windows not found".to_string()),
    }
}

/// Show the main window
#[tauri::command]
pub async fn show_main_window(
    app: AppHandle,
    leases: State<'_, SensorMonitorLeaseState>,
    manager: State<'_, Mutex<SidecarManager>>,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        log_sensor_lifecycle(
            "acquire dashboard",
            acquire_sensor_monitoring_surface("dashboard", &app, &leases, &manager),
        );
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Hide the mini window
#[tauri::command]
pub async fn hide_mini_window(
    app: AppHandle,
    leases: State<'_, SensorMonitorLeaseState>,
    manager: State<'_, Mutex<SidecarManager>>,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("mini") {
        window.hide().map_err(|e| e.to_string())?;
        log_sensor_lifecycle(
            "release mini",
            release_sensor_monitoring_surface("mini", &leases, &manager),
        );
    }
    Ok(())
}
