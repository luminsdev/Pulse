//! Generic sidecar process runner.

use serde::de::DeserializeOwned;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::Manager;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Windows CREATE_NO_WINDOW flag used for bundled console sidecars.
pub const CREATE_NO_WINDOW: u32 = 0x08000000;

const WATCHER_START_DELAY_SECS: u64 = 5;
const WATCHER_INTERVAL_SECS: u64 = 3;
const RESTART_DELAY_SECS: u64 = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SidecarWatcherAction {
    Healthy,
    Restart,
    Stop,
    Wait,
}

pub trait SidecarHandler: Clone + Send + Sync + 'static {
    type State: Send + Sync + 'static;
    type Output: DeserializeOwned + Send + 'static;

    fn label(&self) -> &'static str;
    fn binary_name(&self) -> &'static str;
    fn args(&self) -> &'static [&'static str] {
        &[]
    }
    fn restart_limit(&self) -> u32;
    fn mark_running(&self, state: &Self::State);
    fn mark_stopped(&self, state: &Self::State);
    fn mark_error(&self, state: &Self::State, error: String);
    fn handle_output(&self, state: &Self::State, output: Self::Output);
    fn watcher_action(&self, state: &Self::State) -> SidecarWatcherAction;
    fn can_restart(&self, state: &Self::State) -> bool;
    fn increment_restart_count(&self, state: &Self::State) -> u32;
    fn reset_restart_count(&self, state: &Self::State);
    fn restart_count(&self, state: &Self::State) -> u32;
}

pub struct SidecarRunner<H: SidecarHandler> {
    handler: H,
    state: Arc<H::State>,
    child: Arc<Mutex<Option<Child>>>,
    stop_requested: Arc<AtomicBool>,
}

