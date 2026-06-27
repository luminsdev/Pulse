use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

mod commands;
mod models;
mod services;
mod utils;

use commands::{
    acquire_sensor_monitoring, acquire_sensor_monitoring_surface, get_fps_monitoring_status,
    get_log_path, get_sensor_monitoring_status, get_system_stats, get_telemetry_diagnostics,
    has_gpu_support, hide_mini_window, release_sensor_monitoring,
    release_sensor_monitoring_surface, show_main_window, start_fps_monitoring,
    start_sensor_monitoring, stop_fps_monitoring, toggle_mini_mode, MonitorState,
    SensorMonitorLeaseState, TelemetryDiagnosticsState,
};
use services::{
    create_fps_sidecar, create_sidecar, start_fps_emitter, FpsSidecarManager, FpsSidecarState,
    SidecarManager, SidecarState, SidecarStatusInfo, SystemMonitor, TelemetryDiagnosticsService,
};

use models::GpuStats;

/// Shared state for sidecar data
pub struct AppState {
    pub sidecar: Arc<SidecarState>,
    pub fps_sidecar: Arc<FpsSidecarState>,
}

/// Payload for sidecar status event
#[derive(serde::Serialize, Clone)]
pub(crate) struct SidecarStatusPayload {
    #[serde(flatten)]
    pub(crate) status: SidecarStatusInfo,
    pub(crate) restart_count: u32,
    pub(crate) can_restart: bool,
}

/// Start a background thread that emits system stats every second
/// Merges data from sysinfo (basic stats) with sidecar (temperatures)
fn start_stats_emitter(app: tauri::AppHandle, sidecar_state: Arc<SidecarState>) {
    thread::spawn(move || {
        let mut monitor = SystemMonitor::new();

        // Wait a bit for sidecar to be ready
        thread::sleep(Duration::from_secs(2));

        monitor.refresh_stats();
        if let Err(e) = app.emit("system-info", monitor.get_system_info()) {
            tracing::error!("Failed to emit system-info: {}", e);
        }

        monitor.refresh_processes();
        if let Err(e) = app.emit("process-list", monitor.get_top_processes(10)) {
            tracing::error!("Failed to emit process-list: {}", e);
        }

        let mut process_refresh_tick = 0_u8;

        loop {
            // Refresh sysinfo data
            monitor.refresh_stats();
            let mut stats = monitor.get_system_stats_payload();

            // Merge temperature data from sidecar if available
            if let Some(sidecar_data) = sidecar_state.get_data() {
                // CPU temperature from sidecar
                if let Some(cpu_data) = &sidecar_data.cpu {
                    stats.cpu.temperature = cpu_data.temperature;
                    stats.cpu.power = cpu_data.power;

                    // Core temperatures - filter out None values
                    if !cpu_data.core_temperatures.is_empty() {
                        let temps: Vec<f32> = cpu_data
                            .core_temperatures
                            .iter()
                            .filter_map(|t| *t)
                            .collect();
                        if !temps.is_empty() {
                            stats.cpu.core_temperatures = Some(temps);
                        }
                    }
                }

                // GPU data from sidecar (first GPU if available)
                if let Some(gpu_data) = sidecar_data.gpu.first() {
                    if let Some(ref mut gpu) = stats.gpu {
                        // Use sidecar GPU temp if available
                        if let Some(temp) = gpu_data.temperature {
                            gpu.temperature = Some(temp);
                        }
                        // Hot spot temperature
                        gpu.hot_spot_temperature = gpu_data.hot_spot_temperature;
                        // Power consumption
                        gpu.power = gpu_data.power;
                        // Core clock
                        gpu.core_clock = gpu_data.core_clock;
                        // Memory clock
                        gpu.memory_clock = gpu_data.memory_clock;
                        // Use sidecar fan speed if available and we don't have it
                        if gpu.fan_speed.is_none() {
                            gpu.fan_speed = gpu_data.fan_speed;
                        }
                    } else {
                        stats.gpu = Some(GpuStats {
                            name: gpu_data
                                .name
                                .clone()
                                .or_else(|| {
                                    gpu_data
                                        .vendor
                                        .as_ref()
                                        .map(|vendor| format!("{} GPU", vendor))
                                })
                                .unwrap_or_else(|| "Unknown GPU".to_string()),
                            usage: gpu_data.load.unwrap_or(0.0),
                            memory_total: 0,
                            memory_used: 0,
                            temperature: gpu_data.temperature,
                            hot_spot_temperature: gpu_data.hot_spot_temperature,
                            fan_speed: gpu_data.fan_speed,
                            power: gpu_data.power,
                            core_clock: gpu_data.core_clock,
                            memory_clock: gpu_data.memory_clock,
                        });
                    }
                }
            }

            // Emit to all windows
            if let Err(e) = app.emit("system-stats", &stats) {
                tracing::error!("Failed to emit system-stats: {}", e);
            }

            process_refresh_tick = process_refresh_tick.saturating_add(1);
            if process_refresh_tick >= 4 {
                monitor.refresh_processes();
                if let Err(e) = app.emit("process-list", monitor.get_top_processes(10)) {
                    tracing::error!("Failed to emit process-list: {}", e);
                }
                process_refresh_tick = 0;
            }

            // Emit sidecar status
            let status_payload = SidecarStatusPayload {
                status: sidecar_state.get_status_info(),
                restart_count: sidecar_state.get_restart_count(),
                can_restart: sidecar_state.can_restart(),
            };
            let _ = app.emit("sidecar-status", &status_payload);

            // Sleep for 1 second
            thread::sleep(Duration::from_secs(1));
        }
    });
}

