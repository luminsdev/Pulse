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
});
