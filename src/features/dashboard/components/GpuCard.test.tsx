import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GpuStats } from "@/types/stats";
import { GpuCard } from "./GpuCard";

const gpuStats: GpuStats = {
  name: "NVIDIA GeForce RTX 4070",
  usage: 42,
  memory_total: 12 * 1024 * 1024 * 1024,
  memory_used: 4 * 1024 * 1024 * 1024,
};

describe("GpuCard", () => {
  it("renders the loading state while GPU availability is still unknown", () => {
    render(<GpuCard stats={null} isAvailable />);

    expect(screen.getByText(/GPU/i)).toBeTruthy();
    expect(screen.getByText(/WAITING TELEMETRY/i)).toBeTruthy();
  });

  it("renders the no-GPU state only after availability is known false", () => {
    render(<GpuCard stats={undefined} isAvailable={false} />);

    expect(screen.getByText(/NO GPU DETECTED/i)).toBeTruthy();
  });

  it("renders GPU telemetry when stats are available", () => {
    render(<GpuCard stats={gpuStats} isAvailable />);

    expect(screen.getByText(/GRAPHICS \(GPU\)/i)).toBeTruthy();
    expect(screen.getByText("42.0")).toBeTruthy();
  });

  it("renders HWiNFO-enriched GPU telemetry rows", () => {
    render(
      <GpuCard
        stats={{
          ...gpuStats,
          temperature: 62,
          hot_spot_temperature: 75,
          fan_speed: 45,
          power: 88,
          core_clock: 2100,
          memory_clock: 8000,
        }}
        isAvailable
      />
    );

    expect(screen.getByText("75°C")).toBeTruthy();
    expect(screen.getByText("45%")).toBeTruthy();
    expect(screen.getByText("88.0W")).toBeTruthy();
    expect(screen.getByText("2100 MHz")).toBeTruthy();
    expect(screen.getByText("8000 MHz")).toBeTruthy();
  });
});
