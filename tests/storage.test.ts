import "fake-indexeddb/auto";

import { openDB } from "idb";
import { describe, expect, it } from "vitest";

import { buildWorkspaceFromIntakeAnswers } from "@/lib/intake";
import { deriveInitialTemplateSession } from "@/lib/resume-document";
import { clearWorkspace, loadWorkspace, saveWorkspace } from "@/lib/storage";
import { BASELINE_TEMPLATE_MANIFESTS, type TemplateManifest } from "@/lib/template-manifest";

const createManifest = (overrides: Partial<TemplateManifest> = {}): TemplateManifest => ({
  ...BASELINE_TEMPLATE_MANIFESTS[0]!,
  templateId: overrides.templateId ?? "custom-template",
  name: overrides.name ?? "Custom Template",
  sectionOrder: overrides.sectionOrder ?? ["education", "experience", "awards", "skills"],
  page: {
    ...BASELINE_TEMPLATE_MANIFESTS[0]!.page,
    ...overrides.page,
  },
  theme: {
    ...BASELINE_TEMPLATE_MANIFESTS[0]!.theme,
    ...overrides.theme,
  },
  sections: {
    ...BASELINE_TEMPLATE_MANIFESTS[0]!.sections,
    ...overrides.sections,
  },
  compactionPolicy: {
    ...BASELINE_TEMPLATE_MANIFESTS[0]!.compactionPolicy,
    ...overrides.compactionPolicy,
  },
});

