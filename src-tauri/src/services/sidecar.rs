//! Sidecar Manager for LibreHardwareMonitor integration.
//!
//! Spawns and manages the lhm-sidecar.exe process which provides
//! CPU/GPU temperature data via LibreHardwareMonitor.

use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use std::time::Instant;

use crate::services::sidecar_runner::{SidecarHandler, SidecarRunner, SidecarWatcherAction};

/// Data from sidecar matching the JSON output format.
#[derive(Debug, Clone, Deserialize)]
pub struct SidecarData {
    pub cpu: Option<SidecarCpuData>,
    #[serde(default)]
    pub gpu: Vec<SidecarGpuData>,
    pub timestamp: i64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SidecarCpuData {
    pub name: Option<String>,
    pub temperature: Option<f32>,
    pub package_temperature: Option<f32>,
    #[serde(default)]
    pub core_temperatures: Vec<Option<f32>>,
    pub max_temperature: Option<f32>,
    pub power: Option<f32>,
    #[serde(default)]
    pub core_powers: Vec<Option<f32>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SidecarGpuData {
    pub name: Option<String>,
    pub vendor: Option<String>,
    pub temperature: Option<f32>,
    pub hot_spot_temperature: Option<f32>,
    pub power: Option<f32>,
    pub core_clock: Option<f32>,
    pub memory_clock: Option<f32>,
    pub fan_speed: Option<f32>,
    pub load: Option<f32>,
}

/// Sidecar status.
#[derive(Debug, Clone, PartialEq)]
pub enum SidecarStatus {
    NotStarted,
    Running,
    Stopped,
    Error(String),
}

/// Serializable sidecar status for frontend events.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", content = "message")]
pub enum SidecarStatusInfo {
    #[serde(rename = "not_started")]
    NotStarted,
    #[serde(rename = "running")]
    Running,
    #[serde(rename = "stopped")]
    Stopped,
    #[serde(rename = "error")]
    Error(String),
    #[serde(rename = "requires_admin")]
    RequiresAdmin,
    #[serde(rename = "binary_not_found")]
    BinaryNotFound,
}

impl From<&SidecarStatus> for SidecarStatusInfo {
    fn from(status: &SidecarStatus) -> Self {
        match status {
            SidecarStatus::NotStarted => SidecarStatusInfo::NotStarted,
            SidecarStatus::Running => SidecarStatusInfo::Running,
            SidecarStatus::Stopped => SidecarStatusInfo::Stopped,
            SidecarStatus::Error(message) => {
                let lower_message = message.to_lowercase();
                if lower_message.contains("admin")
                    || lower_message.contains("access denied")
                    || lower_message.contains("permission")
                {
                    SidecarStatusInfo::RequiresAdmin
                } else if message.contains("not found") || message.contains("binary") {
                    SidecarStatusInfo::BinaryNotFound
                } else {
                    SidecarStatusInfo::Error(message.clone())
                }
            }
        }
    }
}

/// Thread-safe state container for sidecar data.
pub struct SidecarState {
    data: RwLock<Option<SidecarData>>,
    status: RwLock<SidecarStatus>,
    restart_count: RwLock<u32>,
    last_data_time: RwLock<Option<Instant>>,
}

const MAX_RESTART_ATTEMPTS: u32 = 3;
const STALL_TIMEOUT_SECS: u64 = 10;

impl SidecarState {
    pub fn new() -> Self {
        Self {
            data: RwLock::new(None),
            status: RwLock::new(SidecarStatus::NotStarted),
            restart_count: RwLock::new(0),
            last_data_time: RwLock::new(None),
        }
    }

    pub fn get_data(&self) -> Option<SidecarData> {
        self.data.read().ok().and_then(|data| data.clone())
    }

    pub fn set_data(&self, data: SidecarData) {
        if let Some(error) = &data.error {
            self.set_status(SidecarStatus::Error(error.clone()));
        }

        if let Ok(mut guard) = self.last_data_time.write() {
            *guard = Some(Instant::now());
        }

        if let Ok(mut guard) = self.data.write() {
            *guard = Some(data);
        }
    }

    pub fn get_status(&self) -> SidecarStatus {
        self.status
            .read()
            .ok()
            .map(|status| status.clone())
            .unwrap_or(SidecarStatus::NotStarted)
    }

    pub fn get_status_info(&self) -> SidecarStatusInfo {
        SidecarStatusInfo::from(&self.get_status())
    }

    pub fn set_status(&self, status: SidecarStatus) {
        if let Ok(mut guard) = self.status.write() {
            *guard = status;
        }
    }

    pub fn increment_restart_count(&self) -> u32 {
        if let Ok(mut guard) = self.restart_count.write() {
            *guard += 1;
            *guard
        } else {
            0
        }
    }

    pub fn reset_restart_count(&self) {
        if let Ok(mut guard) = self.restart_count.write() {
            *guard = 0;
        }
    }

    pub fn get_restart_count(&self) -> u32 {
        self.restart_count
            .read()
            .ok()
            .map(|count| *count)
            .unwrap_or(0)
    }

    pub fn can_restart(&self) -> bool {
        self.get_restart_count() < MAX_RESTART_ATTEMPTS
    }

    #[allow(dead_code)]
    pub fn is_stalled(&self) -> bool {
        if let Ok(guard) = self.last_data_time.read() {
            if let Some(last_time) = *guard {
                return last_time.elapsed().as_secs() > STALL_TIMEOUT_SECS;
            }
        }
        false
    }

    pub fn get_cpu_temperature(&self) -> Option<f32> {
        self.get_data()
            .and_then(|data| data.cpu)
            .and_then(|cpu| cpu.temperature)
    }

    pub fn get_cpu_core_temperatures(&self) -> Vec<Option<f32>> {
        self.get_data()
            .and_then(|data| data.cpu)
            .map(|cpu| cpu.core_temperatures)
            .unwrap_or_default()
    }

    pub fn get_cpu_power(&self) -> Option<f32> {
        self.get_data()
            .and_then(|data| data.cpu)
            .and_then(|cpu| cpu.power)
    }
}

impl Default for SidecarState {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone, Default)]
pub struct LhmSidecarHandler;

impl SidecarHandler for LhmSidecarHandler {
    type State = SidecarState;
    type Output = SidecarData;

