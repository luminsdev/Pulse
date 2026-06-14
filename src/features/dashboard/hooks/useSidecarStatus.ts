import { useState, useCallback, useEffect, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTauriEvent } from "@/hooks/useTauriEvent";
import type { SidecarStatusPayload } from "@/types/stats";
import { isSidecarHealthy, getSidecarStatusMessage } from "@/types/stats";
import {
  acquireSensorMonitoring,
  getSensorMonitoringStatus,
  releaseSensorMonitoring,
  startSensorMonitoring,
} from "@/lib/tauri";

/** Return type for useSidecarStatus hook */
export interface UseSidecarStatusReturn {
  /** Current sidecar status */
  status: SidecarStatusPayload | null;
  /** Whether sidecar is healthy and running */
  isHealthy: boolean;
  /** Human-readable status message */
  message: string;
  /** Whether we should show warning */
  showWarning: boolean;
  /** Whether a start command is in flight */
  isStarting: boolean;
  /** Retry the temperature sidecar process */
  retryMonitoring: () => Promise<void>;
}

/**
 * Hook to manage sidecar status from Tauri backend
 * - Listens to "sidecar-status" events
 * - Provides health status and user-friendly messages
 */
export function useSidecarStatus(surface = "dashboard"): UseSidecarStatusReturn {
  const [status, setStatus] = useState<SidecarStatusPayload | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Handler for incoming sidecar status
  const handleStatus = useCallback((payload: SidecarStatusPayload) => {
    setStatus(payload);
  }, []);

  // Listen to Tauri events
  useTauriEvent<SidecarStatusPayload>("sidecar-status", handleStatus);

  useEffect(() => {
    let mounted = true;
    let acquired = false;

    const acquireIfVisible = async () => {
      const isVisible = await getCurrentWindow().isVisible();
      if (!mounted || !isVisible) return;

      await acquireSensorMonitoring(surface);
      acquired = true;

      if (!mounted) {
        await releaseSensorMonitoring(surface);
        return;
      }

      setStatus(await getSensorMonitoringStatus());
    };

    acquireIfVisible().catch(console.error);

    return () => {
      mounted = false;
      if (acquired) releaseSensorMonitoring(surface).catch(console.error);
    };
  }, [surface]);

  const retryMonitoring = useCallback(async () => {
    setIsStarting(true);

    try {
      await startSensorMonitoring();
      setStatus(await getSensorMonitoringStatus());
    } catch (error) {
      console.error(error);
    } finally {
      setIsStarting(false);
    }
  }, []);

  // Memoize derived values
  const result = useMemo(() => {
    const isHealthy = status ? isSidecarHealthy(status) : false;
    const message = status ? getSidecarStatusMessage(status) : "Initializing...";
    
    // Show warning if not healthy and not just starting up
    const showWarning = status !== null && 
      !isHealthy && 
      status.status !== "not_started";

    return {
      status,
      isHealthy,
      message,
      showWarning,
      isStarting,
      retryMonitoring,
    };
  }, [isStarting, retryMonitoring, status]);

  return result;
}
