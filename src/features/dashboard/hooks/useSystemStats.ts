import { useState, useCallback, useMemo } from "react";
import { useTauriEvent } from "@/hooks/useTauriEvent";
import type { SystemStats } from "@/types/stats";

/** Data point for time-series charts */
export interface StatsHistoryPoint {
  timestamp: number;
  cpuUsage: number;
  ramUsage: number;
  gpuUsage: number;
}

/** Maximum number of data points to keep in history (60 seconds at 1 point/sec) */
const MAX_HISTORY_LENGTH = 60;

/** Return type for useSystemStats hook */
export interface UseSystemStatsReturn {
  /** Current system stats (latest) */
  stats: SystemStats | null;
  /** Historical data points for charts */
  history: StatsHistoryPoint[];
  /** Whether we're receiving data */
  isConnected: boolean;
  /** Error message if any */
  error: string | null;
}

/**
 * Hook to manage system stats from Tauri backend
 * - Listens to "system-stats" events
 * - Maintains history for charts
 * - Provides connection status
 */
export function useSystemStats(): UseSystemStatsReturn {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [history, setHistory] = useState<StatsHistoryPoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handler for incoming system stats
  const handleStats = useCallback((payload: SystemStats) => {
    setStats(payload);
    setIsConnected(true);
    setError(null);

    // Add to history
    const newPoint: StatsHistoryPoint = {
      timestamp: payload.timestamp,
      cpuUsage: payload.cpu.usage,
      ramUsage: payload.ram.usage_percent,
      gpuUsage: payload.gpu?.usage ?? 0,
    };

    setHistory((prev) => {
      const updated = [...prev, newPoint];
      // Keep only the last MAX_HISTORY_LENGTH points
      if (updated.length > MAX_HISTORY_LENGTH) {
        return updated.slice(-MAX_HISTORY_LENGTH);
      }
      return updated;
    });
  }, []);

  // Listen to Tauri events
  useTauriEvent<SystemStats>("system-stats", handleStats);

  // Memoize return value to prevent unnecessary re-renders
  const result = useMemo(
    () => ({
      stats,
      history,
      isConnected,
      error,
    }),
    [stats, history, isConnected, error]
  );

  return result;
}

/**
 * Format history data for Recharts
 * Converts timestamp to relative time (seconds ago)
 */
export function formatHistoryForChart(
  history: StatsHistoryPoint[]
): Array<StatsHistoryPoint & { time: string }> {
  if (history.length === 0) return [];

  const now = Date.now();
  return history.map((point) => ({
    ...point,
    time: `${Math.round((now - point.timestamp) / 1000)}s`,
  }));
}
