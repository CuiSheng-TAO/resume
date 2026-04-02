import { afterEach, describe, expect, it, vi } from "vitest";

import { balanceResumeDraft } from "@/lib/layout-plan";
import {
  BASELINE_TEMPLATE_MANIFESTS,
  type TemplateManifest,
} from "@/lib/template-manifest";
import type { WorkspaceData } from "@/lib/types";
import * as templateManifestModule from "@/lib/template-manifest";

const createWorkspace = (): WorkspaceData => ({
  profile: {
    fullName: "向金涛",
    targetRole: "招聘实习生",
    phone: "18973111415",
    email: "3294182452@qq.com",
    location: "深圳",
    summary: "希望进入优秀互联网公司从事招聘相关工作。",
    photo: {
      dataUrl: "data:image/png;base64,abc",
      crop: { x: 0, y: 0, zoom: 1 },
      aspect: 0.8,
      width: 800,
      height: 1000,
      quality: "ready",
      fileName: "photo.png",
      sizeBytes: 120000,
    },
  },
  education: [
    {
      id: "edu-1",
      school: "中南财经政法大学",
      degree: "人力资源管理",
      dateRange: "2022.09-2026.06",
    },
  ],
  experiences: [
    {
      id: "exp-1",
      organization: "微派网络科技有限公司",
      role: "招聘实习生",
      dateRange: "2025.10-2026.02",
      priority: 100,
      locked: true,
      rawNarrative:
        "支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      metrics: ["13位入职", "87%目标达成率"],
      tags: ["招聘"],
      variants: {
        raw: "支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
        star: "独立推进运营、美术、技术等10余类岗位招聘闭环，3个月推动13位候选人入职，招聘目标达成率87%。",
        standard: "推进10余类岗位招聘，3个月促成13位候选人入职，目标达成率87%。",
        compact: "推进10余类岗位招聘，促成13人入职，达成率87%。",
      },
    },
    {
      id: "exp-2",
      organization: "深圳深度赋智科技有限公司",
      role: "HR实习生",
      dateRange: "2026.03-2026.04",
      priority: 80,
      locked: false,
      rawNarrative: "负责算法团队实习与社招全流程招聘，推进多位候选人进入offer阶段。",
      metrics: ["120+简历", "offer阶段"],
      tags: ["算法招聘"],
      variants: {
        raw: "负责算法团队实习与社招全流程招聘，推进多位候选人进入offer阶段。",
        star: "负责2个算法组的实习与社招招聘，筛选120+份简历并推进多位候选人进入offer阶段。",
        standard: "负责算法团队招聘，筛选120+份简历并推进候选人进入offer阶段。",
        compact: "负责算法团队招聘，筛选120+份简历并推进offer。",
      },
    },
    {
      id: "exp-3",
      organization: "湖北联投东湖高新集团",
      role: "招聘实习生",
      dateRange: "2024.01-2024.03",
      priority: 50,
      locked: false,
      rawNarrative: "独立参与项目申报经理岗位招聘工作，从简历搜寻到最终入职全过程跟进。",
      metrics: ["100余份简历", "2次面试"],
      tags: ["项目申报"],
      variants: {
        raw: "独立参与项目申报经理岗位招聘工作，从简历搜寻到最终入职全过程跟进。",
        star: "独立推进项目申报经理岗位招聘，从简历搜寻、2次面试到最终入职全程跟进。",
        standard: "独立推进项目申报经理岗位招聘，并跟进入职全流程。",
        compact: "推进项目申报经理岗位招聘并跟进入职。",
      },
    },
  ],
  awards: [
    { id: "award-1", title: "互联网+省级银奖", priority: 20 },
    { id: "award-2", title: "英语六级571", priority: 10 },
  ],
  skills: ["招聘", "候选人沟通", "数据分析"],
  intake: { mode: "guided", turns: [] },
  draft: {
    selectedVariants: {
      "exp-1": "star",
      "exp-2": "star",
      "exp-3": "star",
    },
    lockedExperienceIds: ["exp-1"],
    hiddenExperienceIds: [],
    hiddenAwardIds: [],
    density: "airy",
    moduleOrder: ["profile", "education", "experience", "awards", "skills"],
  },
  layoutPlan: {
    density: "airy",
    hiddenExperienceIds: [],
    hiddenAwardIds: [],
    hiddenModuleIds: [],
    selectedVariants: {
      "exp-1": "star",
      "exp-2": "star",
      "exp-3": "star",
    },
    overflowStatus: "overflow",
    steps: [],
    estimatedLineCount: 0,
    contentBalance: "balanced",
    showSummary: false,
  },
  meta: {
    updatedAt: "2026-03-27T11:00:00.000Z",
  },
});

