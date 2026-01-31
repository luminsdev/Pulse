use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::Emitter;

mod commands;
mod models;
mod services;

use commands::{get_system_stats, has_gpu_support, hide_mini_window, show_main_window, toggle_mini_mode, MonitorState};
use services::SystemMonitor;

/// Start a background thread that emits system stats every second
fn start_stats_emitter(app: tauri::AppHandle) {
    thread::spawn(move || {
        let mut monitor = SystemMonitor::new();
        
        loop {
            // Refresh and collect stats
            monitor.refresh();
            let stats = monitor.get_system_stats();
            
            // Emit to all windows
            if let Err(e) = app.emit("system-stats", &stats) {
                eprintln!("Failed to emit system-stats: {}", e);
            }
            
            // Sleep for 1 second
            thread::sleep(Duration::from_secs(1));
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(MonitorState(Mutex::new(SystemMonitor::new())))
        .invoke_handler(tauri::generate_handler![
            get_system_stats,
            has_gpu_support,
            toggle_mini_mode,
            show_main_window,
            hide_mini_window,
        ])
        .setup(|app| {
            // Start the background stats emitter
            start_stats_emitter(app.handle().clone());
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
