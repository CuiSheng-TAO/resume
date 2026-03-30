import { createElement } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildWorkspaceFromIntakeAnswers } from "@/lib/intake";
import { exportResumeHtml, exportResumeJson, printToPdf } from "@/lib/export";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resume export", () => {
  it("routes html export and pdf printing through the shared template renderer entrypoint", async () => {
    vi.resetModules();

    const createResumeRenderTree = vi.fn(() =>
      createElement(
        "section",
        { "data-testid": "shared-renderer-output" },
        "shared renderer output",
      ),
    );
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

    vi.doMock("@/lib/template-renderer", () => ({
      createResumeRenderTree,
      resolveTemplateManifestForWorkspace,
      RESUME_DOCUMENT_CSS: ".resume-sheet { color: black; }",
    }));

    const [{ exportResumeHtml, printToPdf }, { buildWorkspaceFromIntakeAnswers: buildWorkspace }] =
      await Promise.all([
        import("@/lib/export"),
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

    const html = exportResumeHtml(workspace);

    expect(resolveTemplateManifestForWorkspace).toHaveBeenCalledWith(workspace);
    expect(createResumeRenderTree).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace,
        manifest: expect.objectContaining({
          templateId: "flagship-reference",
        }),
      }),
    );
    expect(html).toContain("shared renderer output");

    const focus = vi.fn();
    const print = vi.fn();
    const remove = vi.fn();
    const appendChild = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation(((node: Node) => node) as typeof document.body.appendChild);
    const originalCreateElement = document.createElement.bind(document);
    let createdIframe: HTMLIFrameElement | null = null;

    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName === "iframe") {
        createdIframe = {
          style: {} as CSSStyleDeclaration,
          srcdoc: "",
          onload: null,
          remove,
          contentWindow: {
            focus,
            print,
          } as unknown as Window,
        } as unknown as HTMLIFrameElement;

        return createdIframe;
      }

      return originalCreateElement(tagName);
    }) as typeof document.createElement);

    printToPdf(workspace);

    expect(appendChild).toHaveBeenCalledWith(createdIframe);
    expect(createdIframe?.srcdoc).toContain("shared renderer output");

    vi.doUnmock("@/lib/template-renderer");
  });

  it("renders the flagship reference sections and header facts", () => {
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

    const html = exportResumeHtml(workspace);

    expect(html).toContain("政治面貌");
    expect(html).toContain("期望地点");
    expect(html).toContain("教育背景");
    expect(html).toContain("实习经历");
    expect(html).toContain("在校经历");
    expect(html).toContain("奖项荣誉");
    expect(html).toContain("专业技能");
    expect(html).toContain("resume-sheet");
    expect(html).toContain("resume-hero");
    expect(html).toContain("resume-section--education");
    expect(html).toContain("resume-section--experience");
    expect(html).toContain("resume-section--awards");
    expect(html).toContain("resume-section--skills");
    expect(html).not.toContain("flagship-header");
    expect(html).not.toContain("flagship-sec-hdr");
    expect(html).not.toContain("flagship-exp-item");
    expect(html).not.toContain("flagship-edu-sub");
  });

  it("builds a printable flagship HTML document with the applicant's key fields", () => {
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

    const html = exportResumeHtml(workspace);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("向金涛");
    expect(html).toContain("中南财经政法大学");
    expect(html).toContain("微派网络科技有限公司");
    expect(html).toContain("实习经历");
    expect(html).toContain("专业技能");
    expect(html).toContain("@page");
  });

  it("keeps exported education entries in most-recent-first order", () => {
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

    const html = exportResumeHtml(workspace);

    expect(html.indexOf("中南财经政法大学")).toBeLessThan(html.indexOf("中国政法大学"));
  });

  it("hides empty awards, campus experience, and skills sections in exported html", () => {
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
      skills: [],
    });

    const html = exportResumeHtml(workspace);

    expect(html).toContain("教育背景");
    expect(html).toContain("实习经历");
    expect(html).not.toContain("在校经历");
    expect(html).not.toContain("奖项荣誉");
    expect(html).not.toContain("专业技能");
    expect(html).not.toContain("resume-section--awards");
    expect(html).not.toContain("resume-section--skills");
  });

  it("uses session order and render-state hidden modules for body section rendering", () => {
    const workspace = buildWorkspaceFromIntakeAnswers({
      fullName: "周见山",
      targetRole: "招聘运营实习生",
      phone: "13800001234",
      email: "zhoujianshan@example.com",
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

    workspace.templateSession = {
      ...workspace.templateSession,
      version: "v1",
      candidateTemplateIds: ["flagship-reference"],
      selectedTemplateId: "flagship-reference",
      moduleOrder: ["profile", "skills", "education", "awards", "experience"],
    };
    workspace.renderState = {
      ...workspace.renderState,
      hiddenModuleIds: ["awards"],
    };

    const html = exportResumeHtml(workspace);

    const skillsIndex = html.indexOf("专业技能");
    const educationIndex = html.indexOf("教育背景");
    const experienceIndex = html.indexOf("实习经历");

    expect(skillsIndex).toBeGreaterThan(-1);
    expect(educationIndex).toBeGreaterThan(-1);
    expect(experienceIndex).toBeGreaterThan(-1);
    expect(skillsIndex).toBeLessThan(educationIndex);
    expect(educationIndex).toBeLessThan(experienceIndex);
    expect(html).not.toContain("奖项荣誉");
  });

  it("escapes hostile full names in the document title", () => {
    const workspace = buildWorkspaceFromIntakeAnswers({
      fullName: '陈星野</title><script>alert("xss")</script>',
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

    const html = exportResumeHtml(workspace);

    expect(html).toContain(
      "<title>陈星野&lt;/title&gt;&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; - 简历</title>",
    );
    expect(html).not.toContain('<script>alert("xss")</script>');
  });

  it("keeps multiline experience bullets as separate exported rows", () => {
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

    const html = exportResumeHtml(workspace);

    expect(html).toContain('<span class="num">(1)</span> 独立完成初筛与约面。');
    expect(html).toContain('<span class="num">(2)</span> 跟进到岗率并复盘流程。');
  });

  it("exports sample-style optional education highlights when present", () => {
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

    const html = exportResumeHtml(workspace);

    expect(html).toContain("英语六级");
    expect(html).toContain("571分");
    expect(html).toContain("普通话等级");
    expect(html).toContain("一乙");
  });

  it("exports a JSON snapshot that includes the three-layer data model", () => {
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

    const json = JSON.parse(exportResumeJson(workspace)) as Record<string, unknown>;

    expect(json.profile).toBeTruthy();
    expect(json.experiences).toBeTruthy();
    expect(json.draft).toBeTruthy();
    expect(json.layoutPlan).toBeTruthy();
  });

  it("still exports HTML when the current draft exceeds one page", () => {
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

    workspace.layoutPlan.exportAllowed = false;
    workspace.layoutPlan.blockingReasons = ["当前内容仍无法稳定落成一页，请继续压缩或删减。"];

    expect(() => exportResumeHtml(workspace)).not.toThrow();
  });

  it("prints the exported resume document from a hidden iframe after the document loads", () => {
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

    const focus = vi.fn();
    const print = vi.fn();
    const remove = vi.fn();
    const appendChild = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation(((node: Node) => node) as typeof document.body.appendChild);
    const originalCreateElement = document.createElement.bind(document);
    let createdIframe: HTMLIFrameElement | null = null;

    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName === "iframe") {
        createdIframe = {
          style: {} as CSSStyleDeclaration,
          srcdoc: "",
          onload: null,
          remove,
          contentWindow: {
            focus,
            print,
          } as Window,
        } as unknown as HTMLIFrameElement;

        return createdIframe;
      }

      return originalCreateElement(tagName);
    }) as typeof document.createElement);

    printToPdf(workspace);

    expect(createdIframe).toBeTruthy();
    expect(appendChild).toHaveBeenCalledWith(createdIframe);
    expect(createdIframe?.srcdoc).toContain("<!DOCTYPE html>");
    expect(createdIframe?.srcdoc).toContain("星桥科技");
    expect(createdIframe?.srcdoc).not.toContain("实时成品预览");
    expect(focus).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();

    createdIframe?.onload?.(new Event("load"));

    expect(focus).toHaveBeenCalled();
    expect(print).toHaveBeenCalled();
  });
});
