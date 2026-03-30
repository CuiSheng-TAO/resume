import type { ContentBalance, ResumeMeasurement } from "@/lib/types";

const A4_HEIGHT_RATIO = 297 / 210;
const OVERFLOW_TOLERANCE_PX = 8;
const REQUIRES_TRIM_PX = 32;
const SPARSE_FILL_RATIO = 0.72;
const DENSE_FILL_RATIO = 0.9;

type MeasureInput = {
  widthPx: number;
  heightPx: number;
};

const CONTENT_SELECTOR = "[data-resume-sheet-content='true']";

const parseCssPixels = (value: string | null | undefined) => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
};

export const measureResumeSheetLayout = ({
  widthPx,
  heightPx,
}: MeasureInput): ResumeMeasurement => {
  const pageHeightPx = Math.round(widthPx * A4_HEIGHT_RATIO);
  const overflowPx = Math.max(Math.round(heightPx - pageHeightPx), 0);

  let status: ResumeMeasurement["status"] = "fits";
  if (overflowPx > REQUIRES_TRIM_PX) {
    status = "requires-trim";
  } else if (overflowPx > OVERFLOW_TOLERANCE_PX) {
    status = "overflow";
  }

  return {
    widthPx,
    heightPx,
    pageHeightPx,
    overflowPx,
    status,
  };
};

export const measureResumeSheetElementLayout = (
  sheetElement: HTMLElement,
): ResumeMeasurement => {
  const sheetRect = sheetElement.getBoundingClientRect();
  const contentElement = sheetElement.querySelector<HTMLElement>(CONTENT_SELECTOR);
  const contentRect = contentElement?.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(sheetElement);
  const paddingTop = parseCssPixels(computedStyle.paddingTop);
  const paddingBottom = parseCssPixels(computedStyle.paddingBottom);
  const contentHeightPx = contentRect?.height ?? Math.max(sheetRect.height - paddingTop - paddingBottom, 0);

  return measureResumeSheetLayout({
    widthPx: sheetRect.width,
    heightPx: contentHeightPx + paddingTop + paddingBottom,
  });
};

export const deriveVisualContentBalance = (
  measurement: ResumeMeasurement | null,
  fallback: ContentBalance,
): ContentBalance => {
  if (!measurement || measurement.pageHeightPx <= 0) {
    return fallback;
  }

  if (measurement.status !== "fits") {
    return "dense";
  }

  const fillRatio = measurement.heightPx / measurement.pageHeightPx;

  if (fillRatio <= SPARSE_FILL_RATIO) {
    return "sparse";
  }

  if (fillRatio >= DENSE_FILL_RATIO) {
    return "dense";
  }

  return "balanced";
};
