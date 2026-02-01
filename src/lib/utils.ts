import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format percentage with fixed decimals
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format frequency (MHz to GHz if needed)
 */
export function formatFrequency(mhz: number): string {
  if (mhz >= 1000) {
    return `${(mhz / 1000).toFixed(2)} GHz`;
  }
  return `${mhz.toFixed(0)} MHz`;
}

/**
 * Format temperature
 */
export function formatTemperature(celsius: number): string {
  return `${celsius.toFixed(0)}°C`;
}

/**
 * Format uptime seconds to human-readable string
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return parts.join(" ");
}

/**
 * Format power (watts)
 */
export function formatPower(watts: number): string {
  return `${watts.toFixed(1)}W`;
}

/**
 * Format clock speed (MHz)
 */
export function formatClock(mhz: number): string {
  if (mhz >= 1000) {
    return `${(mhz / 1000).toFixed(2)} GHz`;
  }
  return `${mhz.toFixed(0)} MHz`;
}

/**
 * Temperature thresholds and colors
 */
export type TemperatureLevel = "cool" | "normal" | "warm" | "hot" | "critical";

export interface TemperatureColorInfo {
  level: TemperatureLevel;
  color: string; // HSL color string
  textColor: string; // For text display
  bgColor: string; // For background
}

/**
 * Get temperature color based on value
 * @param celsius - Temperature in Celsius
 * @param type - "cpu" or "gpu" (GPU typically runs hotter)
 */
export function getTemperatureColor(
  celsius: number | null | undefined,
  type: "cpu" | "gpu" = "cpu"
): TemperatureColorInfo {
  // Default for null/undefined
  if (celsius == null) {
    return {
      level: "normal",
      color: "hsl(var(--muted-foreground))",
      textColor: "text-muted-foreground",
      bgColor: "bg-muted",
    };
  }

  // Temperature thresholds (GPU runs ~10°C hotter typically)
  const thresholds = type === "cpu" 
    ? { cool: 45, normal: 65, warm: 80, hot: 90 }
    : { cool: 50, normal: 70, warm: 85, hot: 95 };

  if (celsius < thresholds.cool) {
    return {
      level: "cool",
      color: "hsl(199 89% 48%)", // cyan-500
      textColor: "text-cyan-500",
      bgColor: "bg-cyan-500/20",
    };
  } else if (celsius < thresholds.normal) {
    return {
      level: "normal",
      color: "hsl(142 71% 45%)", // green-500
      textColor: "text-green-500",
      bgColor: "bg-green-500/20",
    };
  } else if (celsius < thresholds.warm) {
    return {
      level: "warm",
      color: "hsl(38 92% 50%)", // amber-500
      textColor: "text-amber-500",
      bgColor: "bg-amber-500/20",
    };
  } else if (celsius < thresholds.hot) {
    return {
      level: "hot",
      color: "hsl(25 95% 53%)", // orange-500
      textColor: "text-orange-500",
      bgColor: "bg-orange-500/20",
    };
  } else {
    return {
      level: "critical",
      color: "hsl(0 72% 51%)", // red-500
      textColor: "text-red-500",
      bgColor: "bg-red-500/20",
    };
  }
}
