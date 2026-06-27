import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "./Sparkline";

describe("Sparkline", () => {
  it("does not pad missing history with fake zero-value samples", () => {
    const { container } = render(<Sparkline data={[60]} color="#22c55e" />);

    expect(container.querySelector("path")).toBeNull();
  });

  it("uses unique gradient ids for same-colored sparklines", () => {
    const { container } = render(
      <>
        <Sparkline data={[10, 20, 30]} color="#22c55e" />
        <Sparkline data={[30, 20, 10]} color="#22c55e" />
      </>
    );

    const gradientIds = Array.from(
      container.querySelectorAll("linearGradient")
    ).map((gradient) => gradient.id);

    expect(new Set(gradientIds).size).toBe(gradientIds.length);
  });
});
