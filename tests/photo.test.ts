import { describe, expect, it } from "vitest";

import { createPhotoAssetFromProcessed, validatePhotoUpload } from "@/lib/photo";

describe("validatePhotoUpload", () => {
  it("rejects blurry images that would damage print quality", () => {
    const result = validatePhotoUpload({
      width: 180,
      height: 240,
      sizeBytes: 12_000,
      fileName: "small.png",
    });

    expect(result.quality).toBe("invalid");
    expect(result.errors[0]).toContain("至少");
  });

  it("accepts images that meet the print-safe threshold", () => {
    const result = validatePhotoUpload({
      width: 252,
      height: 352,
      sizeBytes: 39_521,
      fileName: "portrait.png",
    });

    expect(result.quality).toBe("ready");
    expect(result.errors).toEqual([]);
  });

  it("rejects landscape snapshots that do not look like a usable portrait", () => {
    const result = validatePhotoUpload({
      width: 1200,
      height: 900,
      sizeBytes: 240_000,
      fileName: "card-on-desk.jpg",
    });

    expect(result.quality).toBe("invalid");
    expect(result.errors[0]).toContain("正面人像");
  });

  it("creates a ready photo asset with processed preview and export variants", () => {
    const result = createPhotoAssetFromProcessed({
      sourceDataUrl: "data:image/jpeg;base64,raw",
      processedDataUrl: "data:image/jpeg;base64,processed",
      width: 900,
      height: 1125,
      fileName: "portrait.jpg",
      sizeBytes: 180_000,
      crop: { x: 0, y: 0, zoom: 1 },
      issues: [],
    });

    expect(result.previewDataUrl).toBe("data:image/jpeg;base64,processed");
    expect(result.processedDataUrl).toBe("data:image/jpeg;base64,processed");
    expect(result.sourceWidth).toBe(900);
    expect(result.sourceHeight).toBe(1125);
    expect(result.processingStatus).toBe("ready");
  });
});
