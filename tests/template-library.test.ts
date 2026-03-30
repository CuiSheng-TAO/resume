import { describe, expect, it } from "vitest";

import {
  TEMPLATE_FAMILY_LIBRARY,
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
      "warm-photo-right",
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
    expect(
      Object.fromEntries(
        TEMPLATE_FAMILY_LIBRARY.map((template) => [template.templateId, template.familyLabel]),
      ),
    ).toMatchObject({
      "flagship-reference": "温暖专业",
      "warm-education-first": "温暖专业",
      "warm-experience-first": "温暖专业",
      "warm-photo-right": "温暖专业",
      "academic-ledger": "冷静学术",
      "academic-signals": "冷静学术",
      "academic-timeline": "冷静学术",
      "academic-compact": "冷静学术",
      "compact-elegance": "现代清爽",
      "modern-balanced": "现代清爽",
      "modern-minimal": "现代清爽",
      "classic-banner": "重点鲜明",
      "highlight-metrics": "重点鲜明",
      "highlight-top-block": "重点鲜明",
    });
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

  it("uses real layout and section-variant differences across the catalog", () => {
    const manifestById = new Map(
      TEMPLATE_FAMILY_LIBRARY.map((template) => [template.templateId, template] as const),
    );

    expect(manifestById.get("flagship-reference")).toMatchObject({
      sectionOrder: ["education", "experience", "awards", "skills"],
      sections: {
        hero: { variant: "name-left-photo-right" },
        education: { variant: "highlight-strip" },
        experience: { variant: "stacked-bullets" },
      },
    });
    expect(manifestById.get("warm-education-first")).toMatchObject({
      sectionOrder: ["education", "experience", "skills", "awards"],
      sections: {
        hero: { variant: "split-meta-band" },
        education: { variant: "school-emphasis" },
        experience: { variant: "role-first" },
      },
    });
    expect(manifestById.get("warm-experience-first")).toMatchObject({
      sectionOrder: ["experience", "education", "skills", "awards"],
      sections: {
        experience: { variant: "result-callout" },
        awards: { variant: "pill-row" },
        skills: { variant: "label-columns" },
      },
    });
    expect(manifestById.get("warm-photo-right")).toMatchObject({
      sections: {
        hero: { variant: "name-left-photo-right" },
        education: { variant: "compact-rows" },
        skills: { variant: "grouped-chips" },
      },
    });
    expect(manifestById.get("academic-ledger")).toMatchObject({
      sections: {
        hero: { variant: "centered-name-minimal" },
        education: { variant: "school-emphasis" },
        awards: { variant: "two-column-table" },
      },
    });
    expect(manifestById.get("academic-signals")).toMatchObject({
      sections: {
        education: { variant: "signal-grid" },
        experience: { variant: "stacked-bullets" },
        skills: { variant: "inline-tags" },
      },
    });
    expect(manifestById.get("academic-timeline")).toMatchObject({
      sectionOrder: ["education", "experience", "awards", "skills"],
      sections: {
        hero: { variant: "split-meta-band" },
        experience: { variant: "role-first" },
        awards: { variant: "pill-row" },
      },
    });
    expect(manifestById.get("academic-compact")).toMatchObject({
      sections: {
        education: { variant: "compact-rows" },
        experience: { variant: "compact-cards" },
        skills: { variant: "label-columns" },
      },
    });
    expect(manifestById.get("compact-elegance")).toMatchObject({
      sections: {
        hero: { variant: "centered-name-minimal" },
        experience: { variant: "compact-cards" },
      },
    });
    expect(manifestById.get("modern-balanced")).toMatchObject({
      sectionOrder: ["experience", "education", "skills", "awards"],
      sections: {
        hero: { variant: "split-meta-band" },
        experience: { variant: "role-first" },
        skills: { variant: "grouped-chips" },
      },
    });
    expect(manifestById.get("modern-minimal")).toMatchObject({
      sections: {
        hero: { variant: "stacked-profile-card" },
        education: { variant: "compact-rows" },
        skills: { variant: "inline-tags" },
      },
    });
    expect(manifestById.get("classic-banner")).toMatchObject({
      sections: {
        hero: { variant: "classic-banner" },
        experience: { variant: "metric-first" },
      },
    });
    expect(manifestById.get("highlight-metrics")).toMatchObject({
      sectionOrder: ["experience", "education", "skills", "awards"],
      sections: {
        hero: { variant: "classic-banner" },
        experience: { variant: "result-callout" },
        awards: { variant: "pill-row" },
      },
    });
    expect(manifestById.get("highlight-top-block")).toMatchObject({
      sectionOrder: ["skills", "experience", "education", "awards"],
      sections: {
        hero: { variant: "stacked-profile-card" },
        experience: { variant: "metric-first" },
        skills: { variant: "label-columns" },
      },
    });
  });
});
