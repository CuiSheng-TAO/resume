import { describe, expect, it } from "vitest";

import { buildWorkspaceFromIntakeAnswers, buildWorkspaceFromPasteText } from "@/lib/intake";
import {
  assessIntakeProgress,
  planNextIntakeQuestion,
} from "@/lib/intake-engine";
import {
  createBaselineContentDocumentFromGuidedAnswers,
  createBaselineContentDocumentFromPasteText,
} from "@/lib/resume-document";

describe("buildWorkspaceFromIntakeAnswers", () => {
  it("creates a first draft workspace from guided answers", () => {
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

    expect(workspace.profile.fullName).toBe("向金涛");
    expect(workspace.profile.targetRole).toBe("招聘实习生");
    expect(workspace.education).toHaveLength(1);
    expect(workspace.experiences).toHaveLength(1);
    expect(workspace.experiences[0]?.variants.standard).toContain("13位候选人入职");
    expect(workspace.experiences[0]?.variants.compact).toContain("13位候选人");
    expect(workspace.draft.selectedVariants[workspace.experiences[0]!.id]).toBe("standard");
    expect(workspace.layoutPlan.overflowStatus).toBe("fits");
  });

  it("returns a normalized content document for guided intake", () => {
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

    expect(workspace.contentDocument!.profile.fullName).toBe("向金涛");
    expect(workspace.contentDocument!.education).toEqual(workspace.education);
    expect(workspace.contentDocument!.experiences).toEqual(workspace.experiences);
    expect(workspace.contentDocument!.awards).toEqual([]);
    expect(workspace.contentDocument!.skills).toEqual(["招聘", "候选人沟通", "数据分析"]);
    expect(workspace.contentDocument!.intake.mode).toBe("guided");
    expect(workspace.templateSession!.selectedTemplateId).toBe("flagship-reference");
    expect(workspace.renderState!.density).toBe("airy");
    expect(workspace.renderState!.hiddenModuleIds).toEqual([]);
  });

  it("returns a normalized content document for pasted intake", () => {
    const workspace = buildWorkspaceFromPasteText(`
向金涛
目标岗位：招聘实习生
电话：18973111415
邮箱：3294182452@qq.com
所在地：深圳
教育：中南财经政法大学 人力资源管理 2022.09-2026.06
经历：微派网络科技有限公司 招聘实习生 2025.10-2026.02 支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。
    `);

    expect(workspace.contentDocument!.profile.fullName).toBe("向金涛");
    expect(workspace.contentDocument!.profile.targetRole).toBe("招聘实习生");
    expect(workspace.contentDocument!.education[0]).toMatchObject({
      school: "中南财经政法大学",
      degree: "人力资源管理",
      dateRange: "2022.09-2026.06",
    });
    expect(workspace.contentDocument!.experiences[0]).toMatchObject({
      organization: "微派网络科技有限公司",
      role: "招聘实习生",
      dateRange: "2025.10-2026.02",
    });
    expect(workspace.contentDocument!.skills).toEqual(["招聘", "候选人沟通", "流程推进"]);
    expect(workspace.contentDocument!.intake.mode).toBe("paste");
    expect(workspace.templateSession!.selectedTemplateId).toBe("flagship-reference");
  });

  it("parses common label-plus-space lines in pasted intake text", () => {
    const contentDocument = createBaselineContentDocumentFromPasteText(`
向金涛
目标岗位 招聘运营实习生
电话 18973111415
邮箱 xjt18973111415@foxmail.com
所在地 武汉
教育 中国政法大学 法律 2022.06-2029.07
经历 星桥科技 招聘运营实习生 2025.10-2026.02 推进多个岗位招聘流程，协助面试安排和候选人沟通。
    `);

    expect(contentDocument.profile.targetRole).toBe("招聘运营实习生");
    expect(contentDocument.profile.phone).toBe("18973111415");
    expect(contentDocument.profile.email).toBe("xjt18973111415@foxmail.com");
    expect(contentDocument.profile.location).toBe("武汉");
    expect(contentDocument.education[0]).toMatchObject({
      school: "中国政法大学",
      degree: "法律",
      dateRange: "2022.06-2029.07",
    });
    expect(contentDocument.experiences[0]).toMatchObject({
      organization: "星桥科技",
      role: "招聘运营实习生",
      dateRange: "2025.10-2026.02",
    });
  });
});

describe("intake engine", () => {
  it("treats the minimum draft as ready once core profile, contact, education, and one experience skeleton exist", () => {
    const contentDocument = createBaselineContentDocumentFromGuidedAnswers({
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
        narrative: "",
      },
      skills: [],
    });

    const progress = assessIntakeProgress(contentDocument, {
      hasDraft: false,
    });

    expect(progress.minimumDraftReady).toBe(true);
    expect(progress.stage).toBe("early-draft");
    expect(progress.completenessScore).toBeGreaterThanOrEqual(0.6);
  });

  it("switches to strengthening follow-up after the draft exists and evidence is still weak", () => {
    const contentDocument = createBaselineContentDocumentFromGuidedAnswers({
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
        narrative: "支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
      },
      skills: ["沟通能力", "执行力"],
    });

    const progress = assessIntakeProgress(contentDocument, {
      hasDraft: true,
    });
    const nextQuestion = planNextIntakeQuestion(contentDocument, {
      hasDraft: true,
    });

    expect(progress.stage).toBe("strengthening-follow-up");
    expect(progress.weakAreas).toEqual(
      expect.arrayContaining(["experience-metrics", "skills-specificity"]),
    );
    expect(nextQuestion.stage).toBe("strengthening-follow-up");
    expect(nextQuestion.focus).toBe("experience-metrics");
    expect(nextQuestion.question).toContain("数字");
  });
});
