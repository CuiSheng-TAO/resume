import { describe, expect, it } from "vitest";

import {
  BASELINE_TEMPLATE_MANIFESTS,
  createTemplateManifestSignature,
  finalizeTemplateManifestCandidates,
  getTemplateManifestById,
  resolveTemplateManifestById,
  templateManifestSchema,
} from "@/lib/template-manifest";

const createApprovedManifest = (overrides: Partial<ReturnType<typeof createApprovedManifestBase>> = {}) => ({
  ...createApprovedManifestBase(),
  ...overrides,
  page: {
    ...createApprovedManifestBase().page,
    ...overrides.page,
  },
  theme: {
    ...createApprovedManifestBase().theme,
    ...overrides.theme,
  },
  sectionOrder: overrides.sectionOrder ?? createApprovedManifestBase().sectionOrder,
  sections: {
    ...createApprovedManifestBase().sections,
    ...overrides.sections,
  },
  compactionPolicy: {
    ...createApprovedManifestBase().compactionPolicy,
    ...overrides.compactionPolicy,
  },
});

const createApprovedManifestBase = () => ({
  version: "v1" as const,
  templateId: "approved-v1",
  name: "Approved V1",
  tone: "academic" as const,
  page: {
    size: "A4" as const,
    marginPreset: "balanced" as const,
    layout: "single-column" as const,
  },
  theme: {
    fontPair: "songti-sans" as const,
    accentColor: "navy" as const,
    dividerStyle: "line" as const,
  },
  sectionOrder: ["education", "experience", "awards", "skills"] as const,
  sections: {
    hero: { variant: "name-left-photo-right" as const },
    education: { variant: "highlight-strip" as const },
    experience: { variant: "stacked-bullets" as const },
    awards: { variant: "two-column-table" as const },
    skills: { variant: "inline-tags" as const },
  },
  compactionPolicy: {
    density: "airy" as const,
    overflowPriority: ["awards", "skills", "experience"] as const,
  },
});