impl<H: SidecarHandler> SidecarRunner<H> {
    pub fn new(handler: H, state: Arc<H::State>) -> Self {
        Self {
            handler,
            state,
            child: Arc::new(Mutex::new(None)),
            stop_requested: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn state(&self) -> Arc<H::State> {
        Arc::clone(&self.state)
    }

    pub fn start(&self, app: &tauri::AppHandle) {
        let path = self.resolve_binary_path(app);

        match &path {
            Ok(path) => match self.spawn_process(path) {
                Ok(()) => {
                    tracing::info!("[{}] Started successfully", self.handler.label());
                    self.handler.reset_restart_count(&self.state);
                }
                Err(error) => {
                    tracing::error!("[{}] Failed to start: {}", self.handler.label(), error);
                    self.handler.mark_error(&self.state, error);
                }
            },
            Err(error) => {
                tracing::error!("[{}] Binary not found: {}", self.handler.label(), error);
                self.handler.mark_error(&self.state, error.clone());
            }
        }

        if let Ok(path) = path {
            self.start_watcher(path);
        }
    }

    pub fn spawn_process(&self, path: &Path) -> Result<(), String> {
        self.stop_requested.store(false, Ordering::SeqCst);
        spawn_child(
            self.handler.clone(),
            Arc::clone(&self.state),
            Arc::clone(&self.child),
            Arc::clone(&self.stop_requested),
            path,
        )
    }

    #[cfg(test)]
    pub fn process_line(&self, line: &str) -> Result<bool, serde_json::Error> {
        let json = line.trim();
        if json.is_empty() {
            return Ok(false);
        }

        let output = serde_json::from_str::<H::Output>(json)?;
        self.handler.handle_output(&self.state, output);
        Ok(true)
    }

    pub fn stop(&self) {
        self.stop_requested.store(true, Ordering::SeqCst);

        if let Ok(mut guard) = self.child.lock() {
            if let Some(mut child) = guard.take() {
                tracing::info!("[{}] Stopping process", self.handler.label());
                let _ = child.kill();
                let _ = child.wait();
            }
        }

        self.handler.mark_stopped(&self.state);
    }

    fn resolve_binary_path(&self, app: &tauri::AppHandle) -> Result<PathBuf, String> {
        let binary_name = self.handler.binary_name();

        if let Ok(resource_dir) = app.path().resource_dir() {
            let prod_path = resource_dir.join("binaries").join(binary_name);
            tracing::info!(
                "[{}] Checking production path: {:?}",
                self.handler.label(),
                prod_path
            );
            if prod_path.exists() {
                return Ok(prod_path);
            }
        }

        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        let dev_path = Path::new(manifest_dir).join("binaries").join(binary_name);
        tracing::info!(
            "[{}] Checking dev path: {:?}",
            self.handler.label(),
            dev_path
        );
        if dev_path.exists() {
            return Ok(dev_path);
        }

        if let Ok(cwd) = std::env::current_dir() {
            let root_path = cwd.join("src-tauri").join("binaries").join(binary_name);
            if root_path.exists() {
                return Ok(root_path);
            }

            let src_path = cwd.join("binaries").join(binary_name);
            if src_path.exists() {
                return Ok(src_path);
            }
        }

        Err(format!(
            "Sidecar binary not found. Expected at: {:?}",
            Path::new(manifest_dir).join("binaries").join(binary_name)
        ))
    }

    fn start_watcher(&self, path: PathBuf) {
        let handler = self.handler.clone();
        let state = Arc::clone(&self.state);
        let child = Arc::clone(&self.child);
        let stop_requested = Arc::clone(&self.stop_requested);

        thread::spawn(move || {
            thread::sleep(Duration::from_secs(WATCHER_START_DELAY_SECS));

            while !stop_requested.load(Ordering::SeqCst) {
                thread::sleep(Duration::from_secs(WATCHER_INTERVAL_SECS));

                match handler.watcher_action(&state) {
                    SidecarWatcherAction::Restart => {
                        if handler.can_restart(&state) {
                            let count = handler.increment_restart_count(&state);
                            tracing::info!(
                                "[{}] Attempting restart {}/{}",
                                handler.label(),
                                count,
                                handler.restart_limit()
                            );
                            thread::sleep(Duration::from_secs(RESTART_DELAY_SECS));

                            match spawn_child(
                                handler.clone(),
                                Arc::clone(&state),
                                Arc::clone(&child),
                                Arc::clone(&stop_requested),
                                &path,
                            ) {
                                Ok(()) => tracing::info!("[{}] Restart successful", handler.label()),
                                Err(error) => {
                                    tracing::error!("[{}] Restart failed: {}", handler.label(), error);
                                    handler.mark_error(&state, error);
                                }
                            }
                        } else {
                            tracing::warn!(
                                "[{}] Max restart attempts reached, giving up",
                                handler.label()
                            );
                            handler.mark_error(
                                &state,
                                format!(
                                    "Sidecar crashed {} times, giving up",
                                    handler.restart_limit()
                                ),
                            );
                            break;
                        }
                    }
                    SidecarWatcherAction::Healthy => {
                        if handler.restart_count(&state) > 0 {
                            handler.reset_restart_count(&state);
                        }
                    }
                    SidecarWatcherAction::Stop => break,
                    SidecarWatcherAction::Wait => {}
                }
            }

            tracing::info!("[{}] Watcher stopped", handler.label());
        });
    }
}

impl<H: SidecarHandler> Drop for SidecarRunner<H> {
    fn drop(&mut self) {
        self.stop();
    }
}

fn spawn_child<H: SidecarHandler>(
    handler: H,
    state: Arc<H::State>,
    child_slot: Arc<Mutex<Option<Child>>>,
    stop_requested: Arc<AtomicBool>,
    path: &Path,
) -> Result<(), String> {
    tracing::info!("[{}] Starting: {:?}", handler.label(), path);

    let mut command = Command::new(path);
    command
        .args(handler.args())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to spawn sidecar: {}", error))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;

    {
        let mut guard = child_slot
            .lock()
            .map_err(|error| format!("Failed to lock child process: {}", error))?;
        if let Some(mut existing_child) = guard.take() {
            let _ = existing_child.kill();
            let _ = existing_child.wait();
        }
        *guard = Some(child);
    }

    handler.mark_running(&state);

    thread::spawn(move || {
        let reader = BufReader::new(stdout);

        for line in reader.lines() {
            match line {
                Ok(json_line) => {
                    let json = json_line.trim();
                    if json.is_empty() {
                        continue;
                    }

                    match serde_json::from_str::<H::Output>(json) {
                        Ok(output) => handler.handle_output(&state, output),
                        Err(error) => tracing::error!(
                            "[{}] JSON parse error: {} - Line: {}",
                            handler.label(),
                            error,
                            json_line
                        ),
                    }
                }
                Err(error) => {
                    tracing::error!("[{}] Read error: {}", handler.label(), error);
                    break;
                }
            }
        }

        tracing::info!("[{}] Process ended", handler.label());

        if let Ok(mut guard) = child_slot.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.wait();
            }
        }

        if !stop_requested.load(Ordering::SeqCst) {
            handler.mark_stopped(&state);
        }
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;
    use std::sync::RwLock;

    #[derive(Clone)]
    struct TestHandler;

    #[derive(Default)]
    struct TestState {
        value: RwLock<Option<String>>,
        running: RwLock<bool>,
        restarts: RwLock<u32>,
    }

    #[derive(Deserialize)]
    struct TestOutput {
        value: String,
    }

    impl SidecarHandler for TestHandler {
        type State = TestState;
        type Output = TestOutput;

        fn label(&self) -> &'static str {
            "Test Sidecar"
        }

        fn binary_name(&self) -> &'static str {
            "test-sidecar.exe"
        }

        fn restart_limit(&self) -> u32 {
            3
        }

        fn mark_running(&self, state: &Self::State) {
            *state.running.write().unwrap() = true;
        }

        fn mark_stopped(&self, state: &Self::State) {
            *state.running.write().unwrap() = false;
        }

        fn mark_error(&self, state: &Self::State, _error: String) {
            *state.running.write().unwrap() = false;
        }

        fn handle_output(&self, state: &Self::State, output: Self::Output) {
            *state.value.write().unwrap() = Some(output.value);
        }

        fn watcher_action(&self, state: &Self::State) -> SidecarWatcherAction {
            if *state.running.read().unwrap() {
                SidecarWatcherAction::Healthy
            } else {
                SidecarWatcherAction::Restart
            }
        }

        fn can_restart(&self, state: &Self::State) -> bool {
            *state.restarts.read().unwrap() < self.restart_limit()
        }

        fn increment_restart_count(&self, state: &Self::State) -> u32 {
            let mut restarts = state.restarts.write().unwrap();
            *restarts += 1;
            *restarts
        }

        fn reset_restart_count(&self, state: &Self::State) {
            *state.restarts.write().unwrap() = 0;
        }

        fn restart_count(&self, state: &Self::State) -> u32 {
            *state.restarts.read().unwrap()
        }
    }

