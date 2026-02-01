// System stats types - mirrors Rust models

export interface CpuStats {
  name: string;
  usage: number; // 0-100%
  frequency: number; // MHz
  cores: number;
  logical_cores: number;
  per_core_usage: number[];
  temperature?: number; // Celsius (from WMI on Windows)
}

export interface RamStats {
  total: number; // bytes
  used: number; // bytes
  available: number; // bytes
  usage_percent: number; // 0-100%
}

export interface GpuStats {
  name: string;
  usage: number; // 0-100%
  memory_total: number; // bytes
  memory_used: number; // bytes
  temperature?: number; // Celsius
  fan_speed?: number; // 0-100%
}

export interface SystemInfo {
  cpu_name: string;
  cpu_cores: number;
  cpu_threads: number;
  ram_total: number; // bytes
  gpu_name?: string;
  gpu_vram_total?: number; // bytes
  os_name: string;
  os_version: string;
  hostname: string;
  uptime_seconds: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_usage: number; // 0-100%
  memory: number; // bytes
}

export interface SystemStats {
  cpu: CpuStats;
  ram: RamStats;
  gpu?: GpuStats;
  system_info: SystemInfo;
  processes: ProcessInfo[];
  timestamp: number;
}
