use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::{
    CpuRefreshKind, MemoryRefreshKind, ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System,
};

use crate::models::{CpuStats, GpuStats, ProcessInfo, RamStats, SystemInfo, SystemStats};

/// GPU monitoring service using NVML (NVIDIA Management Library)
pub struct GpuMonitor {
    nvml: Option<nvml_wrapper::Nvml>,
    device_index: u32,
}

impl GpuMonitor {
    pub fn new() -> Self {
        // Try to initialize NVML - will fail if no NVIDIA GPU or drivers
        let nvml = nvml_wrapper::Nvml::init().ok();
        Self {
            nvml,
            device_index: 0,
        }
    }

    pub fn is_available(&self) -> bool {
        self.nvml.is_some()
    }

    pub fn get_stats(&self) -> Option<GpuStats> {
        let nvml = self.nvml.as_ref()?;
        let device = nvml.device_by_index(self.device_index).ok()?;

        let name = device.name().unwrap_or_else(|_| "NVIDIA GPU".to_string());

        // GPU utilization
        let usage = device
            .utilization_rates()
            .map(|u| u.gpu as f32)
            .unwrap_or(0.0);

        // Memory info
        let memory = device.memory_info().ok()?;

        // Temperature
        let temperature = device
            .temperature(nvml_wrapper::enum_wrappers::device::TemperatureSensor::Gpu)
            .ok();

        // Fan speed (may not be available on all GPUs)
        let fan_speed = device.fan_speed(0).ok();

        Some(GpuStats {
            name,
            usage,
            memory_total: memory.total,
            memory_used: memory.used,
            temperature,
            fan_speed,
        })
    }
}

impl Default for GpuMonitor {
    fn default() -> Self {
        Self::new()
    }
}

/// System monitor that collects CPU, RAM, and GPU statistics
/// Note: CPU temperature comes from sidecar, not from this monitor directly
pub struct SystemMonitor {
    system: System,
    gpu_monitor: GpuMonitor,
}

impl SystemMonitor {
    pub fn new() -> Self {
        let system = System::new_with_specifics(
            RefreshKind::nothing()
                .with_cpu(CpuRefreshKind::everything())
                .with_memory(MemoryRefreshKind::everything())
                .with_processes(ProcessRefreshKind::everything()),
        );

        Self {
            system,
            gpu_monitor: GpuMonitor::new(),
        }
    }

    /// Refresh all system information
    pub fn refresh(&mut self) {
        self.system.refresh_cpu_all();
        self.system.refresh_memory();
        self.system.refresh_processes(ProcessesToUpdate::All, true);
    }

    /// Get current CPU statistics
    /// Note: temperature is None - it will be filled in from sidecar data
    pub fn get_cpu_stats(&self) -> CpuStats {
        let cpus = self.system.cpus();

        // Get CPU name from first CPU
        let name = cpus
            .first()
            .map(|c| c.brand().to_string())
            .unwrap_or_else(|| "Unknown CPU".to_string());

        // Calculate average CPU usage
        let total_usage: f32 = cpus.iter().map(|c| c.cpu_usage()).sum();
        let usage = if cpus.is_empty() {
            0.0
        } else {
            total_usage / cpus.len() as f32
        };

        // Get per-core usage
        let per_core_usage: Vec<f32> = cpus.iter().map(|c| c.cpu_usage()).collect();

        // Get frequency (MHz)
        let frequency = cpus.first().map(|c| c.frequency()).unwrap_or(0);

        // Physical cores count (static function in sysinfo 0.35+)
        let cores = System::physical_core_count().unwrap_or(0);
        let logical_cores = cpus.len();

        CpuStats {
            name,
            usage,
            frequency,
            cores,
            logical_cores,
            per_core_usage,
            temperature: None, // Will be filled from sidecar
        }
    }

    /// Get current RAM statistics
    pub fn get_ram_stats(&self) -> RamStats {
        let total = self.system.total_memory();
        let used = self.system.used_memory();
        let available = self.system.available_memory();

        let usage_percent = if total > 0 {
            (used as f64 / total as f64 * 100.0) as f32
        } else {
            0.0
        };

        RamStats {
            total,
            used,
            available,
            usage_percent,
        }
    }

    /// Get current GPU statistics (if available)
    pub fn get_gpu_stats(&self) -> Option<GpuStats> {
        self.gpu_monitor.get_stats()
    }

    /// Get static system information
    pub fn get_system_info(&self) -> SystemInfo {
        let cpus = self.system.cpus();
        let cpu_name = cpus
            .first()
            .map(|c| c.brand().to_string())
            .unwrap_or_else(|| "Unknown CPU".to_string());

        let cpu_cores = System::physical_core_count().unwrap_or(0);
        let cpu_threads = cpus.len();
        let ram_total = self.system.total_memory();

        // GPU info from GPU monitor
        let gpu_stats = self.gpu_monitor.get_stats();
        let gpu_name = gpu_stats.as_ref().map(|g| g.name.clone());
        let gpu_vram_total = gpu_stats.as_ref().map(|g| g.memory_total);

        // OS info
        let os_name = System::name().unwrap_or_else(|| "Unknown".to_string());
        let os_version = System::os_version().unwrap_or_default();
        let hostname = System::host_name().unwrap_or_default();

        // Uptime
        let uptime_seconds = System::uptime();

        SystemInfo {
            cpu_name,
            cpu_cores,
            cpu_threads,
            ram_total,
            gpu_name,
            gpu_vram_total,
            os_name,
            os_version,
            hostname,
            uptime_seconds,
        }
    }

    /// Get top processes sorted by CPU usage
    pub fn get_top_processes(&self, limit: usize) -> Vec<ProcessInfo> {
        let mut processes: Vec<ProcessInfo> = self
            .system
            .processes()
            .iter()
            .map(|(pid, process)| ProcessInfo {
                pid: pid.as_u32(),
                name: process.name().to_string_lossy().to_string(),
                cpu_usage: process.cpu_usage(),
                memory: process.memory(),
            })
            .filter(|p| p.cpu_usage > 0.0 || p.memory > 0) // Filter out idle processes
            .collect();

        // Sort by CPU usage descending
        processes.sort_by(|a, b| {
            b.cpu_usage
                .partial_cmp(&a.cpu_usage)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Take top N
        processes.truncate(limit);
        processes
    }

    /// Get all system statistics
    pub fn get_system_stats(&self) -> SystemStats {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        SystemStats {
            cpu: self.get_cpu_stats(),
            ram: self.get_ram_stats(),
            gpu: self.get_gpu_stats(),
            system_info: self.get_system_info(),
            processes: self.get_top_processes(10), // Top 10 processes
            timestamp,
        }
    }

    /// Check if GPU monitoring is available
    pub fn has_gpu(&self) -> bool {
        self.gpu_monitor.is_available()
    }
}

impl Default for SystemMonitor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_monitor_creation() {
        let monitor = SystemMonitor::new();
        assert!(monitor.get_cpu_stats().logical_cores > 0);
    }

    #[test]
    fn test_ram_stats() {
        let monitor = SystemMonitor::new();
        let ram = monitor.get_ram_stats();
        assert!(ram.total > 0);
    }
}
