use serde::{Deserialize, Serialize};

/// Static system information (doesn't change frequently)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub cpu_name: String,
    pub cpu_cores: usize,
    pub cpu_threads: usize,
    pub ram_total: u64, // bytes
    pub gpu_name: Option<String>,
    pub gpu_vram_total: Option<u64>, // bytes
    pub os_name: String,
    pub os_version: String,
    pub hostname: String,
    pub uptime_seconds: u64,
}

/// Process information for top processes list
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: f32, // 0-100%
    pub memory: u64,    // bytes
}

/// CPU statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuStats {
    pub name: String,
    pub usage: f32,     // 0-100%
    pub frequency: u64, // MHz
    pub cores: usize,
    pub logical_cores: usize,
    pub per_core_usage: Vec<f32>,
    pub temperature: Option<f32>, // Celsius (from WMI on Windows)
}

/// RAM/Memory statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RamStats {
    pub total: u64,         // bytes
    pub used: u64,          // bytes
    pub available: u64,     // bytes
    pub usage_percent: f32, // 0-100%
}

/// GPU statistics (optional - only available if GPU is detected)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuStats {
    pub name: String,
    pub usage: f32,               // 0-100%
    pub memory_total: u64,        // bytes
    pub memory_used: u64,         // bytes
    pub temperature: Option<u32>, // Celsius
    pub fan_speed: Option<u32>,   // 0-100%
}

/// Combined system statistics payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStats {
    pub cpu: CpuStats,
    pub ram: RamStats,
    pub gpu: Option<GpuStats>,
    pub system_info: SystemInfo,
    pub processes: Vec<ProcessInfo>,
    pub timestamp: u64, // Unix timestamp in milliseconds
}

impl Default for CpuStats {
    fn default() -> Self {
        Self {
            name: String::from("Unknown CPU"),
            usage: 0.0,
            frequency: 0,
            cores: 0,
            logical_cores: 0,
            per_core_usage: Vec::new(),
            temperature: None,
        }
    }
}

impl Default for RamStats {
    fn default() -> Self {
        Self {
            total: 0,
            used: 0,
            available: 0,
            usage_percent: 0.0,
        }
    }
}

impl Default for GpuStats {
    fn default() -> Self {
        Self {
            name: String::from("Unknown GPU"),
            usage: 0.0,
            memory_total: 0,
            memory_used: 0,
            temperature: None,
            fan_speed: None,
        }
    }
}

impl Default for SystemInfo {
    fn default() -> Self {
        Self {
            cpu_name: String::from("Unknown CPU"),
            cpu_cores: 0,
            cpu_threads: 0,
            ram_total: 0,
            gpu_name: None,
            gpu_vram_total: None,
            os_name: String::from("Unknown"),
            os_version: String::new(),
            hostname: String::new(),
            uptime_seconds: 0,
        }
    }
}

impl Default for SystemStats {
    fn default() -> Self {
        Self {
            cpu: CpuStats::default(),
            ram: RamStats::default(),
            gpu: None,
            system_info: SystemInfo::default(),
            processes: Vec::new(),
            timestamp: 0,
        }
    }
}
