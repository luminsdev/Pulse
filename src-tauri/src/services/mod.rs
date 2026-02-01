pub mod monitor;

pub use monitor::*;

// Stub sidecar types for when sidecar is not available
use serde::Deserialize;
use std::sync::{Arc, RwLock};

/// Sidecar data structure (when available)
#[derive(Debug, Clone, Deserialize)]
pub struct SidecarData {
    pub cpu: Option<SidecarCpuData>,
    pub gpu: Option<SidecarGpuData>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SidecarCpuData {
    pub temperature: Option<f32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SidecarGpuData {
    pub temperature: Option<f32>,
    pub fan_percent: Option<f32>,
}

/// State container for sidecar data
pub struct SidecarState {
    data: RwLock<Option<SidecarData>>,
}

impl SidecarState {
    pub fn new() -> Self {
        Self {
            data: RwLock::new(None),
        }
    }

    pub fn get_data(&self) -> Option<SidecarData> {
        self.data.read().ok().and_then(|d| d.clone())
    }

    #[allow(dead_code)]
    pub fn set_data(&self, data: SidecarData) {
        if let Ok(mut guard) = self.data.write() {
            *guard = Some(data);
        }
    }
}

impl Default for SidecarState {
    fn default() -> Self {
        Self::new()
    }
}

/// Start sidecar process (currently disabled - returns empty state)
/// TODO: Implement actual sidecar for CPU temperature monitoring
pub fn start_sidecar(_app: &tauri::AppHandle) -> Arc<SidecarState> {
    println!("[Sidecar] Sidecar disabled - CPU temperature will not be available");
    println!("[Sidecar] To enable, build the hw-monitor sidecar and place in binaries/");
    Arc::new(SidecarState::new())
}
