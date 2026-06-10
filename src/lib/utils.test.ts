import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatTemperature,
  getTemperatureColor,
} from "./utils";
import { formatFps, getFpsColor } from "@/features/dashboard/hooks/useFpsStats";

describe("formatBytes", () => {
  it("formats zero bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes with binary units", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
  });
});

describe("formatTemperature", () => {
  it("formats celsius values without decimals", () => {
    expect(formatTemperature(42.4)).toBe("42°C");
    expect(formatTemperature(42.6)).toBe("43°C");
  });
});

describe("getTemperatureColor", () => {
  it("returns a muted normal color when temperature is missing", () => {
    expect(getTemperatureColor(null).level).toBe("normal");
    expect(getTemperatureColor(undefined).textColor).toBe("text-muted-foreground");
  });

  it("classifies CPU temperature thresholds", () => {
    expect(getTemperatureColor(40, "cpu").level).toBe("cool");
    expect(getTemperatureColor(70, "cpu").level).toBe("warm");
    expect(getTemperatureColor(95, "cpu").level).toBe("critical");
  });
});

describe("formatFps", () => {
  it("formats FPS values without decimals", () => {
    expect(formatFps(59.6)).toBe("60");
  });
});

describe("getFpsColor", () => {
  it("returns colors for FPS thresholds", () => {
    expect(getFpsColor(60)).toBe("#22c55e");
    expect(getFpsColor(45)).toBe("#3b82f6");
    expect(getFpsColor(30)).toBe("#f59e0b");
    expect(getFpsColor(29)).toBe("#ef4444");
  });
});