fn stop_managed_sidecars(app: &tauri::AppHandle) {
    if let Some(manager) = app.try_state::<Mutex<SidecarManager>>() {
        if let Ok(manager) = manager.lock() {
            manager.stop();
        }
    }

    if let Some(manager) = app.try_state::<Mutex<FpsSidecarManager>>() {
        if let Ok(manager) = manager.lock() {
            manager.stop();
        }
    }
}

fn request_graceful_shutdown(app: &tauri::AppHandle) {
    stop_managed_sidecars(app);
    app.exit(0);
}

fn with_sensor_lifecycle_state<F>(app: &tauri::AppHandle, action: &str, update: F)
where
    F: FnOnce(&SensorMonitorLeaseState, &Mutex<SidecarManager>) -> Result<(), String>,
{
    let Some(leases) = app.try_state::<SensorMonitorLeaseState>() else {
        tracing::warn!(
            "[App] Cannot {} sensor monitoring before leases are ready",
            action
        );
        return;
    };
    let Some(manager) = app.try_state::<Mutex<SidecarManager>>() else {
        tracing::warn!(
            "[App] Cannot {} sensor monitoring before sidecar is ready",
            action
        );
        return;
    };

    if let Err(error) = update(&leases, &manager) {
        tracing::error!("[App] Failed to {} sensor monitoring: {}", action, error);
    }
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
    let icon = tauri::image::Image::from_bytes(icon_bytes).expect("Failed to load tray icon");

    // Build tray
    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("Hardware Monitor")
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    with_sensor_lifecycle_state(app, "acquire dashboard", |leases, manager| {
                        acquire_sensor_monitoring_surface("dashboard", app, leases, manager)
                    });
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "mini" => {
                    // Toggle to mini mode
                    with_sensor_lifecycle_state(app, "acquire mini", |leases, manager| {
                        acquire_sensor_monitoring_surface("mini", app, leases, manager)
                    });
                    if let Some(main) = app.get_webview_window("main") {
                        let _ = main.hide();
                    }
                    with_sensor_lifecycle_state(app, "release dashboard", |leases, manager| {
                        release_sensor_monitoring_surface("dashboard", leases, manager)
                    });
                    if let Some(mini) = app.get_webview_window("mini") {
                        let _ = mini.show();
                        let _ = mini.set_focus();
                    }
                }
                "quit" => {
                    request_graceful_shutdown(app);
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
                with_sensor_lifecycle_state(app, "acquire dashboard", |leases, manager| {
                    acquire_sensor_monitoring_surface("dashboard", app, leases, manager)
                });
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    tracing::info!("[Tray] System tray initialized");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _tracing_guard = utils::logging::init_tracing().ok();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(MonitorState(Mutex::new(SystemMonitor::new())))
        .manage(TelemetryDiagnosticsState(Mutex::new(
            TelemetryDiagnosticsService::new(),
        )))
        .manage(SensorMonitorLeaseState::default())
        .invoke_handler(tauri::generate_handler![
            get_system_stats,
            get_log_path,
            get_telemetry_diagnostics,
            has_gpu_support,
            start_fps_monitoring,
            stop_fps_monitoring,
            get_fps_monitoring_status,
            start_sensor_monitoring,
            acquire_sensor_monitoring,
            release_sensor_monitoring,
            get_sensor_monitoring_status,
            toggle_mini_mode,
            show_main_window,
            hide_mini_window,
        ])
        .setup(|app| {
            tracing::info!("[App] Starting hardware monitor...");

            // Setup system tray
            if let Err(e) = setup_tray(app) {
                tracing::error!("[Tray] Failed to setup tray: {}", e);
            }

            // Disable shadow on mini window (Windows DWM can add a border even with decorations: false)
            if let Some(mini) = app.get_webview_window("mini") {
                if let Err(e) = mini.set_shadow(false) {
                    tracing::warn!("[App] Failed to disable mini window shadow: {}", e);
                }
            }

            // Create the temperature sidecar lazily; UI surfaces start it on demand.
            let (sidecar_state, sidecar_manager) = create_sidecar();

            // Create the FPS sidecar manager lazily; the process starts on demand.
            let (fps_sidecar_state, fps_sidecar_manager) = create_fps_sidecar();

            // Store sidecar states for later access
            app.manage(AppState {
                sidecar: sidecar_state.clone(),
                fps_sidecar: fps_sidecar_state.clone(),
            });
            app.manage(Mutex::new(sidecar_manager));
            app.manage(Mutex::new(fps_sidecar_manager));

            // Start the background stats emitter
            start_stats_emitter(app.handle().clone(), sidecar_state);

            // Start the FPS stats emitter
            start_fps_emitter(app.handle().clone(), fps_sidecar_state);

            // Handle window close event - hide to tray instead of quit
            let main_window = app.get_webview_window("main");
            if let Some(window) = main_window {
                let window_clone = window.clone();
                let app_handle = app.handle().clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        // Prevent the window from closing, hide it instead
                        api.prevent_close();
                        let _ = window_clone.hide();
                        let leases = app_handle.state::<SensorMonitorLeaseState>();
                        let manager = app_handle.state::<Mutex<SidecarManager>>();
                        if let Err(error) =
                            release_sensor_monitoring_surface("dashboard", &leases, &manager)
                        {
                            tracing::error!(
                                "[App] Failed to release dashboard sensor monitoring: {}",
                                error
                            );
                        }
                        tracing::info!("[App] Main window hidden to tray");
                    }
                });
            }

            tracing::info!("[App] Initialization complete");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            stop_managed_sidecars(app_handle);
        }
    });
}
