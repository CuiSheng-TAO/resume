import { describe, expect, it } from "vitest";

import { createTemplateManifestSignature } from "@/lib/template-manifest";
import {
  TEMPLATE_FAMILY_LIBRARY,
  TEMPLATE_FAMILY_LABELS,
  TEMPLATE_FAMILY_ORDER,
  assertUniqueTemplateIds,
} from "@/lib/template-library";

describe("template library", () => {
  const groupTemplateIdsByFamily = () =>
    TEMPLATE_FAMILY_ORDER.reduce<Record<string, string[]>>((accumulator, familyId) => {
      accumulator[familyId] = TEMPLATE_FAMILY_LIBRARY.filter(
        (template) => template.familyId === familyId,
      ).map((template) => template.templateId);

      return accumulator;
    }, {});

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

  it("balances the first batch across the approved families", () => {
    const groupedTemplateIds = groupTemplateIdsByFamily();

    expect(groupedTemplateIds["warm-professional"]).toEqual([
      "flagship-reference",
      "warm-education-first",
      "warm-experience-first",
      "warm-profile-card",
    ]);
    expect(groupedTemplateIds["calm-academic"]).toEqual([
      "academic-ledger",
      "academic-signals",
      "academic-timeline",
      "academic-compact",
    ]);
    expect(groupedTemplateIds["modern-clean"]).toEqual([
      "compact-elegance",
      "modern-balanced",
      "modern-minimal",
    ]);
    expect(groupedTemplateIds["highlight-forward"]).toEqual([
      "classic-banner",
      "highlight-metrics",
      "highlight-top-block",
    ]);
  });

  it("uses the approved Chinese family labels for every curated template", () => {
    for (const template of TEMPLATE_FAMILY_LIBRARY) {
      expect(template.familyLabel).toBe(TEMPLATE_FAMILY_LABELS[template.familyId]);
    }
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

  it("keeps every curated template recipe unique across the 14-template catalog", () => {
    const signatures = TEMPLATE_FAMILY_LIBRARY.map((template) =>
      createTemplateManifestSignature(template),
    );

    expect(new Set(signatures).size).toBe(TEMPLATE_FAMILY_LIBRARY.length);
  });

  it("keeps the renamed warm profile template structurally different from flagship", () => {
    const manifestById = new Map(
      TEMPLATE_FAMILY_LIBRARY.map((template) => [template.templateId, template] as const),
    );
    const warmProfileCard = manifestById.get("warm-profile-card");
    const flagship = manifestById.get("flagship-reference");

    expect(warmProfileCard).toMatchObject({
      sections: {
        hero: { variant: "stacked-profile-card" },
      },
    });
    expect(createTemplateManifestSignature(warmProfileCard!)).not.toBe(
      createTemplateManifestSignature(flagship!),
    );
  });
});
