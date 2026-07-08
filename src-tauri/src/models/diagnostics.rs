use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct DiagnosticProcess {
    pub pid: u32,
    pub name: String,
    pub role: DiagnosticProcessRole,
    pub memory_bytes: u64,
    pub cpu_usage: f32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticProcessRole {
    Pulse,
    WebView,
    FpsSidecar,
    PresentMon,
    Other,
}

#[derive(Debug, Clone, Serialize)]
pub struct TelemetryDiagnosticsPayload {
    pub processes: Vec<DiagnosticProcess>,
    pub total_memory_bytes: u64,
    pub timestamp: u64,
}
