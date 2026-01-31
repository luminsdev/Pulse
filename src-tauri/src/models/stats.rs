use serde::{Deserialize, Serialize};

/// CPU statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuStats {
    pub name: String,
    pub usage: f32,     // 0-100%
    pub frequency: u64, // MHz
    pub cores: usize,
    pub logical_cores: usize,
    pub per_core_usage: Vec<f32>,
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

impl Default for SystemStats {
    fn default() -> Self {
        Self {
            cpu: CpuStats::default(),
            ram: RamStats::default(),
            gpu: None,
            timestamp: 0,
        }
    }
}
