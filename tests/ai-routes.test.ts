import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as extractContentPost } from "@/app/api/ai/extract-content/route";
import { POST as generateTemplatesPost } from "@/app/api/ai/generate-templates/route";
import { POST as intakeTurnPost } from "@/app/api/ai/intake-turn/route";
import { POST as interviewNextPost } from "@/app/api/ai/interview-next/route";
import { POST as rewriteExperiencePost } from "@/app/api/ai/rewrite-experience/route";
import { resetAiRateLimitStore } from "@/lib/ai-rate-limit";
import {
  BASELINE_TEMPLATE_MANIFESTS,
  type TemplateManifest,
} from "@/lib/template-manifest";
import * as anthropicModule from "@/lib/anthropic";

const ORIGINAL_ENV = process.env;

const createTemplateManifest = (
  overrides: Partial<TemplateManifest> & Pick<TemplateManifest, "templateId">,
): TemplateManifest => ({
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
});

const createContentDocument = () => ({
  profile: {
    fullName: "陈星野",
    targetRole: "招聘运营实习生",
    phone: "13800001234",
    email: "chenxingye@example.com",
    location: "杭州",
    summary: "面向招聘运营方向。",
    preferredLocation: "杭州",
    photo: null,
  },
  education: [
    {
      id: "edu-1",
      school: "华东师范大学",
      degree: "人力资源管理",
      dateRange: "2022.09-2026.06",
      highlights: [],
    },
  ],
  experiences: [
    {
      id: "exp-1",
      section: "internship" as const,
      organization: "星桥科技",
      role: "招聘运营实习生",
      dateRange: "2025.10-2026.02",
      priority: 100,
      locked: true,
      rawNarrative: "推进13位候选人进入终面，促成5人入职。",
      bullets: ["推进13位候选人进入终面，促成5人入职。"],
      metrics: ["13位", "5人"],
      tags: ["招聘运营实习生"],
      variants: {
        raw: "推进13位候选人进入终面，促成5人入职。",
        star: "推进13位候选人进入终面，促成5人入职。",
        standard: "推进13位候选人进入终面，促成5人入职。",
        compact: "推进13位候选人进入终面，促成5人入职。",
      },
    },
  ],
  awards: [],
  skills: ["Excel", "ATS", "招聘漏斗分析"],
  intake: {
    mode: "paste" as const,
    turns: [],
  },
  meta: {
    language: "zh-CN" as const,
    targetAudience: "campus-recruiting" as const,
    completeness: "baseline",
    evidenceStrength: "mixed",
  },
});

const createRewriteRequest = (ip = "1.1.1.1") =>
  new Request("http://localhost/api/ai/rewrite-experience", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
    },
    body: JSON.stringify({
      experience: {
        organization: "微派网络科技有限公司",
        role: "招聘实习生",
        rawNarrative:
          "支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      },
    }),
  });

const createIntakeRequest = (ip = "2.2.2.2") =>
  new Request("http://localhost/api/ai/intake-turn", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
    },
    body: JSON.stringify({
      questionIndex: 1,
      latestAnswer: "招聘实习生",
    }),
  });

const createExtractRequest = (ip = "3.3.3.3") =>
  new Request("http://localhost/api/ai/extract-content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
    },
    body: JSON.stringify({
      entryMode: "paste",
      text: [
        "陈星野",
        "目标岗位：招聘运营实习生",
        "电话：13800001234",
        "邮箱：chenxingye@example.com",
        "所在地：杭州",
        "教育：华东师范大学 人力资源管理 2022.09-2026.06",
        "经历：星桥科技 招聘运营实习生 2025.10-2026.02 支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
      ].join("\n"),
    }),
  });

const createSparseExtractRequest = (ip = "3.3.3.4") =>
  new Request("http://localhost/api/ai/extract-content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
    },
    body: JSON.stringify({
      entryMode: "paste",
      text: ["陈星野", "想找招聘相关实习"].join("\n"),
    }),
  });