    fn label(&self) -> &'static str {
        "Sidecar"
    }

    fn binary_name(&self) -> &'static str {
        "lhm-sidecar-x86_64-pc-windows-msvc.exe"
    }

    fn args(&self) -> &'static [&'static str] {
        &["--interval", "1000"]
    }

    fn restart_limit(&self) -> u32 {
        MAX_RESTART_ATTEMPTS
    }

    fn mark_running(&self, state: &Self::State) {
        state.set_status(SidecarStatus::Running);
    }

    fn mark_stopped(&self, state: &Self::State) {
        state.set_status(SidecarStatus::Stopped);
    }

    fn mark_error(&self, state: &Self::State, error: String) {
        state.set_status(SidecarStatus::Error(error));
    }

    fn handle_output(&self, state: &Self::State, output: Self::Output) {
        if state.get_status() != SidecarStatus::Running {
            tracing::info!("[Sidecar] Receiving data successfully");
            state.set_status(SidecarStatus::Running);
        }
        state.set_data(output);
    }

    fn watcher_action(&self, state: &Self::State) -> SidecarWatcherAction {
        match state.get_status() {
            SidecarStatus::Running => SidecarWatcherAction::Healthy,
            SidecarStatus::Stopped => SidecarWatcherAction::Restart,
            SidecarStatus::Error(_) => SidecarWatcherAction::Stop,
            SidecarStatus::NotStarted => SidecarWatcherAction::Wait,
        }
    }

    fn can_restart(&self, state: &Self::State) -> bool {
        state.can_restart()
    }

    fn increment_restart_count(&self, state: &Self::State) -> u32 {
        state.increment_restart_count()
    }

    fn reset_restart_count(&self, state: &Self::State) {
        state.reset_restart_count();
    }

    fn restart_count(&self, state: &Self::State) -> u32 {
        state.get_restart_count()
    }
}

pub type SidecarManager = SidecarRunner<LhmSidecarHandler>;

/// Start sidecar and return both shared state and the owned manager.
pub fn start_sidecar(app: &tauri::AppHandle) -> (Arc<SidecarState>, SidecarManager) {
    let manager = SidecarManager::new(LhmSidecarHandler, Arc::new(SidecarState::new()));
    let state = manager.state();
    manager.start(app);
    (state, manager)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sidecar_state() {
        let state = SidecarState::new();
        assert!(state.get_data().is_none());
        assert_eq!(state.get_status(), SidecarStatus::NotStarted);
    }

    #[test]
    fn test_parse_sidecar_json() {
        let json = r#"{"cpu":{"name":"Intel Core i5","temperature":65.0,"package_temperature":65.0,"core_temperatures":[60.0,62.0],"power":35.5},"gpu":[],"timestamp":1234567890}"#;
        let data: SidecarData = serde_json::from_str(json).unwrap();
        assert!(data.cpu.is_some());
        assert_eq!(data.cpu.as_ref().unwrap().temperature, Some(65.0));
    }

    #[test]
    fn test_parse_error_json() {
        let json = r#"{"gpu":[],"timestamp":1234567890,"error":"Admin rights required"}"#;
        let data: SidecarData = serde_json::from_str(json).unwrap();
        assert!(data.error.is_some());
    }
}
