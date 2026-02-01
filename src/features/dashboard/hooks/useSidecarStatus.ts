import { useState, useCallback, useMemo } from "react";
import { useTauriEvent } from "@/hooks/useTauriEvent";
import type { SidecarStatusPayload } from "@/types/stats";
import { isSidecarHealthy, getSidecarStatusMessage } from "@/types/stats";

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
}

/**
 * Hook to manage sidecar status from Tauri backend
 * - Listens to "sidecar-status" events
 * - Provides health status and user-friendly messages
 */
export function useSidecarStatus(): UseSidecarStatusReturn {
  const [status, setStatus] = useState<SidecarStatusPayload | null>(null);

  // Handler for incoming sidecar status
  const handleStatus = useCallback((payload: SidecarStatusPayload) => {
    setStatus(payload);
  }, []);

  // Listen to Tauri events
  useTauriEvent<SidecarStatusPayload>("sidecar-status", handleStatus);

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
    };
  }, [status]);

  return result;
}
