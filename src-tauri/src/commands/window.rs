use tauri::{AppHandle, Manager};

/// Toggle between main window and mini mode
#[tauri::command]
pub async fn toggle_mini_mode(app: AppHandle) -> Result<(), String> {
    // Get window references
    let main_window = app.get_webview_window("main");
    let mini_window = app.get_webview_window("mini");

    match (main_window, mini_window) {
        (Some(main), Some(mini)) => {
            // Check which one is visible and toggle
            if main.is_visible().unwrap_or(false) {
                main.hide().map_err(|e| e.to_string())?;
                mini.show().map_err(|e| e.to_string())?;
                mini.set_focus().map_err(|e| e.to_string())?;
            } else {
                mini.hide().map_err(|e| e.to_string())?;
                main.show().map_err(|e| e.to_string())?;
                main.set_focus().map_err(|e| e.to_string())?;
            }
            Ok(())
        }
        _ => Err("Windows not found".to_string()),
    }
}

/// Show the main window
#[tauri::command]
pub async fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Hide the mini window
#[tauri::command]
pub async fn hide_mini_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("mini") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}
