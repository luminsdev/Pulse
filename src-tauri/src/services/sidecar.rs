//! Sidecar Manager for LibreHardwareMonitor integration
//!
//! Spawns and manages the lhm-sidecar.exe process which provides
//! CPU/GPU temperature data via LibreHardwareMonitor.

use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::Instant;
use tauri::Manager;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Data from sidecar matching the JSON output format
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

/// Sidecar status
#[derive(Debug, Clone, PartialEq)]
pub enum SidecarStatus {
    /// Not started yet
    NotStarted,
    /// Running normally
    Running,
    /// Stopped (crashed or terminated)
    Stopped,
    /// Error occurred (e.g., missing admin rights)
    Error(String),
}

/// Serializable sidecar status for frontend events
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
            SidecarStatus::Error(msg) => {
                // Detect specific error types
                if msg.to_lowercase().contains("admin")
                    || msg.to_lowercase().contains("access denied")
                    || msg.to_lowercase().contains("permission")
                {
                    SidecarStatusInfo::RequiresAdmin
                } else if msg.contains("not found") || msg.contains("binary") {
                    SidecarStatusInfo::BinaryNotFound
                } else {
                    SidecarStatusInfo::Error(msg.clone())
                }
            }
        }
    }
}

/// Thread-safe state container for sidecar data
pub struct SidecarState {
    data: RwLock<Option<SidecarData>>,
    status: RwLock<SidecarStatus>,
    restart_count: RwLock<u32>,
    last_data_time: RwLock<Option<Instant>>,
}

/// Maximum number of restart attempts before giving up
const MAX_RESTART_ATTEMPTS: u32 = 3;
/// How long to wait before considering sidecar stalled (no data received)
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

    /// Get the latest sidecar data
    pub fn get_data(&self) -> Option<SidecarData> {
        self.data.read().ok().and_then(|d| d.clone())
    }

    /// Update sidecar data
    pub fn set_data(&self, data: SidecarData) {
        // Check for error in data
        if let Some(ref err) = data.error {
            self.set_status(SidecarStatus::Error(err.clone()));
        }

        // Update last data time
        if let Ok(mut guard) = self.last_data_time.write() {
            *guard = Some(Instant::now());
        }

        if let Ok(mut guard) = self.data.write() {
            *guard = Some(data);
        }
    }

    /// Get current status
    pub fn get_status(&self) -> SidecarStatus {
        self.status
            .read()
            .ok()
            .map(|s| s.clone())
            .unwrap_or(SidecarStatus::NotStarted)
    }

    /// Get status info for frontend
    pub fn get_status_info(&self) -> SidecarStatusInfo {
        SidecarStatusInfo::from(&self.get_status())
    }

    /// Update status
    pub fn set_status(&self, status: SidecarStatus) {
        if let Ok(mut guard) = self.status.write() {
            *guard = status;
        }
    }

    /// Increment restart count and return new count
    pub fn increment_restart_count(&self) -> u32 {
        if let Ok(mut guard) = self.restart_count.write() {
            *guard += 1;
            *guard
        } else {
            0
        }
    }

    /// Reset restart count (on successful startup)
    pub fn reset_restart_count(&self) {
        if let Ok(mut guard) = self.restart_count.write() {
            *guard = 0;
        }
    }

    /// Get current restart count
    pub fn get_restart_count(&self) -> u32 {
        self.restart_count.read().ok().map(|c| *c).unwrap_or(0)
    }

    /// Check if we can attempt a restart
    pub fn can_restart(&self) -> bool {
        self.get_restart_count() < MAX_RESTART_ATTEMPTS
    }

    /// Check if sidecar is stalled (not receiving data)
    #[allow(dead_code)]
    pub fn is_stalled(&self) -> bool {
        if let Ok(guard) = self.last_data_time.read() {
            if let Some(last_time) = *guard {
                return last_time.elapsed().as_secs() > STALL_TIMEOUT_SECS;
            }
        }
        false
    }

    /// Get CPU temperature from sidecar data
    pub fn get_cpu_temperature(&self) -> Option<f32> {
        self.get_data()
            .and_then(|d| d.cpu)
            .and_then(|c| c.temperature)
    }

    /// Get CPU core temperatures
    pub fn get_cpu_core_temperatures(&self) -> Vec<Option<f32>> {
        self.get_data()
            .and_then(|d| d.cpu)
            .map(|c| c.core_temperatures)
            .unwrap_or_default()
    }

    /// Get CPU power consumption
    pub fn get_cpu_power(&self) -> Option<f32> {
        self.get_data().and_then(|d| d.cpu).and_then(|c| c.power)
    }
}