const createInterviewNextRequest = (ip = "4.4.4.4") =>
  new Request("http://localhost/api/ai/interview-next", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
    },
    body: JSON.stringify({
      contentDocument: {
        profile: {
          fullName: "陈星野",
          targetRole: "招聘运营实习生",
          phone: "13800001234",
          email: "chenxingye@example.com",
          location: "杭州",
          summary: "面向招聘运营方向。",
          preferredLocation: "杭州",
          photo: null,
        },
        education: [
          {
            id: "edu-1",
            school: "华东师范大学",
            degree: "人力资源管理",
            dateRange: "2022.09-2026.06",
            highlights: [],
          },
        ],
        experiences: [
          {
            id: "exp-1",
            section: "internship",
            organization: "星桥科技",
            role: "招聘运营实习生",
            dateRange: "2025.10-2026.02",
            priority: 100,
            locked: true,
            rawNarrative: "支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
            bullets: ["支持多个岗位招聘推进，协助安排面试并跟进候选人流程。"],
            metrics: [],
            tags: ["招聘运营实习生"],
            variants: {
              raw: "支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
              star: "支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
              standard: "支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
              compact: "支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
            },
          },
        ],
        awards: [],
        skills: ["沟通能力", "执行力"],
        intake: {
          mode: "paste",
          turns: [],
        },
        meta: {
          language: "zh-CN",
          targetAudience: "campus-recruiting",
          completeness: "baseline",
          evidenceStrength: "mixed",
        },
      },
      hasDraft: true,
    }),
  });

const createStrongInterviewNextRequest = (ip = "4.4.4.5") =>
  new Request("http://localhost/api/ai/interview-next", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
    },
    body: JSON.stringify({
      contentDocument: {
        profile: {
          fullName: "陈星野",
          targetRole: "招聘运营实习生",
          phone: "13800001234",
          email: "chenxingye@example.com",
          location: "杭州",
          summary: "面向招聘运营方向。",
          preferredLocation: "杭州",
          photo: null,
        },
        education: [
          {
            id: "edu-1",
            school: "华东师范大学",
            degree: "人力资源管理",
            dateRange: "2022.09-2026.06",
            highlights: [{ label: "英语六级", value: "571" }],
          },
        ],
        experiences: [
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
            tags: ["招聘运营实习生"],
            variants: {
              raw: "推进13位候选人进入终面，促成5人入职。",
              star: "推进13位候选人进入终面，促成5人入职。",
              standard: "推进13位候选人进入终面，促成5人入职。",
              compact: "推进13位候选人进入终面，促成5人入职。",
            },
          },
        ],
        awards: [],
        skills: ["Excel", "ATS", "招聘漏斗分析"],
        intake: {
          mode: "paste",
          turns: [],
        },
        meta: {
          language: "zh-CN",
          targetAudience: "campus-recruiting",
          completeness: "baseline",
          evidenceStrength: "mixed",
        },
      },
      hasDraft: true,
    }),
  });

const createGenerateTemplatesRequest = (ip = "5.5.5.5") =>
  new Request("http://localhost/api/ai/generate-templates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
    },
    body: JSON.stringify({
      contentDocument: createContentDocument(),
    }),
  });

