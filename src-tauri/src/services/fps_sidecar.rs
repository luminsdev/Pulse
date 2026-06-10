//! FPS Sidecar Manager for PresentMon integration.
//!
//! Spawns and manages the fps-sidecar.exe process which provides
//! FPS data via Intel PresentMon.

use std::sync::{Arc, RwLock};
use std::thread;
use std::time::Instant;
use tauri::Emitter;

use crate::models::fps::{
    FpsData, FpsEventPayload, FpsOutput, FpsSidecarStatus, FpsSidecarStatusInfo,
};
use crate::services::sidecar_runner::{SidecarHandler, SidecarRunner, SidecarWatcherAction};

/// Thread-safe state container for FPS sidecar data.
pub struct FpsSidecarState {
    data: RwLock<Option<FpsData>>,
    status: RwLock<FpsSidecarStatus>,
    restart_count: RwLock<u32>,
    last_data_time: RwLock<Option<Instant>>,
    present_mon_installed: RwLock<bool>,
}

const MAX_RESTART_ATTEMPTS: u32 = 3;

impl FpsSidecarState {
    pub fn new() -> Self {
        Self {
            data: RwLock::new(None),
            status: RwLock::new(FpsSidecarStatus::NotStarted),
            restart_count: RwLock::new(0),
            last_data_time: RwLock::new(None),
            present_mon_installed: RwLock::new(true),
        }
    }

    pub fn get_data(&self) -> Option<FpsData> {
        self.data.read().ok().and_then(|data| data.clone())
    }

    pub fn set_data(&self, data: FpsData) {
        if let Ok(mut guard) = self.last_data_time.write() {
            *guard = Some(Instant::now());
        }
        if let Ok(mut guard) = self.data.write() {
            *guard = Some(data);
        }
    }

    pub fn clear_data(&self) {
        if let Ok(mut guard) = self.data.write() {
            *guard = None;
        }
    }

    pub fn get_status(&self) -> FpsSidecarStatus {
        self.status
            .read()
            .ok()
            .map(|status| status.clone())
            .unwrap_or(FpsSidecarStatus::NotStarted)
    }

    pub fn get_status_info(&self) -> FpsSidecarStatusInfo {
        FpsSidecarStatusInfo::from(&self.get_status())
    }

    pub fn set_status(&self, status: FpsSidecarStatus) {
        if let Ok(mut guard) = self.status.write() {
            *guard = status;
        }
    }

    pub fn is_present_mon_installed(&self) -> bool {
        self.present_mon_installed
            .read()
            .ok()
            .map(|installed| *installed)
            .unwrap_or(true)
    }

    pub fn set_present_mon_installed(&self, installed: bool) {
        if let Ok(mut guard) = self.present_mon_installed.write() {
            *guard = installed;
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

    pub fn get_event_payload(&self) -> FpsEventPayload {
        FpsEventPayload {
            status: self.get_status_info(),
            data: self.get_data(),
            present_mon_installed: self.is_present_mon_installed(),
        }
    }
}

impl Default for FpsSidecarState {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone, Default)]
pub struct FpsSidecarHandler;

impl SidecarHandler for FpsSidecarHandler {
    type State = FpsSidecarState;
    type Output = FpsOutput;

    fn label(&self) -> &'static str {
        "FPS Sidecar"
    }

    fn binary_name(&self) -> &'static str {
        "fps-sidecar-x86_64-pc-windows-msvc.exe"
    }

    fn restart_limit(&self) -> u32 {
        MAX_RESTART_ATTEMPTS
    }

    fn mark_running(&self, state: &Self::State) {
        state.set_status(FpsSidecarStatus::Running);
    }

    fn mark_stopped(&self, state: &Self::State) {
        state.set_status(FpsSidecarStatus::Stopped);
    }

    fn mark_error(&self, state: &Self::State, error: String) {
        state.set_status(FpsSidecarStatus::Error(error));
    }

    fn handle_output(&self, state: &Self::State, output: Self::Output) {
        state.set_present_mon_installed(output.present_mon_installed);

        match output.output_type.as_str() {
            "fps-data" => {
                if let Some(data) = output.data {
                    if state.get_status() != FpsSidecarStatus::Running {
                        tracing::info!("[FPS Sidecar] Receiving data");
                    }
                    state.set_status(FpsSidecarStatus::Running);
                    state.set_data(data);
                }
            }
            "no-game" => {
                state.set_status(FpsSidecarStatus::NoGame);
                state.clear_data();
            }
            "error" => {
                let message = output.error.unwrap_or_else(|| "Unknown error".to_string());
                if output.present_mon_installed {
                    state.set_status(FpsSidecarStatus::Error(message));
                } else {
                    state.set_status(FpsSidecarStatus::PresentMonNotInstalled);
                }
            }
            _ => {}
        }
    }

    fn watcher_action(&self, state: &Self::State) -> SidecarWatcherAction {
        match state.get_status() {
            FpsSidecarStatus::Stopped => SidecarWatcherAction::Restart,
            FpsSidecarStatus::Running | FpsSidecarStatus::NoGame => SidecarWatcherAction::Healthy,
            FpsSidecarStatus::Error(_) | FpsSidecarStatus::PresentMonNotInstalled => {
                SidecarWatcherAction::Stop
            }
            FpsSidecarStatus::NotStarted => SidecarWatcherAction::Wait,
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

pub type FpsSidecarManager = SidecarRunner<FpsSidecarHandler>;

/// Start FPS sidecar and return both shared state and the owned manager.
pub fn start_fps_sidecar(app: &tauri::AppHandle) -> (Arc<FpsSidecarState>, FpsSidecarManager) {
    let manager = FpsSidecarManager::new(FpsSidecarHandler, Arc::new(FpsSidecarState::new()));
    let state = manager.state();
    manager.start(app);
    (state, manager)
}

/// Start FPS stats emitter (emits fps-stats events every second).
pub fn start_fps_emitter(app: tauri::AppHandle, fps_state: Arc<FpsSidecarState>) {
    thread::spawn(move || {
        use std::time::Duration;

        thread::sleep(Duration::from_secs(3));

        loop {
            let payload = fps_state.get_event_payload();

            if let Err(error) = app.emit("fps-stats", &payload) {
                tracing::error!("Failed to emit fps-stats: {}", error);
            }

            thread::sleep(Duration::from_secs(1));
        }
    });
}