    #[test]
    fn process_line_updates_state_for_valid_json() {
        let state = Arc::new(TestState::default());
        let runner = SidecarRunner::new(TestHandler, Arc::clone(&state));

        let processed = runner.process_line(r#"{"value":"ok"}"#).unwrap();

        assert!(processed);
        assert_eq!(state.value.read().unwrap().as_deref(), Some("ok"));
    }

    #[test]
    fn process_line_ignores_empty_strings() {
        let state = Arc::new(TestState::default());
        let runner = SidecarRunner::new(TestHandler, Arc::clone(&state));

        let processed = runner.process_line("   ").unwrap();

        assert!(!processed);
        assert!(state.value.read().unwrap().is_none());
    }

    #[test]
    fn process_line_rejects_malformed_json() {
        let state = Arc::new(TestState::default());
        let runner = SidecarRunner::new(TestHandler, Arc::clone(&state));

        let error = runner.process_line("not json").unwrap_err();

        assert!(error.is_syntax());
    }

    #[test]
    fn process_line_rejects_missing_required_fields() {
        let state = Arc::new(TestState::default());
        let runner = SidecarRunner::new(TestHandler, Arc::clone(&state));

        let error = runner.process_line(r#"{"other":"value"}"#).unwrap_err();

        assert!(error.is_data());
    }

    #[test]
    fn watcher_action_tracks_state_transitions() {
        let state = TestState::default();
        let handler = TestHandler;

        assert_eq!(handler.watcher_action(&state), SidecarWatcherAction::Restart);
        handler.mark_running(&state);
        assert_eq!(handler.watcher_action(&state), SidecarWatcherAction::Healthy);
        handler.mark_stopped(&state);
        assert_eq!(handler.watcher_action(&state), SidecarWatcherAction::Restart);
    }
}