describe("AI routes", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    process.env.AI_ROUTE_LIMIT_WINDOW_MS = "60000";
    process.env.AI_ROUTE_LIMIT_MAX_REQUESTS = "1";
    resetAiRateLimitStore();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    resetAiRateLimitStore();
    vi.restoreAllMocks();
  });

  it("falls back locally when rewrite route is not configured with anthropic", async () => {
    const response = await rewriteExperiencePost(createRewriteRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("fallback");
    expect(payload.meta.promptVersion).toBeDefined();
    expect(payload.suggestedBullets[0]).toContain("13位候选人入职");
    expect(payload.variants.star).toContain("13位候选人入职");
    expect(payload.rationale).toBeTruthy();
    expect(response.headers.get("x-ratelimit-remaining")).toBe("0");
  });

  it("does not expose provider fallback reasons in rewrite responses when ai request fails", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-test";
    vi.spyOn(anthropicModule, "requestAnthropicJson").mockRejectedValue(new Error("boom"));

    const response = await rewriteExperiencePost(createRewriteRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("fallback");
    expect(payload.suggestedBullets[0]).toContain("13位候选人入职");
    expect(payload.message).toBeUndefined();
  });

  it("rate limits repeated rewrite requests from the same ip", async () => {
    await rewriteExperiencePost(createRewriteRequest());

    const response = await rewriteExperiencePost(createRewriteRequest());
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload.message).toContain("请求较多");
  });

  it("keeps intake route available through local fallback", async () => {
    const response = await intakeTurnPost(createIntakeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("fallback");
    expect(payload.nextQuestion).toBeTruthy();
    expect(payload.meta.promptVersion).toBeDefined();
  });

  it("does not expose provider fallback reasons in intake responses when ai request fails", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-test";
    vi.spyOn(anthropicModule, "requestAnthropicJson").mockRejectedValue(new Error("boom"));

    const response = await intakeTurnPost(createIntakeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("fallback");
    expect(payload.nextQuestion).toBeTruthy();
    expect(payload.message).toBeUndefined();
  });

  it("extracts pasted content into structured fields through local fallback", async () => {
    const response = await extractContentPost(createExtractRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("fallback");
    expect(payload.contentDocument.profile.fullName).toBe("陈星野");
    expect(payload.contentDocument.profile.targetRole).toBe("招聘运营实习生");
    expect(payload.contentDocument.education[0].school).toBe("华东师范大学");
    expect(payload.contentDocument.experiences[0].organization).toBe("星桥科技");
    expect(payload.intake.minimumDraftReady).toBe(true);
    expect(payload.meta.promptVersion).toBeDefined();
  });

  it("does not expose provider fallback reasons in extract responses when ai request fails", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-test";
    vi.spyOn(anthropicModule, "requestAnthropicJson").mockRejectedValue(new Error("boom"));

    const response = await extractContentPost(createExtractRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("fallback");
    expect(payload.contentDocument.profile.fullName).toBe("陈星野");
    expect(payload.message).toBeUndefined();
  });

  it("returns core-follow-up progress for sparse pasted input", async () => {
    const response = await extractContentPost(createSparseExtractRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("fallback");
    expect(payload.intake.stage).toBe("core-follow-up");
    expect(payload.intake.minimumDraftReady).toBe(false);
  });

  it("plans a strengthening follow-up for weak metrics and generic skills through local fallback", async () => {
    const response = await interviewNextPost(createInterviewNextRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("fallback");
    expect(payload.stage).toBe("strengthening-follow-up");
    expect(payload.focus).toBe("experience-metrics");
    expect(payload.question).toContain("数字");
    expect(payload.reason).toContain("经历");
    expect(payload.meta.promptVersion).toBeDefined();
  });

  it("does not expose provider fallback reasons in interview responses when ai request fails", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-test";
    vi.spyOn(anthropicModule, "requestAnthropicJson").mockRejectedValue(new Error("boom"));

    const response = await interviewNextPost(createInterviewNextRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("fallback");
    expect(payload.focus).toBe("experience-metrics");
    expect(payload.message).toBeUndefined();
  });

  it("uses a short no-retry ai budget for interview-next requests", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-test";
    const anthropicSpy = vi.spyOn(anthropicModule, "requestAnthropicJson").mockResolvedValue({
      data: {
        stage: "strengthening-follow-up",
        focus: "experience-metrics",
        question: "这段经历里能补一个数字结果吗？",
        reason: "需要补一个数字结果。",
        suggestion: "例如：推进多少候选人进入下一轮。",
      },
      attempts: 1,
    });

    const response = await interviewNextPost(createInterviewNextRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("anthropic");
    expect(anthropicSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: 2500,
        maxRetries: 0,
      }),
    );
  });

  it("returns no follow-up when local fallback sees no remaining weak areas", async () => {
    const response = await interviewNextPost(createStrongInterviewNextRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("fallback");
    expect(payload.nextQuestion).toBeNull();
    expect(payload.meta.promptVersion).toBeDefined();
  });

  it("returns three template candidates from the template generation route", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-test";
    vi.spyOn(anthropicModule, "requestAnthropicJson").mockResolvedValue({
      data: {
        candidates: [
          createTemplateManifest({
            templateId: "candidate-academic",
            name: "Academic",
          }),
          createTemplateManifest({
            templateId: "candidate-compact",
            name: "Compact",
            page: {
              size: "A4",
              marginPreset: "tight",
              layout: "single-column",
            },
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
          }),
          createTemplateManifest({
            templateId: "candidate-banner",
            name: "Banner",
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
        ],
      },
      attempts: 1,
    });

    const response = await generateTemplatesPost(createGenerateTemplatesRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("anthropic");
    expect(payload.candidates).toHaveLength(3);
    expect(payload.candidates.map((manifest: TemplateManifest) => manifest.templateId)).toEqual([
      "candidate-academic",
      "candidate-compact",
      "candidate-banner",
    ]);
    expect(payload.candidates[0]?.displayName).toBe("稳妥简洁");
    expect(payload.candidates[1]?.displayName).toBe("紧凑清晰");
    expect(payload.candidates[2]?.displayName).toBe("重点突出");
    expect(payload.candidates.every((manifest: TemplateManifest) => Boolean(manifest.description))).toBe(
      true,
    );
  });

  it("accepts array-shaped template candidates from anthropic-compatible providers", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-test";
    vi.spyOn(anthropicModule, "requestAnthropicJson").mockResolvedValue({
      data: [
        createTemplateManifest({
          templateId: "candidate-academic",
          name: "Academic",
        }),
        createTemplateManifest({
          templateId: "candidate-compact",
          name: "Compact",
          page: {
            size: "A4",
            marginPreset: "tight",
            layout: "single-column",
          },
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
        }),
        createTemplateManifest({
          templateId: "candidate-banner",
          name: "Banner",
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
      ],
      attempts: 1,
    });

    const response = await generateTemplatesPost(createGenerateTemplatesRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("anthropic");
    expect(payload.candidates).toHaveLength(3);
    expect(payload.candidates.map((manifest: TemplateManifest) => manifest.templateId)).toEqual([
      "candidate-academic",
      "candidate-compact",
      "candidate-banner",
    ]);
    expect(payload.candidates[0]?.displayName).toBe("稳妥简洁");
    expect(payload.candidates[1]?.displayName).toBe("紧凑清晰");
    expect(payload.candidates[2]?.displayName).toBe("重点突出");
    expect(payload.candidates.every((manifest: TemplateManifest) => Boolean(manifest.description))).toBe(
      true,
    );
  });

  it("does not expose provider fallback reasons in template responses when ai is not configured", async () => {
    const response = await generateTemplatesPost(createGenerateTemplatesRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("fallback");
    expect(payload.candidates).toHaveLength(3);
    expect(payload.message).toBeUndefined();
    expect(payload.candidates.every((manifest: TemplateManifest) => manifest.displayName && manifest.description)).toBe(
      true,
    );
  });

  it("does not expose provider fallback reasons in template responses when ai request fails", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-test";
    vi.spyOn(anthropicModule, "requestAnthropicJson").mockRejectedValue(new Error("boom"));

    const response = await generateTemplatesPost(createGenerateTemplatesRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("fallback");
    expect(payload.candidates).toHaveLength(3);
    expect(payload.message).toBeUndefined();
    expect(payload.candidates.every((manifest: TemplateManifest) => manifest.displayName && manifest.description)).toBe(
      true,
    );
  });

  it("replaces invalid generated manifests with baseline manifests", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-test";
    vi.spyOn(anthropicModule, "requestAnthropicJson").mockResolvedValue({
      data: {
        candidates: [
          createTemplateManifest({
            templateId: "candidate-valid",
            name: "Valid",
          }),
          {
            ...createTemplateManifest({
              templateId: "candidate-invalid",
              name: "Invalid",
            }),
            page: {
              size: "A4",
              marginPreset: "balanced",
              layout: "two-column",
            },
          },
        ],
      },
      attempts: 1,
    });

    const response = await generateTemplatesPost(createGenerateTemplatesRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.candidates).toHaveLength(3);
    expect(payload.candidates[0].templateId).toBe("candidate-valid");
    expect(payload.candidates[1].templateId).toBe(BASELINE_TEMPLATE_MANIFESTS[1]?.templateId);
    expect(payload.candidates[2].templateId).toBe(BASELINE_TEMPLATE_MANIFESTS[2]?.templateId);
  });

  it("dedupes repeated generated manifests and replaces them with the next baseline manifest", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-test";
    const duplicate = createTemplateManifest({
      templateId: "candidate-a",
      name: "Candidate A",
      page: {
        size: "A4",
        marginPreset: "tight",
        layout: "single-column",
      },
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
    vi.spyOn(anthropicModule, "requestAnthropicJson").mockResolvedValue({
      data: {
        candidates: [
          duplicate,
          {
            ...duplicate,
            templateId: "candidate-b",
            name: "Candidate B",
          },
          createTemplateManifest({
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
        ],
      },
      attempts: 1,
    });

    const response = await generateTemplatesPost(createGenerateTemplatesRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.candidates).toHaveLength(3);
    expect(payload.candidates[0].templateId).toBe("candidate-a");
    expect(payload.candidates[1].templateId).toBe("candidate-c");
    expect(payload.candidates[2].templateId).toBe(BASELINE_TEMPLATE_MANIFESTS[0]?.templateId);
  });

  it("returns baseline choices when template generation AI is unavailable", async () => {
    const response = await generateTemplatesPost(createGenerateTemplatesRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("fallback");
    expect(payload.candidates).toHaveLength(3);
    expect(payload.candidates.map((manifest: TemplateManifest) => manifest.templateId)).toEqual(
      BASELINE_TEMPLATE_MANIFESTS.map((manifest) => manifest.templateId),
    );
    expect(payload.candidates.every((manifest: TemplateManifest) => manifest.displayName && manifest.description)).toBe(
      true,
    );
    expect(payload.meta.promptVersion).toBeDefined();
  });
});
