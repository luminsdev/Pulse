use std::collections::HashSet;
use std::sync::Mutex;

use tauri::State;

use crate::{AppState, SidecarStatusPayload};

#[derive(Default)]
pub struct SensorMonitorLeaseState(pub Mutex<HashSet<String>>);

fn status_payload(state: &AppState) -> SidecarStatusPayload {
    SidecarStatusPayload {
        status: state.sensors.status_info(),
        restart_count: 0,
        can_restart: true,
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
pub fn start_sensor_monitoring(state: State<'_, AppState>) -> Result<(), String> {
    state.sensors.poll();
    Ok(())
}

#[tauri::command]
pub fn acquire_sensor_monitoring(
    surface: String,
    leases: State<'_, SensorMonitorLeaseState>,
) -> Result<(), String> {
    acquire_sensor_monitoring_surface(&surface, &leases)
}

pub fn acquire_sensor_monitoring_surface(
    surface: &str,
    leases: &SensorMonitorLeaseState,
) -> Result<(), String> {
    let mut active_surfaces = leases
        .0
        .lock()
        .map_err(|_| "Failed to access sensor monitor lease state".to_string())?;

    acquire_surface(&mut active_surfaces, surface)?;
    Ok(())
}

#[tauri::command]
pub fn release_sensor_monitoring(
    surface: String,
    leases: State<'_, SensorMonitorLeaseState>,
) -> Result<(), String> {
    release_sensor_monitoring_surface(&surface, &leases)
}

pub fn release_sensor_monitoring_surface(
    surface: &str,
    leases: &SensorMonitorLeaseState,
) -> Result<(), String> {
    let mut active_surfaces = leases
        .0
        .lock()
        .map_err(|_| "Failed to access sensor monitor lease state".to_string())?;

    release_surface(&mut active_surfaces, surface)?;
    Ok(())
}

#[tauri::command]
pub fn get_sensor_monitoring_status(state: State<'_, AppState>) -> SidecarStatusPayload {
    status_payload(&state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn acquire_surface_reports_when_first_surface_is_added() {
        let mut active_surfaces = HashSet::new();

        assert!(acquire_surface(&mut active_surfaces, "dashboard").unwrap());
        assert!(!acquire_surface(&mut active_surfaces, "mini").unwrap());
        assert!(!acquire_surface(&mut active_surfaces, "dashboard").unwrap());
        assert_eq!(active_surfaces.len(), 2);
    }

    #[test]
    fn release_surface_reports_when_last_surface_is_removed() {
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

    #[test]
    fn lease_surface_commands_track_surfaces_without_a_sidecar_process() {
        let leases = SensorMonitorLeaseState::default();

        acquire_sensor_monitoring_surface("dashboard", &leases).unwrap();
        acquire_sensor_monitoring_surface("mini", &leases).unwrap();

        {
            let active_surfaces = leases.0.lock().unwrap();
            assert!(active_surfaces.contains("dashboard"));
            assert!(active_surfaces.contains("mini"));
        }

        release_sensor_monitoring_surface("dashboard", &leases).unwrap();
        release_sensor_monitoring_surface("mini", &leases).unwrap();

        assert!(leases.0.lock().unwrap().is_empty());
    }
}
