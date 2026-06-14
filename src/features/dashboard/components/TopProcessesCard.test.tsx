import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopProcessesCard } from "./TopProcessesCard";

describe("TopProcessesCard", () => {
  it("labels the process list as system-wide", () => {
    render(
      <TopProcessesCard
        processes={[
          {
            pid: 10,
            name: "msedgewebview2.exe",
            cpu_usage: 1.5,
            memory: 64_000_000,
          },
        ]}
      />
    );

    expect(screen.getByText("System Top Processes")).toBeTruthy();
    expect(screen.getByText("msedgewebview2.exe")).toBeTruthy();
  });
});
