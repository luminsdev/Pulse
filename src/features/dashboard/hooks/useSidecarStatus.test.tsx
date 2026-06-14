import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSidecarStatus } from "./useSidecarStatus";
import { acquireSensorMonitoring, releaseSensorMonitoring } from "@/lib/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";

vi.mock("@/hooks/useTauriEvent", () => ({
  useTauriEvent: vi.fn(),
}));

vi.mock("@/lib/tauri", () => ({
  acquireSensorMonitoring: vi.fn().mockResolvedValue(undefined),
  getSensorMonitoringStatus: vi.fn().mockResolvedValue({
    status: "not_started",
    restart_count: 0,
    can_restart: false,
  }),
  releaseSensorMonitoring: vi.fn().mockResolvedValue(undefined),
  startSensorMonitoring: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(),
}));

function Probe() {
  useSidecarStatus("mini");
  return null;
}

describe("useSidecarStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not acquire a sensor lease while the current window is hidden", async () => {
    vi.mocked(getCurrentWindow).mockReturnValue({
      isVisible: vi.fn().mockResolvedValue(false),
    } as never);

    const { unmount } = render(<Probe />);

    await waitFor(() => expect(getCurrentWindow).toHaveBeenCalled());
    expect(acquireSensorMonitoring).not.toHaveBeenCalled();
    unmount();

    expect(releaseSensorMonitoring).not.toHaveBeenCalled();
  });
});
