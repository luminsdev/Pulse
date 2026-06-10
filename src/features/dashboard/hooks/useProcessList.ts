import { useCallback, useMemo, useState } from "react";
import { useTauriEvent } from "@/hooks/useTauriEvent";
import type { ProcessInfo } from "@/types/stats";

export interface UseProcessListReturn {
  processes: ProcessInfo[];
  isLoaded: boolean;
}

/**
 * Hook to receive lower-frequency process list updates from the backend.
 */
export function useProcessList(): UseProcessListReturn {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const handleProcessList = useCallback((payload: ProcessInfo[]) => {
    setProcesses(payload);
    setIsLoaded(true);
  }, []);

  useTauriEvent<ProcessInfo[]>("process-list", handleProcessList);

  return useMemo(
    () => ({
      processes,
      isLoaded,
    }),
    [processes, isLoaded]
  );
}
