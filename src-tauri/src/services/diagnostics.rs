use std::{
    collections::{HashMap, HashSet},
    time::{SystemTime, UNIX_EPOCH},
};

use sysinfo::{ProcessesToUpdate, System};

use crate::models::{DiagnosticProcess, DiagnosticProcessRole, TelemetryDiagnosticsPayload};

pub struct TelemetryDiagnosticsService {
    system: System,
}

impl TelemetryDiagnosticsService {
    pub fn new() -> Self {
        Self {
            system: System::new_all(),
        }
    }

    pub fn snapshot(&mut self) -> TelemetryDiagnosticsPayload {
        self.system.refresh_processes(ProcessesToUpdate::All, true);

        let snapshots = self
            .system
            .processes()
            .iter()
            .map(|(pid, process)| ProcessSnapshot {
                pid: pid.as_u32(),
                parent_pid: process.parent().map(|parent| parent.as_u32()),
                name: process.name().to_string_lossy().to_string(),
                memory_bytes: process.memory(),
                cpu_usage: process.cpu_usage(),
            })
            .collect();

        build_payload_from_snapshots(snapshots, std::process::id(), current_timestamp())
    }
}

impl Default for TelemetryDiagnosticsService {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug)]
struct ProcessSnapshot {
    pid: u32,
    parent_pid: Option<u32>,
    name: String,
    memory_bytes: u64,
    cpu_usage: f32,
}

fn build_payload_from_snapshots(
    snapshots: Vec<ProcessSnapshot>,
    root_pid: u32,
    timestamp: u64,
) -> TelemetryDiagnosticsPayload {
    let parents: HashMap<u32, Option<u32>> = snapshots
        .iter()
        .map(|snapshot| (snapshot.pid, snapshot.parent_pid))
        .collect();
    let processes = snapshots
        .into_iter()
        .filter_map(|snapshot| {
            if !is_in_process_tree(snapshot.pid, root_pid, &parents) {
                return None;
            }

            let role = if snapshot.pid == root_pid {
                DiagnosticProcessRole::Pulse
            } else {
                classify_process(&snapshot.name)
            };

            if matches!(role, DiagnosticProcessRole::Other) {
                return None;
            }

            Some(DiagnosticProcess {
                pid: snapshot.pid,
                name: snapshot.name,
                role,
                memory_bytes: snapshot.memory_bytes,
                cpu_usage: snapshot.cpu_usage,
            })
        })
        .collect();

    build_payload(processes, timestamp)
}

fn is_in_process_tree(pid: u32, root_pid: u32, parents: &HashMap<u32, Option<u32>>) -> bool {
    if pid == root_pid {
        return true;
    }

    let mut current = pid;
    let mut seen = HashSet::new();

    while seen.insert(current) {
        let Some(Some(parent_pid)) = parents.get(&current) else {
            return false;
        };

        if *parent_pid == root_pid {
            return true;
        }

        current = *parent_pid;
    }

    false
}

fn build_payload(
    mut processes: Vec<DiagnosticProcess>,
    timestamp: u64,
) -> TelemetryDiagnosticsPayload {
    processes.sort_by(|a, b| b.memory_bytes.cmp(&a.memory_bytes));
    let total_memory_bytes = processes.iter().map(|process| process.memory_bytes).sum();

    TelemetryDiagnosticsPayload {
        processes,
        total_memory_bytes,
        timestamp,
    }
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn classify_process(name: &str) -> DiagnosticProcessRole {
    let lower = name.to_ascii_lowercase();

    if lower == "pulse.exe" || lower == "pulse" {
        DiagnosticProcessRole::Pulse
    } else if lower == "msedgewebview2.exe" {
        DiagnosticProcessRole::WebView
    } else if lower.contains("lhm-sidecar") {
        DiagnosticProcessRole::LhmSidecar
    } else if lower.contains("fps-sidecar") {
        DiagnosticProcessRole::FpsSidecar
    } else if lower.contains("presentmon") {
        DiagnosticProcessRole::PresentMon
    } else {
        DiagnosticProcessRole::Other
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_tracked_pulse_processes() {
        assert!(matches!(
            classify_process("Pulse.exe"),
            DiagnosticProcessRole::Pulse
        ));
        assert!(matches!(
            classify_process("msedgewebview2.exe"),
            DiagnosticProcessRole::WebView
        ));
        assert!(matches!(
            classify_process("lhm-sidecar-x86_64-pc-windows-msvc.exe"),
            DiagnosticProcessRole::LhmSidecar
        ));
        assert!(matches!(
            classify_process("fps-sidecar-x86_64-pc-windows-msvc.exe"),
            DiagnosticProcessRole::FpsSidecar
        ));
        assert!(matches!(
            classify_process("presentmon-x86_64-pc-windows-msvc.exe"),
            DiagnosticProcessRole::PresentMon
        ));
        assert!(matches!(
            classify_process("notepad.exe"),
            DiagnosticProcessRole::Other
        ));
    }

    #[test]
    fn build_payload_sorts_processes_and_sums_memory() {
        let payload = build_payload(
            vec![
                DiagnosticProcess {
                    pid: 1,
                    name: "fps-sidecar.exe".to_string(),
                    role: DiagnosticProcessRole::FpsSidecar,
                    memory_bytes: 20,
                    cpu_usage: 1.0,
                },
                DiagnosticProcess {
                    pid: 2,
                    name: "Pulse.exe".to_string(),
                    role: DiagnosticProcessRole::Pulse,
                    memory_bytes: 100,
                    cpu_usage: 2.0,
                },
            ],
            42,
        );

        assert_eq!(payload.timestamp, 42);
        assert_eq!(payload.total_memory_bytes, 120);
        assert_eq!(payload.processes[0].pid, 2);
        assert_eq!(payload.processes[1].pid, 1);
    }

    #[test]
    fn build_payload_only_includes_pulse_process_tree() {
        let payload = build_payload_from_snapshots(
            vec![
                ProcessSnapshot {
                    pid: 10,
                    parent_pid: None,
                    name: "Pulse.exe".to_string(),
                    memory_bytes: 100,
                    cpu_usage: 1.0,
                },
                ProcessSnapshot {
                    pid: 11,
                    parent_pid: Some(10),
                    name: "msedgewebview2.exe".to_string(),
                    memory_bytes: 50,
                    cpu_usage: 2.0,
                },
                ProcessSnapshot {
                    pid: 12,
                    parent_pid: Some(99),
                    name: "msedgewebview2.exe".to_string(),
                    memory_bytes: 500,
                    cpu_usage: 3.0,
                },
                ProcessSnapshot {
                    pid: 13,
                    parent_pid: Some(99),
                    name: "presentmon.exe".to_string(),
                    memory_bytes: 250,
                    cpu_usage: 4.0,
                },
            ],
            10,
            42,
        );

        let pids: Vec<u32> = payload
            .processes
            .iter()
            .map(|process| process.pid)
            .collect();

        assert_eq!(pids, vec![10, 11]);
        assert_eq!(payload.total_memory_bytes, 150);
    }
}
