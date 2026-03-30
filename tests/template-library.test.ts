import { describe, expect, it } from "vitest";

import {
  TEMPLATE_FAMILY_LIBRARY,
  TEMPLATE_FAMILY_ORDER,
  assertUniqueTemplateIds,
} from "@/lib/template-library";

describe("template library", () => {
  it("keeps the curated family order stable", () => {
    expect(TEMPLATE_FAMILY_ORDER).toEqual([
      "warm-professional",
      "calm-academic",
      "modern-clean",
      "highlight-forward",
    ]);
  });

  it("includes the full curated template library", () => {
    expect(TEMPLATE_FAMILY_LIBRARY).toHaveLength(14);
  });

  it("requires curated template ids to stay unique", () => {
    expect(new Set(TEMPLATE_FAMILY_LIBRARY.map((template) => template.templateId)).size).toBe(
      TEMPLATE_FAMILY_LIBRARY.length,
    );
    expect(() =>
      assertUniqueTemplateIds([
        TEMPLATE_FAMILY_LIBRARY[0]!,
        {
          ...TEMPLATE_FAMILY_LIBRARY[1]!,
          templateId: TEMPLATE_FAMILY_LIBRARY[0]!.templateId,
        },
      ]),
    ).toThrow(/duplicate templateId/i);
  });

  it("ships complete card metadata for every curated template", () => {
    for (const template of TEMPLATE_FAMILY_LIBRARY) {
      expect(template.displayName).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.familyId).toBeTruthy();
      expect(template.familyLabel).toBeTruthy();
      expect(template.fitSummary).toBeTruthy();
      expect(template.previewHighlights.length).toBeGreaterThanOrEqual(2);
      expect(template.previewHighlights.every((highlight) => highlight.trim().length > 0)).toBe(true);
    }
  });
});
