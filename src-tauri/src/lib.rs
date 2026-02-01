use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager};

mod commands;
mod models;
mod services;
mod utils;

use commands::{get_system_stats, has_gpu_support, hide_mini_window, show_main_window, toggle_mini_mode, MonitorState};
use services::{SystemMonitor, SidecarState, start_sidecar};

/// Shared state for sidecar data
pub struct AppState {
    pub sidecar: Arc<SidecarState>,
}

/// Start a background thread that emits system stats every second
/// Merges data from sysinfo (basic stats) with sidecar (temperatures)
fn start_stats_emitter(app: tauri::AppHandle, sidecar_state: Arc<SidecarState>) {
    thread::spawn(move || {
        let mut monitor = SystemMonitor::new();
        
        // Wait a bit for sidecar to be ready
        thread::sleep(Duration::from_secs(2));
        
        loop {
            // Refresh sysinfo data
            monitor.refresh();
            let mut stats = monitor.get_system_stats();
            
            // Merge temperature data from sidecar if available
            if let Some(sidecar_data) = sidecar_state.get_data() {
                // CPU temperature from sidecar
                if let Some(cpu_data) = &sidecar_data.cpu {
                    if let Some(temp) = cpu_data.temperature {
                        stats.cpu.temperature = Some(temp);
                    }
                }
                
                // GPU data from sidecar (more detailed than NVML in some cases)
                if let Some(gpu_data) = &sidecar_data.gpu {
                    if let Some(ref mut gpu) = stats.gpu {
                        // Use sidecar GPU temp if available
                        if let Some(temp) = gpu_data.temperature {
                            gpu.temperature = Some(temp as u32);
                        }
                        // Use sidecar fan speed if available and we don't have it
                        if gpu.fan_speed.is_none() {
                            if let Some(fan) = gpu_data.fan_percent {
                                gpu.fan_speed = Some(fan as u32);
                            }
                        }
                    }
                }
            }
            
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
        .plugin(tauri_plugin_shell::init())
        .manage(MonitorState(Mutex::new(SystemMonitor::new())))
        .invoke_handler(tauri::generate_handler![
            get_system_stats,
            has_gpu_support,
            toggle_mini_mode,
            show_main_window,
            hide_mini_window,
        ])
        .setup(|app| {
            println!("[App] Starting hardware monitor...");
            
            // Start the sidecar for temperature monitoring
            // The sidecar runs as elevated process and provides sensor data
            let sidecar_state = start_sidecar(app.handle());
            
            // Store sidecar state for later access
            app.manage(AppState {
                sidecar: sidecar_state.clone(),
            });
            
            // Start the background stats emitter
            start_stats_emitter(app.handle().clone(), sidecar_state);
            
            println!("[App] Initialization complete");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
