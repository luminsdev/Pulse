use std::collections::HashSet;
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, State};

use crate::services::{SidecarManager, SidecarState};
use crate::{AppState, SidecarStatusPayload};

#[derive(Default)]
pub struct SensorMonitorLeaseState(pub Mutex<HashSet<String>>);

fn status_payload(state: &Arc<SidecarState>) -> SidecarStatusPayload {
    SidecarStatusPayload {
        status: state.get_status_info(),
        restart_count: state.get_restart_count(),
        can_restart: state.can_restart(),
    }
}

fn normalize_surface(surface: &str) -> Result<String, String> {
    let surface = surface.trim().to_string();
    if surface.is_empty() {
        return Err("Sensor monitoring surface is required".to_string());
    }

    Ok(surface)
}

fn acquire_surface(active_surfaces: &mut HashSet<String>, surface: &str) -> Result<bool, String> {
    let surface = normalize_surface(surface)?;
    let should_start = active_surfaces.is_empty();
    active_surfaces.insert(surface);
    Ok(should_start)
}

fn release_surface(active_surfaces: &mut HashSet<String>, surface: &str) -> Result<bool, String> {
    let surface = normalize_surface(surface)?;
    active_surfaces.remove(&surface);
    Ok(active_surfaces.is_empty())
}

#[tauri::command]
pub fn start_sensor_monitoring(
    app: AppHandle,
    manager: State<'_, Mutex<SidecarManager>>,
) -> Result<(), String> {
    let manager = manager
        .lock()
        .map_err(|_| "Failed to access sensor sidecar manager".to_string())?;

    manager.start(&app);
    Ok(())
}

#[tauri::command]
pub fn acquire_sensor_monitoring(
    surface: String,
    app: AppHandle,
    leases: State<'_, SensorMonitorLeaseState>,
    manager: State<'_, Mutex<SidecarManager>>,
) -> Result<(), String> {
    acquire_sensor_monitoring_surface(&surface, &app, &leases, &manager)
}

pub fn acquire_sensor_monitoring_surface(
    surface: &str,
    app: &AppHandle,
    leases: &SensorMonitorLeaseState,
    manager: &Mutex<SidecarManager>,
) -> Result<(), String> {
    let mut active_surfaces = leases
        .0
        .lock()
        .map_err(|_| "Failed to access sensor monitor lease state".to_string())?;

    let should_start = acquire_surface(&mut active_surfaces, &surface)?;
    drop(active_surfaces);

    if should_start {
        let manager = manager
            .lock()
            .map_err(|_| "Failed to access sensor sidecar manager".to_string())?;
        manager.start(&app);
    }

    Ok(())
}

#[tauri::command]
pub fn release_sensor_monitoring(
    surface: String,
    leases: State<'_, SensorMonitorLeaseState>,
    manager: State<'_, Mutex<SidecarManager>>,
) -> Result<(), String> {
    release_sensor_monitoring_surface(&surface, &leases, &manager)
}

pub fn release_sensor_monitoring_surface(
    surface: &str,
    leases: &SensorMonitorLeaseState,
    manager: &Mutex<SidecarManager>,
) -> Result<(), String> {
    let mut active_surfaces = leases
        .0
        .lock()
        .map_err(|_| "Failed to access sensor monitor lease state".to_string())?;

    let should_stop = release_surface(&mut active_surfaces, &surface)?;
    drop(active_surfaces);

    if should_stop {
        let manager = manager
            .lock()
            .map_err(|_| "Failed to access sensor sidecar manager".to_string())?;
        manager.stop();
        manager.state().clear_data();
    }

    Ok(())
}

#[tauri::command]
pub fn get_sensor_monitoring_status(state: State<'_, AppState>) -> SidecarStatusPayload {
    status_payload(&state.sidecar)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn acquire_surface_starts_only_when_first_surface_is_added() {
        let mut active_surfaces = HashSet::new();

        assert!(acquire_surface(&mut active_surfaces, "dashboard").unwrap());
        assert!(!acquire_surface(&mut active_surfaces, "mini").unwrap());
        assert!(!acquire_surface(&mut active_surfaces, "dashboard").unwrap());
        assert_eq!(active_surfaces.len(), 2);
    }

    #[test]
    fn release_surface_stops_only_when_last_surface_is_removed() {
        let mut active_surfaces = HashSet::from(["dashboard".to_string(), "mini".to_string()]);

        assert!(!release_surface(&mut active_surfaces, "dashboard").unwrap());
        assert!(release_surface(&mut active_surfaces, "mini").unwrap());
        assert!(active_surfaces.is_empty());
    }

    #[test]
    fn lease_helpers_reject_blank_surface_names() {
        let mut active_surfaces = HashSet::new();

        assert_eq!(
            acquire_surface(&mut active_surfaces, "   ").unwrap_err(),
            "Sensor monitoring surface is required"
        );
        assert_eq!(
            release_surface(&mut active_surfaces, "").unwrap_err(),
            "Sensor monitoring surface is required"
        );
    }
}
