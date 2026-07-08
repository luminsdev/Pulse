import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CpuStats } from "@/types/stats";
import { CpuCard } from "./CpuCard";

describe("CpuCard", () => {
  it("renders the loading state while waiting for stats", () => {
    render(<CpuCard stats={null} />);

    expect(screen.getByText(/CPU/i)).toBeTruthy();
    expect(screen.getByText(/WAITING TELEMETRY/i)).toBeTruthy();
  });

  it("shows a provider hint when CPU temperature needs HWiNFO", () => {
    const stats: CpuStats = {
      name: "AMD Ryzen",
      usage: 42,
      frequency: 4200,
      cores: 8,
      logical_cores: 16,
      per_core_usage: [],
      temperature: null,
      core_temperatures: null,
      power: null,
    };

    render(<CpuCard stats={stats} temperatureStatus="provider_unavailable" />);

    expect(screen.getByText("HWiNFO")).toBeTruthy();
    expect(screen.getByText(/Provider needed/i)).toBeTruthy();
  });

  it("labels the core temperature map from concrete core readings", () => {
    const stats: CpuStats = {
      name: "Intel Core i5-12450HX",
      usage: 42,
      frequency: 4200,
      cores: 8,
      logical_cores: 12,
      per_core_usage: [],
      temperature: 72,
      core_temperatures: [61, 62, 63, 64, 65, 66, 67, 68],
      power: null,
    };

    render(<CpuCard stats={stats} />);

    expect(screen.getByText("CORE TEMPERATURE MAP (8 Cores)")).toBeTruthy();
  });
});
