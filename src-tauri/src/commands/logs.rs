/// Tauri command to return the directory containing Pulse log files.
#[tauri::command]
pub fn get_log_path() -> Result<String, String> {
    crate::utils::logging::log_dir().map(|path| path.to_string_lossy().to_string())
}
