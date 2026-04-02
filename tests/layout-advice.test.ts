import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyLayoutSuggestion,
  applyLayoutSuggestionSequence,
  buildLayoutAdvice,
} from "@/lib/layout-advice";
import { recomputeWorkspaceData } from "@/lib/resume-document";
import {
  BASELINE_TEMPLATE_MANIFESTS,
  type TemplateManifest,
} from "@/lib/template-manifest";
import type { ResumeMeasurement, WorkspaceData } from "@/lib/types";
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
    density: "tight",
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
    estimatedLineCount: 28,
    contentBalance: "dense",
    showSummary: false,
  },
  meta: {
    updatedAt: "2026-03-27T11:00:00.000Z",
  },
});

const overflowMeasurement: ResumeMeasurement = {
  widthPx: 700,
  heightPx: 1004,
  pageHeightPx: 990,
  overflowPx: 14,
  status: "overflow",
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

describe("layout advice", () => {
  it("explains overflow and offers safe, ordered suggestions", () => {
    const advice = buildLayoutAdvice(createWorkspace(), overflowMeasurement);

    expect(advice.reasons[0]).toContain("超出 14px");
    expect(advice.suggestions[0]?.kind).toBe("switch-variant");
    expect(advice.suggestions[0]?.id).toContain("exp-3");
    expect(advice.suggestions.every((item) => item.kind === "switch-variant" || item.kind === "tighten-density")).toBe(true);
    expect(advice.sequence.map((item) => item.kind)).toEqual(["switch-variant", "switch-variant"]);
  });

  it("applies an explicit suggestion and recomputes the draft", () => {
    const workspace = createWorkspace();
    const advice = buildLayoutAdvice(workspace, overflowMeasurement);
    const suggestion = advice.suggestions.find((item) => item.kind === "switch-variant");

    expect(suggestion).toBeTruthy();

    const nextWorkspace = applyLayoutSuggestion(workspace, suggestion!);

    expect(nextWorkspace.draft.selectedVariants["exp-3"]).toBe("compact");
    expect(nextWorkspace.layoutPlan.selectedVariants["exp-3"]).toBe("compact");
    expect(nextWorkspace.layoutPlan.exportAllowed).toBe(true);
    expect(nextWorkspace.meta.updatedAt).not.toBe(workspace.meta.updatedAt);
  });

  it("applies the preview sequence only after explicit confirmation", () => {
    const workspace = createWorkspace();
    const advice = buildLayoutAdvice(workspace, overflowMeasurement);

    const nextWorkspace = applyLayoutSuggestionSequence(workspace, advice.sequence);

    expect(nextWorkspace.draft.selectedVariants["exp-3"]).toBe("compact");
    expect(nextWorkspace.draft.selectedVariants["exp-2"]).toBe("compact");
    expect(nextWorkspace.layoutPlan.exportAllowed).toBe(true);
    expect(nextWorkspace.draft.hiddenAwardIds).toEqual(["award-2", "award-1"]);
  });

  it("returns no suggestions when the measured preview already fits", () => {
    const advice = buildLayoutAdvice(createWorkspace(), {
      ...overflowMeasurement,
      overflowPx: 0,
      status: "fits",
    });

    expect(advice.suggestions).toEqual([]);
    expect(advice.sequence).toEqual([]);
  });

  it("reads the active renderState when layoutPlan is stale after a template switch", () => {
    const compactManifest = createManifest({
      templateId: "compact-template",
      compactionPolicy: {
        density: "tight",
        overflowPriority: ["skills", "awards", "experience"],
      },
    });
    const workspace = createWorkspace();
    workspace.templateSession = {
      version: "v1",
      candidateTemplateIds: ["flagship-reference", "compact-template"],
      candidateManifests: [BASELINE_TEMPLATE_MANIFESTS[0]!, compactManifest],
      selectedTemplateId: "compact-template",
      moduleOrder: ["profile", "education", "experience", "awards", "skills"],
    };
    workspace.layoutPlan = {
      ...workspace.layoutPlan,
      density: "airy",
      selectedVariants: {
        "exp-1": "star",
        "exp-2": "star",
        "exp-3": "star",
      },
    };
    workspace.renderState = {
      density: "tight",
      selectedVariants: {
        "exp-1": "star",
        "exp-2": "star",
        "exp-3": "compact",
      },
      lockedExperienceIds: ["exp-1"],
      hiddenExperienceIds: [],
      hiddenAwardIds: [],
      hiddenModuleIds: ["skills"],
      overflowStatus: "overflow",
      exportAllowed: true,
      blockingReasons: [],
    };

    const advice = buildLayoutAdvice(workspace, overflowMeasurement);

    expect(advice.suggestions.some((item) => item.kind === "tighten-density")).toBe(false);
    expect(advice.suggestions[0]).toMatchObject({
      kind: "switch-variant",
      experienceId: "exp-2",
      nextVariant: "standard",
    });
  });

  it("re-derives renderState from the manifest-aware layout result during recompute", () => {
    const skillsFirstManifest = createManifest({
      templateId: "skills-first-template",
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

    const workspace = createWorkspace();
    workspace.templateSession = {
      version: "v1",
      candidateTemplateIds: ["flagship-reference", "skills-first-template"],
      selectedTemplateId: "skills-first-template",
      moduleOrder: ["profile", "education", "experience", "awards", "skills"],
    };
    workspace.renderState = {
      density: "airy",
      selectedVariants: {
        "exp-1": "star",
        "exp-2": "star",
        "exp-3": "star",
      },
      lockedExperienceIds: ["exp-1"],
      hiddenExperienceIds: [],
      hiddenAwardIds: [],
      hiddenModuleIds: [],
      overflowStatus: "overflow",
      exportAllowed: false,
      blockingReasons: ["stale"],
    };

    const nextWorkspace = recomputeWorkspaceData(workspace);

    expect(nextWorkspace.renderState).toMatchObject({
      density: nextWorkspace.layoutPlan.density,
      selectedVariants: nextWorkspace.layoutPlan.selectedVariants,
      hiddenExperienceIds: nextWorkspace.layoutPlan.hiddenExperienceIds,
      hiddenAwardIds: nextWorkspace.layoutPlan.hiddenAwardIds,
      hiddenModuleIds: nextWorkspace.layoutPlan.hiddenModuleIds,
      overflowStatus: nextWorkspace.layoutPlan.overflowStatus,
      exportAllowed: nextWorkspace.layoutPlan.exportAllowed,
      blockingReasons: nextWorkspace.layoutPlan.blockingReasons,
    });
  });

  it("applies the shown suggestion sequence from renderState when layoutPlan is stale after a template switch", () => {
    const compactManifest = createManifest({
      templateId: "compact-template",
      compactionPolicy: {
        density: "tight",
        overflowPriority: ["skills", "awards", "experience"],
      },
    });
    const workspace = createWorkspace();
    workspace.templateSession = {
      version: "v1",
      candidateTemplateIds: ["flagship-reference", "compact-template"],
      candidateManifests: [BASELINE_TEMPLATE_MANIFESTS[0]!, compactManifest],
      selectedTemplateId: "compact-template",
      moduleOrder: ["profile", "education", "experience", "awards", "skills"],
    };
    workspace.layoutPlan = {
      ...workspace.layoutPlan,
      density: "airy",
      selectedVariants: {
        "exp-1": "star",
        "exp-2": "star",
        "exp-3": "star",
      },
      hiddenModuleIds: [],
    };
    workspace.renderState = {
      density: "tight",
      selectedVariants: {
        "exp-1": "star",
        "exp-2": "star",
        "exp-3": "compact",
      },
      lockedExperienceIds: ["exp-1"],
      hiddenExperienceIds: [],
      hiddenAwardIds: [],
      hiddenModuleIds: ["skills"],
      overflowStatus: "overflow",
      exportAllowed: true,
      blockingReasons: [],
    };

    const advice = buildLayoutAdvice(workspace, overflowMeasurement);
    const nextWorkspace = applyLayoutSuggestionSequence(workspace, advice.sequence);

    expect(nextWorkspace.renderState?.selectedVariants["exp-3"]).toBe("compact");
    expect(nextWorkspace.renderState?.selectedVariants["exp-2"]).toBe("compact");
    expect(nextWorkspace.templateSession?.selectedTemplateId).toBe("compact-template");
  });
});
