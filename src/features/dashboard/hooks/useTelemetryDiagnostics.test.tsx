import { useEffect } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTelemetryDiagnostics } from "@/lib/tauri";
import type { TelemetryDiagnosticsPayload } from "@/types/stats";
import { useTelemetryDiagnostics } from "./useTelemetryDiagnostics";

vi.mock("@/lib/tauri", () => ({
  getTelemetryDiagnostics: vi.fn(),
}));

function makePayload(totalMemory: number): TelemetryDiagnosticsPayload {
  return {
    total_memory_bytes: totalMemory,
    timestamp: totalMemory,
    processes: [
      {
        pid: 1,
        name: "Pulse.exe",
        role: "pulse",
        memory_bytes: totalMemory,
        cpu_usage: 2.5,
      },
    ],
  };
}

function Probe({ onValue }: { onValue: (value: TelemetryDiagnosticsPayload | null) => void }) {
  const diagnostics = useTelemetryDiagnostics();

  useEffect(() => {
    onValue(diagnostics);
  }, [diagnostics, onValue]);

  return null;
}

describe("useTelemetryDiagnostics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads diagnostics on mount and refreshes every five seconds", async () => {
    const first = makePayload(100);
    const second = makePayload(200);
    vi.mocked(getTelemetryDiagnostics)
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const onValue = vi.fn();

    render(<Probe onValue={onValue} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(onValue).toHaveBeenLastCalledWith(first);

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(onValue).toHaveBeenLastCalledWith(second);
    expect(getTelemetryDiagnostics).toHaveBeenCalledTimes(2);
  });
});
