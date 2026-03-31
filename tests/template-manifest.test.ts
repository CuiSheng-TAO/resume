import { describe, expect, it } from "vitest";

import { deriveInitialTemplateSession } from "@/lib/resume-document";
import { TEMPLATE_FAMILY_LIBRARY } from "@/lib/template-library";
import {
  BASELINE_TEMPLATE_MANIFESTS,
  BASELINE_TEMPLATE_ID_ORDER,
  createTemplateManifestSignature,
  finalizeTemplateManifestCandidates,
  getTemplateManifestById,
  resolveTemplateManifestById,
  templateManifestSchema,
  type TemplateManifest,
} from "@/lib/template-manifest";

type ApprovedManifestOverrides = Partial<
  Omit<TemplateManifest, "page" | "theme" | "sections" | "compactionPolicy">
> & {
  page?: Partial<TemplateManifest["page"]>;
  theme?: Partial<TemplateManifest["theme"]>;
  sections?: Partial<{
    [Key in keyof TemplateManifest["sections"]]: Partial<TemplateManifest["sections"][Key]>;
  }>;
  compactionPolicy?: Partial<TemplateManifest["compactionPolicy"]>;
};

const createApprovedManifestBase = (): TemplateManifest => ({
  version: "v1",
  templateId: "approved-v1",
  name: "Approved V1",
  tone: "academic",
  page: {
    size: "A4",
    marginPreset: "balanced",
    layout: "single-column",
  },
  theme: {
    fontPair: "songti-sans",
    accentColor: "navy",
    dividerStyle: "line",
  },
  sectionOrder: ["education", "experience", "awards", "skills"],
  sections: {
    hero: { variant: "name-left-photo-right" },
    education: { variant: "highlight-strip" },
    experience: { variant: "stacked-bullets" },
    awards: { variant: "two-column-table" },
    skills: { variant: "inline-tags" },
  },
  compactionPolicy: {
    density: "airy",
    overflowPriority: ["awards", "skills", "experience"],
  },
});

const createApprovedManifest = (overrides: ApprovedManifestOverrides = {}): TemplateManifest => ({
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
    hero: {
      ...createApprovedManifestBase().sections.hero,
      ...overrides.sections?.hero,
    },
    education: {
      ...createApprovedManifestBase().sections.education,
      ...overrides.sections?.education,
    },
    experience: {
      ...createApprovedManifestBase().sections.experience,
      ...overrides.sections?.experience,
    },
    awards: {
      ...createApprovedManifestBase().sections.awards,
      ...overrides.sections?.awards,
    },
    skills: {
      ...createApprovedManifestBase().sections.skills,
      ...overrides.sections?.skills,
    },
  },
  compactionPolicy: {
    ...createApprovedManifestBase().compactionPolicy,
    ...overrides.compactionPolicy,
  },
});

describe("template manifest", () => {
  it("accepts manifests that use only approved v1 slot variants", () => {
    const result = templateManifestSchema.safeParse(createApprovedManifest());

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      displayName: "稳妥通用版",
      familyId: "calm-academic",
      familyLabel: "冷静学术",
    });
    expect(result.data?.description).toBeTruthy();
    expect(result.data?.fitSummary).toBeTruthy();
    expect(result.data?.previewHighlights.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves richer card metadata when the manifest already provides it", () => {
    const result = templateManifestSchema.safeParse(
      createApprovedManifest({
        displayName: "自定义标题",
        description: "自定义描述",
        familyId: "modern-clean",
        familyLabel: "现代清爽",
        fitSummary: "适合想自定义卡片文案的模板。",
        previewHighlights: ["自定义亮点 A", "自定义亮点 B"],
      }),
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      displayName: "自定义标题",
      description: "自定义描述",
      familyId: "modern-clean",
      familyLabel: "现代清爽",
      fitSummary: "适合想自定义卡片文案的模板。",
      previewHighlights: ["自定义亮点 A", "自定义亮点 B"],
    });
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
    expect(BASELINE_TEMPLATE_MANIFESTS.map((manifest) => manifest.templateId)).toEqual(
      [...BASELINE_TEMPLATE_ID_ORDER],
    );
    expect(BASELINE_TEMPLATE_MANIFESTS).toHaveLength(3);
    expect(getTemplateManifestById("flagship-reference")).toMatchObject({
      version: "v1",
      templateId: "flagship-reference",
      displayName: "稳妥通用版",
      description: "先把姓名、教育和经历都讲清楚，适合大多数校招简历。",
      familyId: "warm-professional",
      familyLabel: "温暖专业",
      fitSummary: TEMPLATE_FAMILY_LIBRARY.find((manifest) => manifest.templateId === "flagship-reference")
        ?.fitSummary,
      previewHighlights: TEMPLATE_FAMILY_LIBRARY.find(
        (manifest) => manifest.templateId === "flagship-reference",
      )?.previewHighlights,
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

  it("keeps richer metadata after template session normalization", () => {
    const session = deriveInitialTemplateSession([
      {
        ...createApprovedManifest({
          templateId: "candidate-modern",
          name: "Candidate Modern",
        }),
        displayName: "候选卡片名",
        description: "候选卡片描述",
        familyId: "modern-clean",
        familyLabel: "现代清爽",
        fitSummary: "适合在 session 归一化后仍然保留完整卡片文案。",
        previewHighlights: ["亮点一", "亮点二"],
      },
    ]);

    expect(session.candidateManifests).toHaveLength(1);
    expect(session.candidateManifests?.[0]).toMatchObject({
      templateId: "candidate-modern",
      displayName: "候选卡片名",
      description: "候选卡片描述",
      familyId: "modern-clean",
      familyLabel: "现代清爽",
      fitSummary: "适合在 session 归一化后仍然保留完整卡片文案。",
      previewHighlights: ["亮点一", "亮点二"],
    });
  });

  it("keeps baseline manifests as a fixed fallback-only subset of the curated library", () => {
    expect(BASELINE_TEMPLATE_ID_ORDER).toEqual([
      "flagship-reference",
      "compact-elegance",
      "classic-banner",
    ]);
    expect(BASELINE_TEMPLATE_MANIFESTS).toHaveLength(3);
    expect(
      BASELINE_TEMPLATE_MANIFESTS.every((manifest) =>
        TEMPLATE_FAMILY_LIBRARY.some((template) => template.templateId === manifest.templateId),
      ),
    ).toBe(true);
  });

  it("keeps the baseline trio on distinct recipes", () => {
    const baselineSignatures = BASELINE_TEMPLATE_MANIFESTS.map((manifest) =>
      createTemplateManifestSignature(manifest),
    );

    expect(new Set(baselineSignatures).size).toBe(BASELINE_TEMPLATE_MANIFESTS.length);
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
      displayName: "上半页抢眼版",
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
