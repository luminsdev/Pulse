import { useCallback, useMemo, useState } from "react";
import { useTauriEvent } from "@/hooks/useTauriEvent";
import type { SystemInfo } from "@/types/stats";

export interface UseSystemInfoReturn {
  info: SystemInfo | null;
  isLoaded: boolean;
}

/**
 * Hook to receive static system information emitted once on startup.
 */
export function useSystemInfo(): UseSystemInfoReturn {
  const [info, setInfo] = useState<SystemInfo | null>(null);

  const handleSystemInfo = useCallback((payload: SystemInfo) => {
    setInfo(payload);
  }, []);

  useTauriEvent<SystemInfo>("system-info", handleSystemInfo);

  return useMemo(
    () => ({
      info,
      isLoaded: info !== null,
    }),
    [info]
  );
}
