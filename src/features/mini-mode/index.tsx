import { useCallback } from "react";
import { CompactWidget } from "./components/CompactWidget";
import { useSystemStats } from "@/features/dashboard/hooks/useSystemStats";
import { useFpsStats } from "@/features/dashboard/hooks/useFpsStats";
import { useSidecarStatus } from "@/features/dashboard/hooks/useSidecarStatus";
import { toggleMiniMode } from "@/lib/tauri";

/**
 * Mini Mode - Compact overlay window
 * Shows essential system metrics in a small, always-on-top widget
 */
export function MiniMode() {
  const { stats, history: sysHistory } = useSystemStats();
  const { data: fpsData, status: fpsStatus } = useFpsStats();
  useSidecarStatus("mini");

  const handleExpand = useCallback(() => {
    toggleMiniMode().catch(console.error);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent">
      <CompactWidget
        stats={stats}
        sysHistory={sysHistory}
        onExpand={handleExpand}
        fpsData={fpsData}
        fpsStatus={fpsStatus}
      />
    </div>
  );
}

export default MiniMode;
