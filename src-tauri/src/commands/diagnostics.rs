use std::sync::Mutex;

use tauri::State;

use crate::models::TelemetryDiagnosticsPayload;
use crate::services::TelemetryDiagnosticsService;

pub struct TelemetryDiagnosticsState(pub Mutex<TelemetryDiagnosticsService>);

#[tauri::command]
pub fn get_telemetry_diagnostics(
    state: State<'_, TelemetryDiagnosticsState>,
) -> Result<TelemetryDiagnosticsPayload, String> {
    let mut service = state
        .0
        .lock()
        .map_err(|_| "Failed to access telemetry diagnostics".to_string())?;

    Ok(service.snapshot())
}
