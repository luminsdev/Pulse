// System stats types - mirrors Rust models

export interface CpuStats {
  name: string;
  usage: number; // 0-100%
  frequency: number; // MHz
  cores: number;
  logical_cores: number;
  per_core_usage: number[];
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

export interface SystemStats {
  cpu: CpuStats;
  ram: RamStats;
  gpu?: GpuStats;
  timestamp: number;
}
