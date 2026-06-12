import { useState, useCallback, useMemo } from "react";
import { useTauriEvent } from "@/hooks/useTauriEvent";
import {
  getFpsMonitoringStatus,
  startFpsMonitoring,
  stopFpsMonitoring,
} from "@/lib/tauri";
import type {
  FpsData,
  FpsEventPayload,
  FpsSidecarStatusType,
} from "@/types/stats";

/** Data point for FPS time-series charts */
export interface FpsHistoryPoint {
  timestamp: number;
  fps: number;
  fps1Low: number;
  fps01Low: number;
  frameTime: number;
}

/** Maximum number of data points to keep in history (60 seconds at 1 point/sec) */
const MAX_HISTORY_LENGTH = 60;

/** Return type for useFpsStats hook */
export interface UseFpsStatsReturn {
  /** Current FPS data (latest) */
  data: FpsData | null;
  /** FPS sidecar status */
  status: FpsSidecarStatusType;
  /** Error message if any */
  errorMessage: string | null;
  /** Whether PresentMon is installed */
  presentMonInstalled: boolean;
  /** Historical data points for charts */
  history: FpsHistoryPoint[];
  /** Whether we're actively receiving FPS data */
  isActive: boolean;
  /** Whether no game is detected */
  isNoGame: boolean;
  /** Whether a start command is in flight */
  isStarting: boolean;
  /** Whether a stop command is in flight */
  isStopping: boolean;
  /** Start the FPS sidecar process */
  startMonitoring: () => Promise<void>;
  /** Stop the FPS sidecar process */
  stopMonitoring: () => Promise<void>;
}

/**
 * Hook to manage FPS stats from Tauri backend
 * - Listens to "fps-stats" events
 * - Maintains history for charts
 * - Provides status information
 */
export function useFpsStats(): UseFpsStatsReturn {
  const [data, setData] = useState<FpsData | null>(null);
  const [status, setStatus] = useState<FpsSidecarStatusType>("not_started");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [presentMonInstalled, setPresentMonInstalled] = useState(true);
  const [history, setHistory] = useState<FpsHistoryPoint[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Handler for incoming FPS stats events
  const handleFpsStats = useCallback((payload: FpsEventPayload) => {
    setStatus(payload.status);
    setPresentMonInstalled(payload.present_mon_installed);

    // Handle error message
    if (payload.status === "error" && payload.message) {
      setErrorMessage(payload.message);
    } else {
      setErrorMessage(null);
    }

    // Handle FPS data
    if (payload.data) {
      setData(payload.data);

      // Add to history
      const newPoint: FpsHistoryPoint = {
        timestamp: payload.data.timestamp,
        fps: payload.data.fps,
        fps1Low: payload.data.fps_1_percent_low,
        fps01Low: payload.data.fps_01_percent_low,
        frameTime: payload.data.frame_time,
      };

      setHistory((prev) => {
        const updated = [...prev, newPoint];
        // Keep only the last MAX_HISTORY_LENGTH points
        if (updated.length > MAX_HISTORY_LENGTH) {
          return updated.slice(-MAX_HISTORY_LENGTH);
        }
        return updated;
      });
    } else if (payload.status === "no_game" || payload.status === "stopped") {
      // Clear data and history when no game or stopped
      setData(null);
      // Keep history for a moment, but clear data
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    const payload = await getFpsMonitoringStatus();
    handleFpsStats(payload);
  }, [handleFpsStats]);

  const startMonitoring = useCallback(async () => {
    setIsStarting(true);

    try {
      await startFpsMonitoring();
      await refreshStatus();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsStarting(false);
    }
  }, [refreshStatus]);

  const stopMonitoring = useCallback(async () => {
    setIsStopping(true);

    try {
      await stopFpsMonitoring();
      await refreshStatus();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsStopping(false);
    }
  }, [refreshStatus]);

  // Listen to Tauri events
  useTauriEvent<FpsEventPayload>("fps-stats", handleFpsStats);

  // Derived states
  const isActive = status === "running" && data != null;
  const isNoGame = status === "no_game";

  // Memoize return value to prevent unnecessary re-renders
  const result = useMemo(
    () => ({
      data,
      status,
      errorMessage,
      presentMonInstalled,
      history,
      isActive,
      isNoGame,
      isStarting,
      isStopping,
      startMonitoring,
      stopMonitoring,
    }),
    [
      data,
      status,
      errorMessage,
      presentMonInstalled,
      history,
      isActive,
      isNoGame,
      isStarting,
      isStopping,
      startMonitoring,
      stopMonitoring,
    ]
  );

  return result;
}

/**
 * Format FPS value for display
 */
export function formatFps(fps: number): string {
  return fps.toFixed(0);
}

/**
 * Format frame time for display (in ms)
 */
export function formatFrameTime(ms: number): string {
  return `${ms.toFixed(1)}ms`;
}

/**
 * Get color based on FPS value
 * - Green: 60+ FPS
 * - Blue: 45-59 FPS
 * - Amber: 30-44 FPS
 * - Red: <30 FPS
 */
export function getFpsColor(fps: number): string {
  if (fps >= 60) return "#22c55e"; // green-500
  if (fps >= 45) return "#3b82f6"; // blue-500
  if (fps >= 30) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}

/**
 * Get color class for Tailwind based on FPS value
 */
export function getFpsColorClass(fps: number): string {
  if (fps >= 60) return "text-green-500";
  if (fps >= 45) return "text-blue-500";
  if (fps >= 30) return "text-amber-500";
  return "text-red-500";
}