const attachTemplateState = (
  workspace: WorkspaceData,
  selectedTemplateId = "flagship-reference",
) => {
  workspace.templateSession = {
    version: "v1",
    candidateTemplateIds: ["flagship-reference", selectedTemplateId],
    selectedTemplateId,
    moduleOrder: ["profile", "education", "experience", "awards", "skills"],
  };
  workspace.renderState = {
    density: workspace.draft.density,
    selectedVariants: { ...workspace.draft.selectedVariants },
    lockedExperienceIds: [...workspace.draft.lockedExperienceIds],
    hiddenExperienceIds: [...workspace.draft.hiddenExperienceIds],
    hiddenAwardIds: [...workspace.draft.hiddenAwardIds],
    hiddenModuleIds: [],
    overflowStatus: "overflow",
    exportAllowed: true,
    blockingReasons: [],
  };

  return workspace;
};

const createManifest = (overrides: Partial<TemplateManifest> & Pick<TemplateManifest, "templateId">) =>
  ({
    version: "v1",
    templateId: overrides.templateId,
    name: overrides.name ?? overrides.templateId,
    tone: overrides.tone ?? "academic",
    page: {
      size: "A4",
      marginPreset: "balanced",
      layout: "single-column",
      ...overrides.page,
    },
    theme: {
      fontPair: "songti-sans",
      accentColor: "navy",
      dividerStyle: "line",
      ...overrides.theme,
    },
    sectionOrder: overrides.sectionOrder ?? ["education", "experience", "awards", "skills"],
    sections: {
      hero: { variant: "name-left-photo-right" },
      education: { variant: "highlight-strip" },
      experience: { variant: "stacked-bullets" },
      awards: { variant: "two-column-table" },
      skills: { variant: "inline-tags" },
      ...overrides.sections,
    },
    compactionPolicy: {
      density: "airy",
      overflowPriority: ["awards", "skills", "experience"],
      ...overrides.compactionPolicy,
    },
    displayName: overrides.displayName ?? "稳妥简洁",
    description: overrides.description ?? "结构稳妥，适合先做出一版清楚的校招简历。",
  }) satisfies TemplateManifest;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("balanceResumeDraft", () => {
  it("compacts lower-priority content first before hiding lower-priority sections from the manifest", () => {
    const workspace = createWorkspace();

    const plan = balanceResumeDraft(workspace);

    expect(plan.selectedVariants["exp-1"]).toBe("star");
    expect(plan.selectedVariants["exp-2"]).toBe("compact");
    expect(plan.selectedVariants["exp-3"]).toBe("compact");
    expect(plan.density).toBe("tight");
    expect(plan.hiddenExperienceIds).toEqual([]);
    expect(plan.hiddenAwardIds).toEqual(["award-2", "award-1"]);
    expect(plan.overflowStatus).toBe("fits");
    expect(plan.exportAllowed).toBe(true);
    expect(plan.blockingReasons).toEqual([]);
    expect(plan.contentBalance).toBe("dense");
    expect(plan.showSummary).toBe(false);
  });

  it("keeps an airy density when the content budget is already comfortable", () => {
    const workspace = createWorkspace();
    workspace.experiences = workspace.experiences.slice(0, 1);
    workspace.awards = [];
    workspace.draft.selectedVariants = { "exp-1": "standard" };

    const plan = balanceResumeDraft(workspace);

    expect(plan.density).toBe("airy");
    expect(plan.hiddenExperienceIds).toEqual([]);
    expect(plan.overflowStatus).toBe("fits");
    expect(plan.contentBalance).toBe("sparse");
    expect(plan.showSummary).toBe(true);
  });

  it("restores previously hidden experience when the page becomes sparse again", () => {
    const workspace = createWorkspace();
    const densePlan = balanceResumeDraft(workspace);

    workspace.layoutPlan = densePlan;
    workspace.draft = {
      ...workspace.draft,
      density: densePlan.density,
      selectedVariants: { ...densePlan.selectedVariants },
      hiddenExperienceIds: [...densePlan.hiddenExperienceIds],
      hiddenAwardIds: [...densePlan.hiddenAwardIds],
    };
    workspace.profile.photo = null;
    workspace.awards = [];
    workspace.skills = [];
    workspace.experiences = workspace.experiences.filter((experience) => experience.id !== "exp-2");
    delete workspace.draft.selectedVariants["exp-2"];

    const plan = balanceResumeDraft(workspace);

    expect(plan.hiddenExperienceIds).toEqual([]);
    expect(plan.hiddenAwardIds).toEqual([]);
    expect(plan.density).toBe("airy");
    expect(plan.selectedVariants["exp-3"]).toBe("standard");
    expect(plan.overflowStatus).toBe("fits");
  });

  it("keeps overflow warnings but still allows export when locked content cannot fit on one page", () => {
    const workspace = createWorkspace();
    workspace.experiences = workspace.experiences.map((experience) => ({
      ...experience,
      locked: true,
    }));
    workspace.draft.lockedExperienceIds = workspace.experiences.map((experience) => experience.id);

    const plan = balanceResumeDraft(workspace);

    expect(plan.overflowStatus).toBe("requires-trim");
    expect(plan.exportAllowed).toBe(true);
    expect(plan.blockingReasons?.[0]).toContain("一页");
    expect(plan.headerVariant).toBe("photo-present");
  });

  it("uses the selected manifest budget instead of one flagship-only page budget", () => {
    const roomyManifest = createManifest({
      templateId: "roomy-template",
      page: {
        size: "A4",
        marginPreset: "tight",
        layout: "single-column",
      },
      compactionPolicy: {
        density: "tight",
        overflowPriority: ["awards", "skills", "experience"],
      },
    });
    vi.spyOn(templateManifestModule, "resolveTemplateManifestById").mockImplementation(
      (templateId?: string) =>
        templateId === "roomy-template"
          ? roomyManifest
          : (BASELINE_TEMPLATE_MANIFESTS[0] as TemplateManifest),
    );

    const flagshipPlan = balanceResumeDraft(
      attachTemplateState(createWorkspace(), "flagship-reference"),
    );
    const roomyPlan = balanceResumeDraft(attachTemplateState(createWorkspace(), "roomy-template"));

    expect(flagshipPlan.overflowStatus).toBe("fits");
    expect(flagshipPlan.hiddenAwardIds).toEqual(["award-2", "award-1"]);
    expect(roomyPlan.overflowStatus).toBe("fits");
    expect(roomyPlan.hiddenAwardIds).toEqual([]);
    expect(roomyPlan.templateMode).toBe("roomy-template");
  });

  it("uses the manifest compaction density as the loosest density baseline", () => {
    const compactDefaultManifest = createManifest({
      templateId: "compact-default-template",
      compactionPolicy: {
        density: "tight",
        overflowPriority: ["awards", "skills", "experience"],
      },
    });
    vi.spyOn(templateManifestModule, "resolveTemplateManifestById").mockImplementation(
      (templateId?: string) =>
        templateId === "compact-default-template"
          ? compactDefaultManifest
          : (BASELINE_TEMPLATE_MANIFESTS[0] as TemplateManifest),
    );

    const flagshipWorkspace = attachTemplateState(createWorkspace(), "flagship-reference");
    flagshipWorkspace.experiences = flagshipWorkspace.experiences.slice(0, 1);
    flagshipWorkspace.awards = [];
    flagshipWorkspace.draft.selectedVariants = { "exp-1": "standard" };
    flagshipWorkspace.renderState = {
      ...flagshipWorkspace.renderState!,
      selectedVariants: { "exp-1": "standard" },
    };

    const compactWorkspace = attachTemplateState(createWorkspace(), "compact-default-template");
    compactWorkspace.experiences = compactWorkspace.experiences.slice(0, 1);
    compactWorkspace.awards = [];
    compactWorkspace.draft.selectedVariants = { "exp-1": "standard" };
    compactWorkspace.renderState = {
      ...compactWorkspace.renderState!,
      density: "airy",
      selectedVariants: { "exp-1": "standard" },
    };

    const flagshipPlan = balanceResumeDraft(flagshipWorkspace);
    const compactPlan = balanceResumeDraft(compactWorkspace);

    expect(flagshipPlan.density).toBe("airy");
    expect(compactPlan.density).toBe("tight");
    expect(compactPlan.overflowStatus).toBe("fits");
  });

  it("follows the selected manifest section compaction priority when overflow persists", () => {
    const skillsFirstManifest = createManifest({
      templateId: "skills-first-template",
      page: {
        size: "A4",
        marginPreset: "balanced",
        layout: "single-column",
      },
      compactionPolicy: {
        density: "tight",
        overflowPriority: ["skills", "awards", "experience"],
      },
    });
    vi.spyOn(templateManifestModule, "resolveTemplateManifestById").mockImplementation(
      (templateId?: string) =>
        templateId === "skills-first-template"
          ? skillsFirstManifest
          : (BASELINE_TEMPLATE_MANIFESTS[0] as TemplateManifest),
    );

    const flagshipPlan = balanceResumeDraft(
      attachTemplateState(createWorkspace(), "flagship-reference"),
    );
    const skillsFirstPlan = balanceResumeDraft(
      attachTemplateState(createWorkspace(), "skills-first-template"),
    );

    expect(((flagshipPlan as { hiddenModuleIds?: string[] }).hiddenModuleIds ?? [])).not.toContain(
      "skills",
    );
    expect(
      (skillsFirstPlan as { hiddenModuleIds?: string[] }).hiddenModuleIds ?? [],
    ).toContain("skills");
    expect(skillsFirstPlan.overflowStatus).toBe("fits");
  });

  it("restores hidden sections in the selected manifest sectionOrder when only one can come back", () => {
    const awardsFirstManifest = createManifest({
      templateId: "awards-first-template",
      sectionOrder: ["education", "experience", "awards", "skills"],
      compactionPolicy: {
        density: "tight",
        overflowPriority: ["awards", "skills", "experience"],
      },
    });
    const skillsFirstManifest = createManifest({
      templateId: "skills-first-order-template",
      sectionOrder: ["education", "experience", "skills", "awards"],
      compactionPolicy: {
        density: "tight",
        overflowPriority: ["awards", "skills", "experience"],
      },
    });
    vi.spyOn(templateManifestModule, "resolveTemplateManifestById").mockImplementation(
      (templateId?: string) => {
        if (templateId === "awards-first-template") {
          return awardsFirstManifest;
        }

        if (templateId === "skills-first-order-template") {
          return skillsFirstManifest;
        }

        return BASELINE_TEMPLATE_MANIFESTS[0] as TemplateManifest;
      },
    );

    const createRestorationWorkspace = (templateId: string) => {
      const workspace = attachTemplateState(createWorkspace(), templateId);
      workspace.awards = [{ id: "award-1", title: "互联网+省级银奖", priority: 20 }];
      workspace.skills = ["招聘"];
      workspace.templateSession!.moduleOrder = ["profile", "education", "experience"];
      workspace.renderState = {
        ...workspace.renderState!,
        density: "tight",
        selectedVariants: {
          "exp-1": "star",
          "exp-2": "compact",
          "exp-3": "compact",
        },
        hiddenModuleIds: ["awards", "skills"],
      };

      return workspace;
    };

    const awardsFirstPlan = balanceResumeDraft(
      createRestorationWorkspace("awards-first-template"),
    );
    const skillsFirstPlan = balanceResumeDraft(
      createRestorationWorkspace("skills-first-order-template"),
    );

    expect(awardsFirstPlan.hiddenModuleIds).toEqual(["skills"]);
    expect(skillsFirstPlan.hiddenModuleIds).toEqual(["awards"]);
    expect(awardsFirstPlan.overflowStatus).toBe("fits");
    expect(skillsFirstPlan.overflowStatus).toBe("fits");
  });
});
