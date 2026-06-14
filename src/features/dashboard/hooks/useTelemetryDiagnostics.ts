import { useEffect, useState } from "react";
import { getTelemetryDiagnostics } from "@/lib/tauri";
import type { TelemetryDiagnosticsPayload } from "@/types/stats";

const REFRESH_INTERVAL_MS = 5000;

export function useTelemetryDiagnostics(): TelemetryDiagnosticsPayload | null {
  const [diagnostics, setDiagnostics] = useState<TelemetryDiagnosticsPayload | null>(null);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      try {
        const next = await getTelemetryDiagnostics();
        if (mounted) {
          setDiagnostics(next);
        }
      } catch (error) {
        console.error("Failed to load telemetry diagnostics", error);
      }
    };

    refresh();
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  return diagnostics;
}
