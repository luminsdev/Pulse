use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{
    Emitter, Manager,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    menu::{Menu, MenuItem},
};

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

/// Setup system tray with menu
fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Create menu items
    let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let mini_item = MenuItem::with_id(app, "mini", "Mini Mode", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    
    // Create menu
    let menu = Menu::with_items(app, &[&show_item, &mini_item, &quit_item])?;
    
    // Load tray icon - use include_bytes for embedded icon
    let icon_bytes = include_bytes!("../icons/32x32.png");
    let icon = tauri::image::Image::from_bytes(icon_bytes)
        .expect("Failed to load tray icon");
    
    // Build tray
    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("Hardware Monitor")
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "mini" => {
                    // Toggle to mini mode
                    if let Some(main) = app.get_webview_window("main") {
                        let _ = main.hide();
                    }
                    if let Some(mini) = app.get_webview_window("mini") {
                        let _ = mini.show();
                        let _ = mini.set_focus();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            // Left click on tray icon -> show main window
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;
    
    println!("[Tray] System tray initialized");
    Ok(())
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
            
            // Setup system tray
            if let Err(e) = setup_tray(app) {
                eprintln!("[Tray] Failed to setup tray: {}", e);
            }
            
            // Start the sidecar for temperature monitoring
            // The sidecar runs as elevated process and provides sensor data
            let sidecar_state = start_sidecar(app.handle());
            
            // Store sidecar state for later access
            app.manage(AppState {
                sidecar: sidecar_state.clone(),
            });
            
            // Start the background stats emitter
            start_stats_emitter(app.handle().clone(), sidecar_state);
            
            // Handle window close event - hide to tray instead of quit
            let main_window = app.get_webview_window("main");
            if let Some(window) = main_window {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        // Prevent the window from closing, hide it instead
                        api.prevent_close();
                        let _ = window_clone.hide();
                        println!("[App] Main window hidden to tray");
                    }
                });
            }
            
            println!("[App] Initialization complete");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