describe("template manifest", () => {
  it("accepts manifests that use only approved v1 slot variants", () => {
    const result = templateManifestSchema.safeParse(createApprovedManifest());

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      displayName: "稳妥简洁",
    });
    expect(result.data?.description).toBeTruthy();
  });

  it("rejects unapproved colors, fonts, layouts, and slot variants", () => {
    const result = templateManifestSchema.safeParse({
      version: "v1",
      templateId: "invalid-v1",
      name: "Invalid V1",
      tone: "modern",
      page: {
        size: "A4",
        marginPreset: "balanced",
        layout: "two-column",
      },
      theme: {
        fontPair: "mono-grid",
        accentColor: "violet",
        dividerStyle: "line",
      },
      sectionOrder: ["education", "experience", "awards", "skills"],
      sections: {
        hero: { variant: "magazine-cover" },
        education: { variant: "highlight-strip" },
        experience: { variant: "stacked-bullets" },
        awards: { variant: "two-column-table" },
        skills: { variant: "inline-tags" },
      },
      compactionPolicy: {
        density: "balanced",
        overflowPriority: ["awards", "skills", "experience"],
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining([
        "page.layout",
        "theme.fontPair",
        "theme.accentColor",
        "sections.hero.variant",
      ]),
    );
  });

  it.each([
    ["education", "timeline-grid", "sections.education.variant"],
    ["experience", "story-stack", "sections.experience.variant"],
    ["awards", "medal-wall", "sections.awards.variant"],
    ["skills", "radar-chart", "sections.skills.variant"],
  ])(
    "rejects an unapproved %s slot variant",
    (slot, invalidVariant, expectedPath) => {
      const manifest = createApprovedManifest();
      const result = templateManifestSchema.safeParse({
        ...manifest,
        templateId: `invalid-${slot}`,
        sections: {
          ...manifest.sections,
          [slot]: {
            variant: invalidVariant,
          },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain(expectedPath);
    },
  );

  it("rejects duplicate section order entries", () => {
    const manifest = createApprovedManifest();
    const result = templateManifestSchema.safeParse({
      ...manifest,
      templateId: "duplicate-sections",
      sectionOrder: ["education", "experience", "awards", "awards"],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("sectionOrder");
  });

  it("rejects incomplete section order arrays", () => {
    const manifest = createApprovedManifest();
    const result = templateManifestSchema.safeParse({
      ...manifest,
      templateId: "incomplete-sections",
      sectionOrder: ["education", "experience", "skills"],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("sectionOrder");
  });

  it("keeps the former flagship layout available as the baseline manifest", () => {
    expect(BASELINE_TEMPLATE_MANIFESTS.map((manifest) => manifest.templateId)).toContain(
      "flagship-reference",
    );
    expect(BASELINE_TEMPLATE_MANIFESTS).toHaveLength(3);
    expect(getTemplateManifestById("flagship-reference")).toMatchObject({
      version: "v1",
      templateId: "flagship-reference",
      displayName: "稳妥简洁",
      description: "信息排布最稳，适合大多数校招简历。",
      page: {
        size: "A4",
        layout: "single-column",
      },
      theme: {
        fontPair: "songti-sans",
        accentColor: "navy",
      },
      sections: {
        hero: { variant: "name-left-photo-right" },
        education: { variant: "highlight-strip" },
        experience: { variant: "stacked-bullets" },
        awards: { variant: "two-column-table" },
        skills: { variant: "inline-tags" },
      },
    });
  });

  it("falls back to the baseline manifest when the selected template is unknown", () => {
    expect(resolveTemplateManifestById("missing-template")).toMatchObject({
      templateId: "flagship-reference",
      sections: {
        hero: { variant: "name-left-photo-right" },
      },
    });
  });

  it("treats manifests with the same presentation recipe as duplicates even when ids differ", () => {
    const baselineLike = createApprovedManifest();
    const renamed = createApprovedManifest({
      templateId: "approved-v2",
      name: "Approved V2",
    });

    expect(createTemplateManifestSignature(renamed)).toBe(
      createTemplateManifestSignature(baselineLike),
    );
  });

  it("replaces invalid candidate manifests with distinct baseline manifests", () => {
    const validated = finalizeTemplateManifestCandidates([
      createApprovedManifest({
        templateId: "candidate-hero",
        name: "Candidate Hero",
      }),
      {
        ...createApprovedManifest(),
        templateId: "invalid-layout",
        page: {
          size: "A4",
          marginPreset: "balanced",
          layout: "two-column",
        },
      },
    ]);

    expect(validated).toHaveLength(3);
    expect(validated[0]?.templateId).toBe("candidate-hero");
    expect(validated[1]?.templateId).toBe(BASELINE_TEMPLATE_MANIFESTS[1]?.templateId);
    expect(validated[2]?.templateId).toBe(BASELINE_TEMPLATE_MANIFESTS[2]?.templateId);
  });

  it("dedupes repeated candidate manifests and fills the gap with the next baseline manifest", () => {
    const duplicateSeed = createApprovedManifest({
      templateId: "candidate-a",
      name: "Candidate A",
      theme: {
        fontPair: "humanist-sans",
        accentColor: "forest",
        dividerStyle: "soft",
      },
      sections: {
        hero: { variant: "centered-name-minimal" },
        education: { variant: "compact-rows" },
        experience: { variant: "compact-cards" },
        awards: { variant: "inline-list" },
        skills: { variant: "grouped-chips" },
      },
      compactionPolicy: {
        density: "tight",
        overflowPriority: ["skills", "awards", "experience"],
      },
    });
    const validated = finalizeTemplateManifestCandidates([
      duplicateSeed,
      {
        ...duplicateSeed,
        templateId: "candidate-b",
        name: "Candidate B",
      },
      createApprovedManifest({
        templateId: "candidate-c",
        name: "Candidate C",
        theme: {
          fontPair: "songti-sans",
          accentColor: "burgundy",
          dividerStyle: "bar",
        },
        sections: {
          hero: { variant: "classic-banner" },
          education: { variant: "highlight-strip" },
          experience: { variant: "metric-first" },
          awards: { variant: "two-column-table" },
          skills: { variant: "inline-tags" },
        },
      }),
    ]);

    expect(validated).toHaveLength(3);
    expect(validated[0]?.templateId).toBe("candidate-a");
    expect(validated[1]?.templateId).toBe("candidate-c");
    expect(validated[2]?.templateId).toBe(BASELINE_TEMPLATE_MANIFESTS[0]?.templateId);
    expect(
      new Set(validated.map((manifest) => createTemplateManifestSignature(manifest))).size,
    ).toBe(3);
  });

  it("keeps scanning later candidates until it collects enough valid distinct manifests", () => {
    const validated = finalizeTemplateManifestCandidates([
      {
        ...createApprovedManifest(),
        templateId: "invalid-layout",
        page: {
          size: "A4",
          marginPreset: "balanced",
          layout: "two-column",
        },
      },
      createApprovedManifest({
        templateId: "candidate-a",
        name: "Candidate A",
      }),
      createApprovedManifest({
        templateId: "candidate-b",
        name: "Candidate B",
      }),
      createApprovedManifest({
        templateId: "candidate-c",
        name: "Candidate C",
        theme: {
          fontPair: "songti-sans",
          accentColor: "burgundy",
          dividerStyle: "bar",
        },
        sections: {
          hero: { variant: "classic-banner" },
          education: { variant: "highlight-strip" },
          experience: { variant: "metric-first" },
          awards: { variant: "two-column-table" },
          skills: { variant: "inline-tags" },
        },
      }),
    ]);

    expect(validated).toHaveLength(3);
    expect(validated.map((manifest) => manifest.templateId)).toEqual([
      "candidate-a",
      "candidate-c",
      BASELINE_TEMPLATE_MANIFESTS[1]!.templateId,
    ]);
  });

  it("maps provider-style template candidates into approved internal manifests", () => {
    const validated = finalizeTemplateManifestCandidates([
      {
        id: "template-1",
        label: "经典单栏",
        layout: "single-column",
        theme: "classic",
        colorAccent: "#2B579A",
        fontPairing: "serif-sans",
        sectionOrder: ["profile", "education", "internship", "skills"],
        sections: {
          profile: {
            variant: "banner",
            showPhoto: false,
            showSummary: true,
          },
          education: {
            variant: "standard",
            showHighlights: false,
          },
          internship: {
            variant: "star",
            showMetrics: true,
          },
          skills: {
            variant: "tag-cloud",
            columns: 3,
          },
        },
        compactionPolicy: "preserve-all",
        pageLimit: 1,
      },
    ]);

    expect(validated).toHaveLength(3);
    expect(validated[0]).toMatchObject({
      templateId: "template-1",
      name: "经典单栏",
      displayName: "重点突出",
      tone: "academic",
      page: {
        layout: "single-column",
        marginPreset: "balanced",
      },
      theme: {
        fontPair: "serif-sans",
        accentColor: "navy",
        dividerStyle: "line",
      },
      sectionOrder: ["education", "experience", "skills", "awards"],
      sections: {
        hero: { variant: "classic-banner" },
        education: { variant: "highlight-strip" },
        experience: { variant: "metric-first" },
        skills: { variant: "grouped-chips" },
      },
      compactionPolicy: {
        density: "balanced",
        overflowPriority: ["awards", "skills", "experience"],
      },
    });
    expect(validated[0]?.description).toBeTruthy();
  });
});
