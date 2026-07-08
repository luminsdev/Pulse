import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidecarWarning } from "./SidecarWarning";

describe("SidecarWarning", () => {
  it("shows retry action for recoverable sidecar failures", () => {
    const onRetry = vi.fn();

    render(
      <SidecarWarning
        status={{ status: "error", message: "Failed", restart_count: 0, can_restart: true }}
        message="Failed"
        show
        onRetry={onRetry}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry temperature monitoring" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows HWiNFO guidance without administrator instructions", () => {
    render(
      <SidecarWarning
        status={{
          status: "provider_unavailable",
          message: "CPU temperature requires HWiNFO64 running in Sensor mode with Shared Memory Support enabled.",
          restart_count: 0,
          can_restart: true,
        }}
        message="CPU temperature requires HWiNFO64 running in Sensor mode with Shared Memory Support enabled."
        show
      />
    );

    expect(screen.getAllByText(/HWiNFO64/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Shared Memory Support/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Run as Administrator/i)).toBeNull();
  });
});
