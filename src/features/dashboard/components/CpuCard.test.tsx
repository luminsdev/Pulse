import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CpuCard } from "./CpuCard";

describe("CpuCard", () => {
  it("renders the loading state while waiting for stats", () => {
    render(<CpuCard stats={null} />);

    expect(screen.getByText(/CPU/i)).toBeTruthy();
    expect(screen.getByText(/WAITING TELEMETRY/i)).toBeTruthy();
  });
});
