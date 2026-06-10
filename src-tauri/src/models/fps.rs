//! FPS statistics models for PresentMon integration

use serde::{Deserialize, Serialize};

/// FPS data from a game/application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FpsData {
    /// Name of the monitored process
    pub process_name: String,
    /// Process ID
    pub process_id: i32,
    /// Current FPS (frames per second)
    pub fps: f64,
    /// Average frame time in milliseconds
    pub frame_time: f64,
    /// 1% low FPS (worst 1% of frames)
    pub fps_1_percent_low: f64,
    /// 0.1% low FPS (worst 0.1% of frames)
    pub fps_01_percent_low: f64,
    /// Timestamp in milliseconds
    pub timestamp: i64,
}

/// Output from fps-sidecar
#[derive(Debug, Clone, Deserialize)]
pub struct FpsOutput {
    /// Type of message: "fps-data", "error", "no-game"
    #[serde(rename = "type")]
    pub output_type: String,
    /// FPS data (when type is "fps-data")
    pub data: Option<FpsData>,
    /// Error message (when type is "error")
    pub error: Option<String>,
    /// Whether PresentMon is installed
    #[serde(default = "default_true")]
    pub present_mon_installed: bool,
}

fn default_true() -> bool {
    true
}

/// FPS sidecar status
#[derive(Debug, Clone, PartialEq)]
pub enum FpsSidecarStatus {
    /// Not started yet
    NotStarted,
    /// Running and receiving data
    Running,
    /// Running but no game detected
    NoGame,
    /// Stopped (crashed or terminated)
    Stopped,
    /// Error occurred
    Error(String),
    /// PresentMon not installed
    PresentMonNotInstalled,
}

/// Serializable FPS sidecar status for frontend events
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", content = "message")]
pub enum FpsSidecarStatusInfo {
    #[serde(rename = "not_started")]
    NotStarted,
    #[serde(rename = "running")]
    Running,
    #[serde(rename = "no_game")]
    NoGame,
    #[serde(rename = "stopped")]
    Stopped,
    #[serde(rename = "error")]
    Error(String),
    #[serde(rename = "not_installed")]
    PresentMonNotInstalled,
}

impl From<&FpsSidecarStatus> for FpsSidecarStatusInfo {
    fn from(status: &FpsSidecarStatus) -> Self {
        match status {
            FpsSidecarStatus::NotStarted => FpsSidecarStatusInfo::NotStarted,
            FpsSidecarStatus::Running => FpsSidecarStatusInfo::Running,
            FpsSidecarStatus::NoGame => FpsSidecarStatusInfo::NoGame,
            FpsSidecarStatus::Stopped => FpsSidecarStatusInfo::Stopped,
            FpsSidecarStatus::Error(msg) => FpsSidecarStatusInfo::Error(msg.clone()),
            FpsSidecarStatus::PresentMonNotInstalled => {
                FpsSidecarStatusInfo::PresentMonNotInstalled
            }
        }
    }
}

/// Event payload for frontend
#[derive(Debug, Clone, Serialize)]
pub struct FpsEventPayload {
    /// Current status
    #[serde(flatten)]
    pub status: FpsSidecarStatusInfo,
    /// FPS data (if available)
    pub data: Option<FpsData>,
    /// Whether PresentMon is installed
    pub present_mon_installed: bool,
}
