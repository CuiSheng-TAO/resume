import { describe, expect, it, vi } from "vitest";

import {
  deriveVisualContentBalance,
  measureResumeSheetElementLayout,
  measureResumeSheetLayout,
} from "@/lib/layout-measure";

describe("measureResumeSheetLayout", () => {
  it("marks a sheet as fitting when content stays within the scaled A4 height", () => {
    const measurement = measureResumeSheetLayout({
      widthPx: 700,
      heightPx: 950,
    });

    expect(measurement.status).toBe("fits");
    expect(measurement.pageHeightPx).toBeGreaterThan(measurement.heightPx);
  });

  it("marks a sheet as overflow when it only exceeds the page by a small amount", () => {
    const measurement = measureResumeSheetLayout({
      widthPx: 700,
      heightPx: 1000,
    });

    expect(measurement.status).toBe("overflow");
    expect(measurement.overflowPx).toBeGreaterThan(0);
  });

  it("marks a sheet as requires-trim when it significantly exceeds the page", () => {
    const measurement = measureResumeSheetLayout({
      widthPx: 700,
      heightPx: 1060,
    });

    expect(measurement.status).toBe("requires-trim");
    expect(measurement.overflowPx).toBeGreaterThan(30);
  });

  it("treats a mostly empty page as sparse even if the fallback balance was dense", () => {
    const measurement = measureResumeSheetLayout({
      widthPx: 700,
      heightPx: 520,
    });

    expect(deriveVisualContentBalance(measurement, "dense")).toBe("sparse");
  });

  it("treats a near-full single page as dense", () => {
    const measurement = measureResumeSheetLayout({
      widthPx: 700,
      heightPx: 965,
    });

    expect(deriveVisualContentBalance(measurement, "balanced")).toBe("dense");
  });

  it("measures the real inner content instead of the fixed A4 shell height", () => {
    document.body.innerHTML = `
      <section data-testid="sheet">
        <div data-resume-sheet-content="true"></div>
      </section>
    `;

    const sheet = document.querySelector("[data-testid='sheet']") as HTMLElement;
    const content = sheet.querySelector("[data-resume-sheet-content='true']") as HTMLElement;
    const getComputedStyleSpy = vi
      .spyOn(window, "getComputedStyle")
      .mockReturnValue({
        paddingTop: "32px",
        paddingBottom: "32px",
      } as CSSStyleDeclaration);

    Object.defineProperty(sheet, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          width: 700,
          height: 990,
        }) as DOMRect,
    });
    Object.defineProperty(content, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          height: 520,
        }) as DOMRect,
    });

    const measurement = measureResumeSheetElementLayout(sheet);

    expect(measurement.heightPx).toBe(584);
    expect(deriveVisualContentBalance(measurement, "balanced")).toBe("sparse");

    getComputedStyleSpy.mockRestore();
  });
});
