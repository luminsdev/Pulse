use std::path::PathBuf;

pub fn log_dir() -> Result<PathBuf, String> {
    let app_data = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "APPDATA environment variable is not set".to_string())?;

    Ok(app_data.join("com.giahu.pulse").join("logs"))
}

pub fn init_tracing() -> Result<tracing_appender::non_blocking::WorkerGuard, String> {
    let log_dir = log_dir()?;
    std::fs::create_dir_all(&log_dir)
        .map_err(|error| format!("Failed to create log directory: {error}"))?;

    let file_appender = tracing_appender::rolling::daily(log_dir, "pulse.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    tracing_subscriber::fmt()
        .with_writer(non_blocking)
        .with_ansi(false)
        .try_init()
        .map_err(|error| format!("Failed to initialize tracing: {error}"))?;

    Ok(guard)
}
