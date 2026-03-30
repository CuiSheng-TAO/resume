import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResumePreview } from "@/components/resume-preview";
import { buildWorkspaceFromIntakeAnswers } from "@/lib/intake";
import type { TemplateManifest } from "@/lib/template-manifest";

const buildVariantWorkspace = () => {
  const workspace = buildWorkspaceFromIntakeAnswers({
    fullName: "陈星野",
    targetRole: "招聘运营实习生",
    phone: "13800001234",
    email: "chenxingye@example.com",
    location: "杭州",
    education: {
      school: "华东师范大学",
      degree: "人力资源管理",
      dateRange: "2022.09-2026.06",
    },
    topExperience: {
      organization: "星桥科技",
      role: "招聘运营实习生",
      dateRange: "2025.10-2026.02",
      narrative: "独立完成初筛与约面。跟进到岗率并复盘流程。",
    },
    skills: ["招聘", "沟通协调", "数据分析"],
  }) as any;

  workspace.profile.politicalStatus = "中共党员";
  workspace.profile.preferredLocation = "深圳";
  workspace.profile.websiteUrl = "https://chenxingye.example.com";
  workspace.profile.websiteLabel = "chenxingye.example.com";
  workspace.education[0] = {
    ...workspace.education[0],
    tag: "保研",
    highlights: [
      { label: "综合排名", value: "3/89" },
      { label: "英语六级", value: "571分" },
    ],
  };
  workspace.awards.push({
    id: "award-1",
    title: "全国大学生创新创业大赛省赛银奖",
    priority: 90,
  });
  workspace.awards.push({
    id: "award-2",
    title: "校级优秀学生干部",
    priority: 80,
  });
  workspace.experiences.push({
    id: "exp-campus-1",
    section: "campus",
    organization: "华师就业服务中心",
    organizationNote: "校级组织",
    role: "学生助理",
    dateRange: "2024.03-2025.01",
    priority: 75,
    locked: false,
    rawNarrative: "负责宣讲活动统筹与候选人答疑。",
    bullets: ["负责宣讲活动统筹与候选人答疑。", "沉淀 FAQ 并优化现场签到流程。"],
    metrics: ["服务 300+ 名同学"],
    tags: ["校园"],
    variants: {
      raw: "负责宣讲活动统筹与候选人答疑。沉淀 FAQ 并优化现场签到流程。",
      star: "负责宣讲活动统筹与候选人答疑。沉淀 FAQ 并优化现场签到流程。",
      standard: "负责宣讲活动统筹与候选人答疑。沉淀 FAQ 并优化现场签到流程。",
      compact: "负责宣讲活动统筹与候选人答疑；沉淀 FAQ 并优化现场签到流程。",
    },
  });

  return workspace;
};

const buildVariantManifest = (
  templateId: string,
  sections: TemplateManifest["sections"],
): TemplateManifest => ({
  version: "v1",
  templateId,
  name: templateId,
  displayName: "测试变体",
  description: "用于测试结构分发",
  familyId: "warm-professional",
  familyLabel: "温和专业",
  fitSummary: "用于测试结构分发",
  previewHighlights: ["结构差异", "打印安全"],
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
  sections,
  compactionPolicy: {
    density: "balanced",
    overflowPriority: ["awards", "skills", "experience"],
  },
});

