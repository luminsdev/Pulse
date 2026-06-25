import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TelemetryDiagnosticsPayload } from "@/types/stats";
import { TelemetryDiagnosticsCard } from "./TelemetryDiagnosticsCard";

const diagnostics: TelemetryDiagnosticsPayload = {
  total_memory_bytes: 167_772_160,
  timestamp: 42,
  processes: [
    {
      pid: 10,
      name: "Pulse.exe",
      role: "pulse",
      memory_bytes: 104_857_600,
      cpu_usage: 2.5,
    },
    {
      pid: 11,
      name: "msedgewebview2.exe",
      role: "web_view",
      memory_bytes: 10_485_760,
      cpu_usage: 0.4,
    },
    {
      pid: 12,
      name: "msedgewebview2.exe",
      role: "web_view",
      memory_bytes: 31_457_280,
      cpu_usage: 0.6,
    },
    {
      pid: 13,
      name: "fps-sidecar.exe",
      role: "fps_sidecar",
      memory_bytes: 20_971_520,
      cpu_usage: 1.25,
    },
  ],
};

describe("TelemetryDiagnosticsCard", () => {
  it("shows a grouped Pulse footprint summary", () => {
    render(<TelemetryDiagnosticsCard diagnostics={diagnostics} />);

    expect(screen.getByText(/TELEMETRY SYSTEM FOOTPRINT/i)).toBeTruthy();
    expect(screen.getByText(/TOTAL MEMORY ROOT/i)).toBeTruthy();
    expect(screen.getByText("160 MB")).toBeTruthy();
    expect(screen.getByText("PULSE APP HOST")).toBeTruthy();
    expect(screen.getByText("WEBVIEW2 UI RUNTIME")).toBeTruthy();
    expect(screen.getByText("2 PROCS")).toBeTruthy();
    expect(screen.getByText("FPS TELEMETRY SIDECAR")).toBeTruthy();
    expect(screen.getByText("2.5%")).toBeTruthy();
    expect(screen.getByText("1.0%")).toBeTruthy();
    expect(screen.queryByText("msedgewebview2.exe")).toBeNull();
  });

  it("shows an empty state before diagnostics load", () => {
    render(<TelemetryDiagnosticsCard diagnostics={null} />);

    expect(screen.getByText(/WAITING FOR TELEMETRY DIAGNOSTICS/i)).toBeTruthy();
    expect(screen.getByText("--")).toBeTruthy();
  });
});