impl Default for SidecarState {
    fn default() -> Self {
        Self::new()
    }
}

/// Sidecar manager handles spawning and communication with lhm-sidecar
pub struct SidecarManager {
    state: Arc<SidecarState>,
    child: Option<Child>,
}

impl SidecarManager {
    pub fn new() -> Self {
        Self {
            state: Arc::new(SidecarState::new()),
            child: None,
        }
    }

    /// Get shared state handle
    pub fn state(&self) -> Arc<SidecarState> {
        Arc::clone(&self.state)
    }

    /// Spawn sidecar process from path
    pub fn spawn_process(&mut self, path: &std::path::Path) -> Result<(), String> {
        println!("[Sidecar] Starting: {:?}", path);

        let mut child = Command::new(path)
            .args(["--interval", "1000"]) // 1 second updates
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .creation_flags(0x08000000) // CREATE_NO_WINDOW on Windows
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

        // Get stdout handle
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to capture stdout".to_string())?;

        self.child = Some(child);
        self.state.set_status(SidecarStatus::Running);

        // Spawn thread to read output
        let state = Arc::clone(&self.state);
        thread::spawn(move || {
            let reader = BufReader::new(stdout);

            for line in reader.lines() {
                match line {
                    Ok(json_line) => {
                        let json_str: &str = json_line.trim();
                        if json_str.is_empty() {
                            continue;
                        }

                        match serde_json::from_str::<SidecarData>(json_str) {
                            Ok(data) => {
                                // Log first successful read
                                if state.get_status() != SidecarStatus::Running {
                                    println!("[Sidecar] Receiving data successfully");
                                    state.set_status(SidecarStatus::Running);
                                }
                                state.set_data(data);
                            }
                            Err(e) => {
                                eprintln!(
                                    "[Sidecar] JSON parse error: {} - Line: {}",
                                    e, json_line
                                );
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("[Sidecar] Read error: {}", e);
                        break;
                    }
                }
            }

            // Process ended
            println!("[Sidecar] Process ended");
            state.set_status(SidecarStatus::Stopped);
        });

        Ok(())
    }

    /// Stop the sidecar process
    pub fn stop(&mut self) {
        if let Some(ref mut child) = self.child {
            println!("[Sidecar] Stopping process");
            let _ = child.kill();
            let _ = child.wait();
        }
        self.child = None;
        self.state.set_status(SidecarStatus::Stopped);
    }

    /// Check if sidecar is running
    #[allow(dead_code)]
    pub fn is_running(&self) -> bool {
        matches!(self.state.get_status(), SidecarStatus::Running)
    }
}

impl Default for SidecarManager {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for SidecarManager {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Start sidecar and return shared state
/// Includes auto-restart logic with retry limit
pub fn start_sidecar(app: &tauri::AppHandle) -> Arc<SidecarState> {
    let mut manager = SidecarManager::new();
    let state = manager.state();

    // Get sidecar path once
    let sidecar_path = get_sidecar_path(app);

    match &sidecar_path {
        Ok(path) => match manager.spawn_process(path) {
            Ok(()) => {
                println!("[Sidecar] Started successfully");
                state.reset_restart_count();
            }
            Err(e) => {
                eprintln!("[Sidecar] Failed to start: {}", e);
                state.set_status(SidecarStatus::Error(e));
            }
        },
        Err(e) => {
            eprintln!("[Sidecar] Binary not found: {}", e);
            state.set_status(SidecarStatus::Error(e.clone()));
        }
    }

    // Leak manager to keep it alive
    std::mem::forget(manager);

    // Start watcher thread for auto-restart
    if let Ok(path) = sidecar_path {
        let state_clone = Arc::clone(&state);
        thread::spawn(move || {
            sidecar_watcher(state_clone, path);
        });
    }

    state
}

/// Get sidecar binary path (production or dev mode)
fn get_sidecar_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let binary_name = "lhm-sidecar-x86_64-pc-windows-msvc.exe";

    // Try 1: Production path via Tauri resource_dir
    if let Ok(resource_dir) = app.path().resource_dir() {
        let prod_path = resource_dir.join("binaries").join(binary_name);
        println!("[Sidecar] Checking production path: {:?}", prod_path);
        if prod_path.exists() {
            return Ok(prod_path);
        }
    }

    // Try 2: Development path relative to CARGO_MANIFEST_DIR (set at compile time)
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let dev_path = std::path::Path::new(manifest_dir)
        .join("binaries")
        .join(binary_name);
    println!("[Sidecar] Checking dev path: {:?}", dev_path);
    if dev_path.exists() {
        return Ok(dev_path);
    }

    // Try 3: Fallback - current_dir based paths
    if let Ok(cwd) = std::env::current_dir() {
        // If running from project root
        let root_path = cwd.join("src-tauri").join("binaries").join(binary_name);
        if root_path.exists() {
            return Ok(root_path);
        }

        // If running from src-tauri
        let src_path = cwd.join("binaries").join(binary_name);
        if src_path.exists() {
            return Ok(src_path);
        }
    }

    Err(format!(
        "Sidecar binary not found. Expected at: {:?}",
        std::path::Path::new(manifest_dir)
            .join("binaries")
            .join(binary_name)
    ))
}

/// Watcher thread that monitors sidecar and restarts if needed
fn sidecar_watcher(state: Arc<SidecarState>, path: std::path::PathBuf) {
    use std::time::Duration;

    // Wait a bit before starting to monitor
    thread::sleep(Duration::from_secs(5));

    loop {
        thread::sleep(Duration::from_secs(3));

        let status = state.get_status();

        match status {
            SidecarStatus::Stopped => {
                // Sidecar stopped - try to restart
                if state.can_restart() {
                    let count = state.increment_restart_count();
                    println!(
                        "[Sidecar] Attempting restart {}/{}",
                        count, MAX_RESTART_ATTEMPTS
                    );

                    // Wait before restart
                    thread::sleep(Duration::from_secs(2));

                    // Try to spawn new process
                    match spawn_standalone(&path, &state) {
                        Ok(()) => {
                            println!("[Sidecar] Restart successful");
                            // Reset count on successful restart after receiving data
                        }
                        Err(e) => {
                            eprintln!("[Sidecar] Restart failed: {}", e);
                            state.set_status(SidecarStatus::Error(e));
                        }
                    }
                } else {
                    println!("[Sidecar] Max restart attempts reached, giving up");
                    state.set_status(SidecarStatus::Error(format!(
                        "Sidecar crashed {} times, giving up",
                        MAX_RESTART_ATTEMPTS
                    )));
                    break; // Stop monitoring
                }
            }
            SidecarStatus::Running => {
                // Reset restart count when running successfully
                if state.get_restart_count() > 0 {
                    state.reset_restart_count();
                }
            }
            SidecarStatus::Error(_) => {
                // Error state - stop monitoring
                break;
            }
            SidecarStatus::NotStarted => {
                // Should not happen, but wait
            }
        }
    }

    println!("[Sidecar] Watcher stopped");
}

/// Spawn sidecar process standalone (for restart)
fn spawn_standalone(path: &std::path::Path, state: &Arc<SidecarState>) -> Result<(), String> {
    println!("[Sidecar] Starting: {:?}", path);

    let mut child = Command::new(path)
        .args(["--interval", "1000"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;

    state.set_status(SidecarStatus::Running);

    // Spawn reader thread
    let state_clone = Arc::clone(state);
    thread::spawn(move || {
        let reader = BufReader::new(stdout);

        for line in reader.lines() {
            match line {
                Ok(json_line) => {
                    let json_str = json_line.trim();
                    if json_str.is_empty() {
                        continue;
                    }

                    match serde_json::from_str::<SidecarData>(json_str) {
                        Ok(data) => {
                            if state_clone.get_status() != SidecarStatus::Running {
                                println!("[Sidecar] Receiving data successfully");
                                state_clone.set_status(SidecarStatus::Running);
                            }
                            state_clone.set_data(data);
                        }
                        Err(e) => {
                            eprintln!("[Sidecar] JSON parse error: {} - Line: {}", e, json_line);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[Sidecar] Read error: {}", e);
                    break;
                }
            }
        }

        println!("[Sidecar] Process ended");
        state_clone.set_status(SidecarStatus::Stopped);

        // Wait for child to fully exit
        let _ = child.wait();
    });

    Ok(())
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
