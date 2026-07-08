import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SystemStatsPayload } from "@/types/stats";
import { CompactWidget } from "./CompactWidget";

const GB = 1024 * 1024 * 1024;

const statsWithoutGpu: SystemStatsPayload = {
  cpu: {
    name: "AMD Ryzen",
    usage: 42,
    frequency: 4200,
    cores: 8,
    logical_cores: 16,
    per_core_usage: [],
    temperature: 61,
    power: 72,
  },
  ram: {
    total: 32 * GB,
    used: 16 * GB,
    available: 16 * GB,
    usage_percent: 50,
  },
  gpu: null,
  timestamp: Date.now(),
};

describe("CompactWidget", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("falls back to a valid default opacity when the stored value is invalid", () => {
    window.localStorage.setItem("pulse_mini_mode_opacity", "not-a-number");

    render(<CompactWidget stats={statsWithoutGpu} onExpand={() => {}} />);

    const opacitySlider = screen.getByRole("slider", {
      name: /background opacity/i,
    }) as HTMLInputElement;
    expect(opacitySlider.value).toBe("40");
  });

  it("does not let the hidden opacity slider intercept pointer interactions", () => {
    render(<CompactWidget stats={statsWithoutGpu} onExpand={() => {}} />);

    const opacitySlider = screen.getByRole("slider", {
      name: /background opacity/i,
    });

    expect(opacitySlider.className).toContain("pointer-events-none");
    expect(opacitySlider.className).toContain(
      "group-hover/slider:pointer-events-auto"
    );
  });

  it("keeps the FPS state visible when no game is detected", () => {
    render(
      <CompactWidget
        stats={statsWithoutGpu}
        onExpand={() => {}}
        fpsStatus="no_game"
      />
    );

    expect(screen.getByText(/no game/i)).toBeTruthy();
  });

  it("does not present a missing GPU as a zero-usage GPU", () => {
    render(<CompactWidget stats={statsWithoutGpu} onExpand={() => {}} />);

    expect(screen.getByText("GPU")).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("shows a compact HWiNFO marker when CPU temperature needs a provider", () => {
    render(
      <CompactWidget
        stats={{
          ...statsWithoutGpu,
          cpu: {
            ...statsWithoutGpu.cpu,
            temperature: null,
            core_temperatures: null,
            power: null,
          },
        }}
        onExpand={() => {}}
        temperatureStatus="provider_unavailable"
      />
    );

    expect(screen.getByTitle("HWiNFO64 Sensor mode required").textContent).toBe("HW");
  });

  it("renders zero temperature and power values instead of treating them as missing", () => {
    render(
      <CompactWidget
        stats={{
          ...statsWithoutGpu,
          cpu: {
            ...statsWithoutGpu.cpu,
            temperature: 0,
            power: 0,
          },
          gpu: {
            name: "NVIDIA GeForce RTX 4070",
            usage: 0,
            memory_total: 12 * GB,
            memory_used: 4 * GB,
            temperature: 0,
            power: 0,
          },
        }}
        onExpand={() => {}}
      />
    );

    expect(screen.getAllByText("0°")).toHaveLength(2);
    expect(screen.getAllByText("0W")).toHaveLength(2);
  });

  it("shows GPU power when HWiNFO populates it", () => {
    render(
      <CompactWidget
        stats={{
          ...statsWithoutGpu,
          gpu: {
            name: "NVIDIA GeForce RTX 4070",
            usage: 42,
            memory_total: 12 * GB,
            memory_used: 4 * GB,
            power: 88,
          },
        }}
        onExpand={() => {}}
      />
    );

    expect(screen.getByText("88W")).toBeTruthy();
  });
});
