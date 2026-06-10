import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CpuCard } from "./CpuCard";

describe("CpuCard", () => {
  it("renders the loading state while waiting for stats", () => {
    render(<CpuCard stats={null} history={[]} />);

    expect(screen.getByText("CPU")).toBeTruthy();
    expect(screen.getByText("Waiting for data...")).toBeTruthy();
  });
});
