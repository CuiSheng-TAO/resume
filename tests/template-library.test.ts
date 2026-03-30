import { describe, expect, it } from "vitest";

import type { ResumeContentDocument } from "@/lib/resume-document";
import { createTemplateManifestSignature } from "@/lib/template-manifest";
import { scoreTemplateFit, shortlistTemplateLibrary } from "@/lib/template-matching";
import {
  TEMPLATE_FAMILY_LIBRARY,
  TEMPLATE_FAMILY_LABELS,
  TEMPLATE_FAMILY_ORDER,
  assertUniqueTemplateIds,
} from "@/lib/template-library";

describe("template library", () => {
  const createContentDocument = (
    overrides: Partial<ResumeContentDocument> = {},
  ): ResumeContentDocument => ({
    profile: {
      fullName: "陈星野",
      targetRole: "招聘运营实习生",
      phone: "13800001234",
      email: "chenxingye@example.com",
      location: "杭州",
      summary: "面向招聘运营方向。",
      preferredLocation: "杭州",
      photo: null,
      compactProfileNote: "面向招聘运营方向。",
      ...overrides.profile,
    },
    education: overrides.education ?? [
      {
        id: "edu-1",
        school: "华东师范大学",
        degree: "人力资源管理",
        dateRange: "2022.09-2026.06",
        highlights: [],
      },
    ],
    experiences: overrides.experiences ?? [
      {
        id: "exp-1",
        section: "internship",
        organization: "星桥科技",
        role: "招聘运营实习生",
        dateRange: "2025.10-2026.02",
        priority: 100,
        locked: true,
        rawNarrative: "推进13位候选人进入终面，促成5人入职。",
        bullets: ["推进13位候选人进入终面，促成5人入职。"],
        metrics: ["13位", "5人"],
        tags: ["招聘运营", "招聘漏斗"],
        variants: {
          raw: "推进13位候选人进入终面，促成5人入职。",
          star: "推进13位候选人进入终面，促成5人入职。",
          standard: "推进13位候选人进入终面，促成5人入职。",
          compact: "推进13位候选人进入终面，促成5人入职。",
        },
      },
    ],
    awards: overrides.awards ?? [],
    skills: overrides.skills ?? ["Excel", "ATS", "招聘漏斗分析"],
    intake: overrides.intake ?? {
      mode: "paste",
      turns: [],
    },
    meta: overrides.meta ?? {
      language: "zh-CN",
      targetAudience: "campus-recruiting",
      completeness: "baseline",
      evidenceStrength: "mixed",
    },
  });

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

  it("prioritizes metric-forward templates for metric-dense content", () => {
    const contentDocument = createContentDocument({
      profile: {
        fullName: "陈星野",
        targetRole: "增长运营实习生",
        phone: "13800001234",
        email: "chenxingye@example.com",
        location: "杭州",
        summary: "强调转化率、投放回收和增长结果。",
        preferredLocation: "杭州",
        photo: null,
        compactProfileNote: "强调增长结果。",
      },
      experiences: [
        {
          id: "exp-1",
          section: "internship",
          organization: "增长实验室",
          role: "增长运营实习生",
          dateRange: "2025.03-2025.08",
          priority: 100,
          locked: true,
          rawNarrative: "搭建3条投放链路，线索成本下降21%，拉新转化率提升18%。",
          bullets: ["搭建3条投放链路，线索成本下降21%，拉新转化率提升18%。"],
          metrics: ["3条", "21%", "18%"],
          tags: ["增长", "投放", "转化"],
          variants: {
            raw: "搭建3条投放链路，线索成本下降21%，拉新转化率提升18%。",
            star: "搭建3条投放链路，线索成本下降21%，拉新转化率提升18%。",
            standard: "搭建3条投放链路，线索成本下降21%，拉新转化率提升18%。",
            compact: "搭建3条投放链路，线索成本下降21%，拉新转化率提升18%。",
          },
        },
      ],
      skills: ["Excel", "SQL", "数据分析", "投放优化", "归因分析"],
    });

    const shortlist = shortlistTemplateLibrary(contentDocument, 3);

    expect(shortlist.map((template) => template.templateId)).toEqual([
      "highlight-metrics",
      "classic-banner",
      "highlight-top-block",
    ]);
    expect(
      scoreTemplateFit(
        contentDocument,
        TEMPLATE_FAMILY_LIBRARY.find((template) => template.templateId === "highlight-metrics")!,
      ),
    ).toBeGreaterThan(
      scoreTemplateFit(
        contentDocument,
        TEMPLATE_FAMILY_LIBRARY.find((template) => template.templateId === "academic-ledger")!,
      ),
    );
  });

  it("prioritizes academic templates for education- and research-heavy content", () => {
    const contentDocument = createContentDocument({
      profile: {
        fullName: "陈星野",
        targetRole: "科研助理",
        phone: "13800001234",
        email: "chenxingye@example.com",
        location: "上海",
        summary: "研究方向为组织行为与劳动经济学。",
        preferredLocation: "上海",
        photo: null,
        compactProfileNote: "研究方向为组织行为与劳动经济学。",
      },
      education: [
        {
          id: "edu-1",
          school: "复旦大学",
          degree: "劳动与社会保障",
          dateRange: "2022.09-2026.06",
          highlights: [
            { label: "GPA", value: "3.8/4.0" },
            { label: "排名", value: "专业前 5%" },
          ],
        },
      ],
      experiences: [
        {
          id: "exp-1",
          section: "campus",
          organization: "劳动经济学实验室",
          role: "科研助理",
          dateRange: "2024.09-2025.12",
          priority: 100,
          locked: true,
          rawNarrative: "参与课题访谈编码与文献综述，协助整理研究时间线与阶段结论。",
          bullets: ["参与课题访谈编码与文献综述，协助整理研究时间线与阶段结论。"],
          metrics: [],
          tags: ["科研", "课题", "文献综述"],
          variants: {
            raw: "参与课题访谈编码与文献综述，协助整理研究时间线与阶段结论。",
            star: "参与课题访谈编码与文献综述，协助整理研究时间线与阶段结论。",
            standard: "参与课题访谈编码与文献综述，协助整理研究时间线与阶段结论。",
            compact: "参与课题访谈编码与文献综述，协助整理研究时间线与阶段结论。",
          },
        },
      ],
      awards: [
        {
          id: "award-1",
          title: "国家奖学金",
          priority: 100,
        },
      ],
      skills: ["Python", "Stata", "NVivo"],
    });

    const shortlist = shortlistTemplateLibrary(contentDocument, 3);

    expect(shortlist.map((template) => template.templateId)).toEqual([
      "academic-ledger",
      "academic-signals",
      "academic-timeline",
    ]);
  });
});