describe("ResumePreview", () => {
  it("selects the active manifest through the shared template renderer and falls back to flagship-reference", async () => {
    vi.resetModules();

    const resolveTemplateManifestForWorkspace = vi.fn(() => ({
      version: "v1" as const,
      templateId: "flagship-reference",
      name: "Flagship Reference",
      displayName: "稳妥简洁",
      description: "信息排布最稳，适合大多数校招简历。",
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
    }));
    const createResumeRenderTree = vi.fn(() => (
      <section data-testid="shared-renderer-output">shared renderer output</section>
    ));

    vi.doMock("@/lib/template-renderer", () => ({
      createResumeRenderTree,
      SHARED_RESUME_CSS: ".resume-sheet { color: black; }",
      resolveTemplateManifestForWorkspace,
    }));

    const [{ ResumePreview: SharedResumePreview }, { buildWorkspaceFromIntakeAnswers: buildWorkspace }] =
      await Promise.all([
        import("@/components/resume-preview"),
        import("@/lib/intake"),
      ]);

    const workspace = buildWorkspace({
      fullName: "陈星野",
      targetRole: "招聘运营实习生",
      phone: "13800001234",
      email: "chenxingye@example.com",
      location: "杭州",
      education: {
        school: "华东师范大学",
        degree: "人力资源管理",
        dateRange: "2022.09-2026.06",
      },
      topExperience: {
        organization: "星桥科技",
        role: "招聘运营实习生",
        dateRange: "2025.10-2026.02",
        narrative: "独立完成初筛与约面。跟进到岗率并复盘流程。",
      },
      skills: ["招聘", "沟通协调"],
    });

    render(<SharedResumePreview workspace={workspace} />);

    expect(screen.getByTestId("shared-renderer-output")).toBeInTheDocument();
    expect(resolveTemplateManifestForWorkspace).toHaveBeenCalledWith(workspace);
    expect(createResumeRenderTree).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace,
        manifest: expect.objectContaining({
          templateId: "flagship-reference",
        }),
      }),
    );

    vi.doUnmock("@/lib/template-renderer");
  });

  it("renders the flagship reference sections through generic resume classes", () => {
    const workspace = buildWorkspaceFromIntakeAnswers({
      fullName: "向金涛",
      targetRole: "招聘实习生",
      phone: "18973111415",
      email: "3294182452@qq.com",
      location: "深圳",
      education: {
        school: "中南财经政法大学",
        degree: "人力资源管理",
        dateRange: "2022.09-2026.06",
      },
      topExperience: {
        organization: "微派网络科技有限公司",
        role: "招聘实习生",
        dateRange: "2025.10-2026.02",
        narrative:
          "支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      },
      skills: ["招聘", "候选人沟通", "数据分析"],
    }) as any;

    workspace.profile.politicalStatus = "中共党员";
    workspace.profile.preferredLocation = "深圳";
    workspace.profile.websiteUrl = "https://www.xiangjintao.top";
    workspace.profile.websiteLabel = "www.xiangjintao.top";
    workspace.awards.push({
      id: "award-1",
      title: "校级优秀学生干部",
      priority: 90,
    });
    workspace.experiences.push({
      id: "exp-campus-1",
      section: "campus",
      organization: "学生干部",
      organizationNote: "",
      role: "班团支书",
      dateRange: "2023.09-2026.06",
      priority: 80,
      locked: false,
      rawNarrative: "负责团建、党建与活动策划。",
      bullets: ["负责团建、党建与活动策划。"],
      metrics: [],
      tags: ["校园"],
      variants: {
        raw: "负责团建、党建与活动策划。",
        star: "负责团建、党建与活动策划。",
        standard: "负责团建、党建与活动策划。",
        compact: "负责团建、党建与活动策划。",
      },
    });

    const { container } = render(<ResumePreview workspace={workspace} />);

    expect(screen.getByText("教育背景")).toBeInTheDocument();
    expect(screen.getByText("实习经历")).toBeInTheDocument();
    expect(screen.getByText("在校经历")).toBeInTheDocument();
    expect(screen.getByText("奖项荣誉")).toBeInTheDocument();
    expect(screen.getByText("专业技能")).toBeInTheDocument();
    expect(screen.getByText(/政治面貌：中共党员/)).toBeInTheDocument();
    expect(screen.getByText(/期望地点：深圳/)).toBeInTheDocument();
    expect(screen.queryByText("待上传")).not.toBeInTheDocument();
    expect(container.querySelector(".resume-sheet")).toBeTruthy();
    expect(container.querySelector(".resume-hero")).toBeTruthy();
    expect(container.querySelector(".resume-section--education")).toBeTruthy();
    expect(container.querySelector(".resume-section--experience")).toBeTruthy();
    expect(container.querySelector(".resume-section--awards")).toBeTruthy();
    expect(container.querySelector(".resume-section--skills")).toBeTruthy();
    expect(container.querySelector(".flagship-header")).toBeNull();
    expect(container.querySelector(".flagship-sec-hdr")).toBeNull();
  });

  it("renders education entries with the most recent date first", () => {
    const workspace = buildWorkspaceFromIntakeAnswers({
      fullName: "向金涛",
      targetRole: "招聘实习生",
      phone: "18973111415",
      email: "3294182452@qq.com",
      location: "深圳",
      education: {
        school: "中国政法大学",
        degree: "法律（非法学）",
        dateRange: "2018.09-2022.06",
      },
      topExperience: {
        organization: "微派网络科技有限公司",
        role: "招聘实习生",
        dateRange: "2025.10-2026.02",
        narrative: "支持招聘推进与候选人沟通。",
      },
      skills: ["招聘", "候选人沟通"],
    }) as any;

    workspace.education = [
      {
        id: "edu-older",
        school: "中国政法大学",
        degree: "法律（非法学）",
        dateRange: "2018.09-2022.06",
        highlights: [],
      },
      {
        id: "edu-newer",
        school: "中南财经政法大学",
        degree: "人力资源管理",
        dateRange: "2022.06-2026.09",
        tag: "保研",
        highlights: [],
      },
    ];

    const { container } = render(<ResumePreview workspace={workspace} />);
    const educationText = container.querySelector(".resume-section--education")?.textContent ?? "";

    expect(educationText.indexOf("中南财经政法大学")).toBeLessThan(educationText.indexOf("中国政法大学"));
  });

  it("renders education highlights in the same most-recent-first order", () => {
    const workspace = buildWorkspaceFromIntakeAnswers({
      fullName: "向金涛",
      targetRole: "招聘实习生",
      phone: "18973111415",
      email: "3294182452@qq.com",
      location: "深圳",
      education: {
        school: "中国政法大学",
        degree: "法律（非法学）",
        dateRange: "2018.09-2022.06",
      },
      topExperience: {
        organization: "微派网络科技有限公司",
        role: "招聘实习生",
        dateRange: "2025.10-2026.02",
        narrative: "支持招聘推进与候选人沟通。",
      },
      skills: ["招聘", "候选人沟通"],
    }) as any;

    workspace.education = [
      {
        id: "edu-older",
        school: "中国政法大学",
        degree: "法律（非法学）",
        dateRange: "2018.09-2022.06",
        highlights: [{ label: "英语六级", value: "571" }],
      },
      {
        id: "edu-newer",
        school: "中南财经政法大学",
        degree: "人力资源管理",
        dateRange: "2022.06-2026.09",
        tag: "保研",
        highlights: [{ label: "综合排名", value: "3/89" }],
      },
    ];

    const { container } = render(<ResumePreview workspace={workspace} />);
    const summaryText = container.querySelector(".resume-education-summary")?.textContent ?? "";

    expect(summaryText.indexOf("综合排名")).toBeLessThan(summaryText.indexOf("英语六级"));
  });

  it("hides empty body sections for sparse preview content", () => {
    const workspace = buildWorkspaceFromIntakeAnswers({
      fullName: "陈星野",
      targetRole: "招聘运营实习生",
      phone: "",
      email: "",
      location: "",
      education: {
        school: "",
        degree: "",
        dateRange: "",
      },
      topExperience: {
        organization: "",
        role: "",
        dateRange: "",
        narrative: "",
      },
      skills: [],
    });

    const { container } = render(<ResumePreview workspace={workspace} />);

    expect(screen.getByText("陈星野")).toBeInTheDocument();
    expect(screen.queryByText("教育背景")).not.toBeInTheDocument();
    expect(screen.queryByText("实习经历")).not.toBeInTheDocument();
    expect(screen.queryByText("在校经历")).not.toBeInTheDocument();
    expect(screen.queryByText("奖项荣誉")).not.toBeInTheDocument();
    expect(screen.queryByText("专业技能")).not.toBeInTheDocument();
    expect(container.querySelector(".resume-section--education")).toBeNull();
    expect(container.querySelector(".resume-section--experience")).toBeNull();
    expect(container.querySelector(".resume-section--awards")).toBeNull();
    expect(container.querySelector(".resume-section--skills")).toBeNull();
  });

  it("injects only scoped shared resume css in preview, not export-only document rules", () => {
    const workspace = buildWorkspaceFromIntakeAnswers({
      fullName: "向金涛",
      targetRole: "招聘实习生",
      phone: "18973111415",
      email: "3294182452@qq.com",
      location: "深圳",
      education: {
        school: "中南财经政法大学",
        degree: "人力资源管理",
        dateRange: "2022.09-2026.06",
      },
      topExperience: {
        organization: "微派网络科技有限公司",
        role: "招聘实习生",
        dateRange: "2025.10-2026.02",
        narrative:
          "支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      },
      skills: ["招聘", "候选人沟通", "数据分析"],
    });

    const { container } = render(<ResumePreview workspace={workspace} />);
    const styleNode = container.querySelector("style");

    expect(styleNode?.textContent).toContain(".resume-sheet");
    expect(styleNode?.textContent).not.toContain("@page");
    expect(styleNode?.textContent).not.toContain("html, body");
    expect(styleNode?.textContent).not.toContain("color-scheme: light only");
  });

  it("hides the hero when render state marks profile as hidden", () => {
    const workspace = buildWorkspaceFromIntakeAnswers({
      fullName: "陈星野",
      targetRole: "招聘运营实习生",
      phone: "13800001234",
      email: "chenxingye@example.com",
      location: "杭州",
      education: {
        school: "华东师范大学",
        degree: "人力资源管理",
        dateRange: "2022.09-2026.06",
      },
      topExperience: {
        organization: "星桥科技",
        role: "招聘运营实习生",
        dateRange: "2025.10-2026.02",
        narrative: "独立完成初筛与约面。跟进到岗率并复盘流程。",
      },
      skills: ["招聘", "沟通协调"],
    }) as any;

    workspace.renderState = {
      ...workspace.renderState,
      hiddenModuleIds: ["profile"],
    };

    const { container } = render(<ResumePreview workspace={workspace} />);

    expect(container.querySelector(".resume-hero")).toBeNull();
    expect(screen.queryByText("陈星野")).not.toBeInTheDocument();
  });

  it("renders each experience bullet as a separate preview row", () => {
    const workspace = buildWorkspaceFromIntakeAnswers({
      fullName: "陈星野",
      targetRole: "招聘运营实习生",
      phone: "13800001234",
      email: "chenxingye@example.com",
      location: "杭州",
      education: {
        school: "华东师范大学",
        degree: "人力资源管理",
        dateRange: "2022.09-2026.06",
      },
      topExperience: {
        organization: "星桥科技",
        role: "招聘运营实习生",
        dateRange: "2025.10-2026.02",
        narrative: "独立完成初筛与约面。跟进到岗率并复盘流程。",
      },
      skills: ["招聘", "沟通协调"],
    }) as any;

    workspace.experiences[0] = {
      ...workspace.experiences[0],
      bullets: ["独立完成初筛与约面。", "跟进到岗率并复盘流程。"],
      variants: {
        raw: "独立完成初筛与约面。 跟进到岗率并复盘流程。",
        star: "独立完成初筛与约面。 跟进到岗率并复盘流程。",
        standard: "独立完成初筛与约面。 跟进到岗率并复盘流程。",
        compact: "独立完成初筛与约面。跟进到岗率并复盘流程。",
      },
    };

    const { container } = render(<ResumePreview workspace={workspace} />);

    const bulletRows = container.querySelectorAll(".resume-experience-item");
    expect(bulletRows).toHaveLength(2);
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("renders optional education highlights in the same sample-style summary line", () => {
    const workspace = buildWorkspaceFromIntakeAnswers({
      fullName: "陈星野",
      targetRole: "招聘运营实习生",
      phone: "13800001234",
      email: "chenxingye@example.com",
      location: "杭州",
      education: {
        school: "华东师范大学",
        degree: "人力资源管理",
        dateRange: "2022.09-2026.06",
      },
      topExperience: {
        organization: "星桥科技",
        role: "招聘运营实习生",
        dateRange: "2025.10-2026.02",
        narrative: "独立完成初筛与约面。跟进到岗率并复盘流程。",
      },
      skills: ["招聘", "沟通协调"],
    });

    workspace.education[0] = {
      ...workspace.education[0],
      highlights: [
        { label: "英语六级", value: "571分" },
        { label: "普通话等级", value: "一乙" },
      ],
    };

    const { container } = render(<ResumePreview workspace={workspace} />);

    const summaryLine = container.querySelector(".resume-education-summary");
    expect(summaryLine?.textContent).toContain("英语六级：571分");
    expect(summaryLine?.textContent).toContain("普通话等级：一乙");
  });

  it("renders split-band and grid-style variants with distinct preview structure", () => {
    const workspace = buildVariantWorkspace();
    const manifest = buildVariantManifest("preview-variant-grid", {
      hero: { variant: "split-meta-band" as never },
      education: { variant: "signal-grid" as never },
      experience: { variant: "result-callout" as never },
      awards: { variant: "pill-row" as never },
      skills: { variant: "label-columns" as never },
    });

    workspace.templateSession = {
      ...workspace.templateSession,
      version: "v1",
      candidateTemplateIds: [manifest.templateId],
      selectedTemplateId: manifest.templateId,
      candidateManifests: [manifest],
    };

    const { container } = render(<ResumePreview workspace={workspace} />);

    expect(container.querySelector(".resume-hero--split-meta-band")).toBeTruthy();
    expect(container.querySelector(".resume-hero-band")).toBeTruthy();
    expect(container.querySelector(".resume-education--signal-grid")).toBeTruthy();
    expect(container.querySelector(".resume-education-signal-grid")).toBeTruthy();
    expect(container.querySelector(".resume-experience--result-callout")).toBeTruthy();
    expect(container.querySelector(".resume-experience-callout")).toBeTruthy();
    expect(container.querySelector(".resume-awards--pill-row")).toBeTruthy();
    expect(container.querySelector(".resume-awards-pill-row")).toBeTruthy();
    expect(container.querySelector(".resume-skills--label-columns")).toBeTruthy();
    expect(container.querySelector(".resume-skills-columns")).toBeTruthy();
  });

  it("renders card and role-first variants with distinct preview structure", () => {
    const workspace = buildVariantWorkspace();
    const manifest = buildVariantManifest("preview-variant-card", {
      hero: { variant: "stacked-profile-card" as never },
      education: { variant: "school-emphasis" as never },
      experience: { variant: "role-first" as never },
      awards: { variant: "two-column-table" },
      skills: { variant: "inline-tags" },
    });

    workspace.templateSession = {
      ...workspace.templateSession,
      version: "v1",
      candidateTemplateIds: [manifest.templateId],
      selectedTemplateId: manifest.templateId,
      candidateManifests: [manifest],
    };

    const { container } = render(<ResumePreview workspace={workspace} />);

    expect(container.querySelector(".resume-hero--stacked-profile-card")).toBeTruthy();
    expect(container.querySelector(".resume-profile-card")).toBeTruthy();
    expect(container.querySelector(".resume-profile-card-main")).toBeTruthy();
    expect(container.querySelector(".resume-education--school-emphasis")).toBeTruthy();
    expect(container.querySelector(".resume-education-school-line")).toBeTruthy();
    expect(container.querySelector(".resume-experience--role-first")).toBeTruthy();
    expect(container.querySelector(".resume-experience-role-first-header")).toBeTruthy();
  });
});