describe("workspace storage", () => {
  it("persists and restores the workspace from IndexedDB", async () => {
    await clearWorkspace();

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
      skills: ["招聘", "沟通"],
    });

    await saveWorkspace(workspace);

    const loaded = await loadWorkspace();

    expect(loaded?.profile.fullName).toBe("向金涛");
    expect(loaded?.experiences[0]?.organization).toBe("微派网络科技有限公司");
    expect(loaded?.meta.updatedAt).toBeTruthy();
  });

  it("restores contentDocument and templateSession from the split persisted payload", async () => {
    await clearWorkspace();

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
      skills: ["招聘", "沟通"],
    });

    await saveWorkspace(workspace);

    const db = await openDB("resume-craft", 1);
    const persisted = await db.get("workspace", "active");
    const loaded = await loadWorkspace();

    expect(persisted.contentDocument.profile.fullName).toBe("向金涛");
    expect(persisted.templateSession.selectedTemplateId).toBe("flagship-reference");
    expect(persisted.renderState.hiddenModuleIds).toEqual([]);
    expect(loaded?.contentDocument!.profile.fullName).toBe("向金涛");
    expect(loaded?.templateSession!.selectedTemplateId).toBe("flagship-reference");
    expect(loaded?.renderState!.density).toBe("airy");
  });

  it("normalizes split persisted templateSession selection and module order to the effective candidate set", async () => {
    await clearWorkspace();

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
      skills: ["招聘", "沟通"],
    });

    const skillsFirstManifest = createManifest({
      templateId: "skills-first-template",
      name: "Skills First",
      sectionOrder: ["skills", "education", "experience", "awards"],
    });
    const awardsFirstManifest = createManifest({
      templateId: "awards-first-template",
      name: "Awards First",
      sectionOrder: ["awards", "experience", "education", "skills"],
    });

    const db = await openDB("resume-craft", 1);
    await db.put(
      "workspace",
      {
        contentDocument: workspace.contentDocument,
        templateSession: {
          version: "v1",
          candidateTemplateIds: [skillsFirstManifest.templateId, awardsFirstManifest.templateId],
          candidateManifests: [skillsFirstManifest, awardsFirstManifest],
          selectedTemplateId: "flagship-reference",
          moduleOrder: ["profile", ...BASELINE_TEMPLATE_MANIFESTS[0]!.sectionOrder],
        },
        renderState: workspace.renderState,
        meta: workspace.meta,
      },
      "active",
    );

    const loaded = await loadWorkspace();

    expect(loaded?.templateSession!.candidateTemplateIds).toEqual([
      skillsFirstManifest.templateId,
      awardsFirstManifest.templateId,
    ]);
    expect(loaded?.templateSession!.candidateManifests?.map((manifest) => manifest.templateId)).toEqual([
      skillsFirstManifest.templateId,
      awardsFirstManifest.templateId,
    ]);
    expect(loaded?.templateSession!.selectedTemplateId).toBe(skillsFirstManifest.templateId);
    expect(loaded?.templateSession!.moduleOrder).toEqual([
      "profile",
      ...skillsFirstManifest.sectionOrder,
    ]);
    expect(loaded?.draft.moduleOrder).toEqual([
      "profile",
      ...skillsFirstManifest.sectionOrder,
    ]);
  });

  it("loads a legacy stored workspace payload through the migration adapter", async () => {
    await clearWorkspace();

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
      skills: ["招聘", "沟通"],
    });

    const { contentDocument: _contentDocument, templateSession: _templateSession, renderState: _renderState, ...legacyWorkspace } =
      workspace;
    const db = await openDB("resume-craft", 1);
    await db.put("workspace", legacyWorkspace, "active");

    const loaded = await loadWorkspace();

    expect(loaded?.profile.fullName).toBe("向金涛");
    expect(loaded?.contentDocument!.profile.fullName).toBe("向金涛");
    expect(loaded?.contentDocument!.experiences[0]?.organization).toBe("微派网络科技有限公司");
    expect(loaded?.templateSession!.selectedTemplateId).toBe("flagship-reference");
    expect(loaded?.renderState!.hiddenModuleIds).toEqual([]);
  });

  it("derives the initial template session order from the selected candidate manifest", () => {
    const skillsFirstManifest = createManifest({
      templateId: "skills-first-template",
      name: "Skills First",
      sectionOrder: ["skills", "education", "experience", "awards"],
    });

    const session = deriveInitialTemplateSession([
      skillsFirstManifest,
      BASELINE_TEMPLATE_MANIFESTS[0]!,
    ]);

    expect(session.selectedTemplateId).toBe(skillsFirstManifest.templateId);
    expect(session.candidateTemplateIds).toEqual([
      skillsFirstManifest.templateId,
      BASELINE_TEMPLATE_MANIFESTS[0]!.templateId,
    ]);
    expect(session.moduleOrder).toEqual([
      "profile",
      ...skillsFirstManifest.sectionOrder,
    ]);
  });

  it("preserves top-level factual edits made after workspace creation when saving and loading", async () => {
    await clearWorkspace();

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
      skills: ["招聘", "沟通"],
    });

    workspace.profile.fullName = "李新";
    workspace.education[0] = {
      ...workspace.education[0]!,
      degree: "工商管理",
    };
    workspace.experiences[0] = {
      ...workspace.experiences[0]!,
      organization: "新锐科技有限公司",
    };
    workspace.skills = [...workspace.skills, "流程优化"];

    await saveWorkspace(workspace);

    const db = await openDB("resume-craft", 1);
    const persisted = await db.get("workspace", "active");
    const loaded = await loadWorkspace();

    expect(persisted.contentDocument.profile.fullName).toBe("李新");
    expect(persisted.contentDocument.education[0].degree).toBe("工商管理");
    expect(persisted.contentDocument.experiences[0].organization).toBe("新锐科技有限公司");
    expect(persisted.contentDocument.skills).toContain("流程优化");
    expect(loaded?.profile.fullName).toBe("李新");
    expect(loaded?.education[0]?.degree).toBe("工商管理");
    expect(loaded?.experiences[0]?.organization).toBe("新锐科技有限公司");
    expect(loaded?.skills).toContain("流程优化");
  });

  it("preserves draft and layout edits made after workspace creation when saving and loading", async () => {
    await clearWorkspace();

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
      skills: ["招聘", "沟通"],
    });

    const experienceId = workspace.experiences[0]!.id;
    workspace.draft.lockedExperienceIds = [];
    workspace.draft.selectedVariants = {
      ...workspace.draft.selectedVariants,
      [experienceId]: "raw",
    };
    workspace.layoutPlan.selectedVariants = {
      ...workspace.layoutPlan.selectedVariants,
      [experienceId]: "raw",
    };

    await saveWorkspace(workspace);

    const db = await openDB("resume-craft", 1);
    const persisted = await db.get("workspace", "active");
    const loaded = await loadWorkspace();

    expect(persisted.renderState.lockedExperienceIds).toEqual([]);
    expect(persisted.renderState.selectedVariants[experienceId]).toBe("raw");
    expect(loaded?.draft.lockedExperienceIds).toEqual([]);
    expect(loaded?.draft.selectedVariants[experienceId]).toBe("raw");
    expect(loaded?.renderState!.lockedExperienceIds).toEqual([]);
    expect(loaded?.renderState!.selectedVariants[experienceId]).toBe("raw");
  });

  it("preserves draft-only edits when saving and loading", async () => {
    await clearWorkspace();

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
      skills: ["招聘", "沟通"],
    });

    const experienceId = workspace.experiences[0]!.id;
    workspace.draft.density = "tight";
    workspace.draft.hiddenExperienceIds = [experienceId];
    workspace.draft.selectedVariants = {
      ...workspace.draft.selectedVariants,
      [experienceId]: "raw",
    };

    await saveWorkspace(workspace);

    const db = await openDB("resume-craft", 1);
    const persisted = await db.get("workspace", "active");
    const loaded = await loadWorkspace();

    expect(persisted.renderState.density).toBe("tight");
    expect(persisted.renderState.hiddenExperienceIds).toEqual([experienceId]);
    expect(persisted.renderState.selectedVariants[experienceId]).toBe("raw");
    expect(loaded?.draft.density).toBe("tight");
    expect(loaded?.draft.hiddenExperienceIds).toEqual([experienceId]);
    expect(loaded?.draft.selectedVariants[experienceId]).toBe("raw");
    expect(loaded?.renderState!.density).toBe("tight");
    expect(loaded?.renderState!.hiddenExperienceIds).toEqual([experienceId]);
    expect(loaded?.renderState!.selectedVariants[experienceId]).toBe("raw");
  });
});
