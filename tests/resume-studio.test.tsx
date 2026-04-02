import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResumeStudio } from "@/components/resume-studio";
import { buildWorkspaceFromIntakeAnswers } from "@/lib/intake";
import * as storage from "@/lib/storage";
import {
  BASELINE_TEMPLATE_MANIFESTS,
  type TemplateManifest,
} from "@/lib/template-manifest";
import * as templateManifestModule from "@/lib/template-manifest";

afterEach(() => {
  vi.restoreAllMocks();
});

vi.setConfig({ testTimeout: 15_000 });

const createManifest = (overrides: Partial<TemplateManifest> & Pick<TemplateManifest, "templateId">) =>
  ({
    version: "v1",
    templateId: overrides.templateId,
    name: overrides.name ?? overrides.templateId,
    displayName: overrides.displayName,
    description: overrides.description,
    familyId: overrides.familyId,
    familyLabel: overrides.familyLabel,
    fitSummary: overrides.fitSummary,
    previewHighlights: overrides.previewHighlights,
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
  }) satisfies TemplateManifest;

const mockAdaptiveIntakeFetch = ({
  extractResponse,
  interviewResponses = [],
  templateResponse,
}: {
  extractResponse?: Record<string, unknown>;
  interviewResponses?: Array<Record<string, unknown>>;
  templateResponse?:
    | Record<string, unknown>
    | ((callIndex: number) => Record<string, unknown> | Promise<Record<string, unknown>>);
}) => {
  let interviewCallCount = 0;
  let templateCallCount = 0;

  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes("/api/ai/extract-content")) {
      return new Response(JSON.stringify(extractResponse ?? {}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/api/ai/interview-next")) {
      const nextPayload =
        interviewResponses[Math.min(interviewCallCount, interviewResponses.length - 1)] ?? {};
      interviewCallCount += 1;

      return new Response(JSON.stringify(nextPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/api/ai/generate-templates")) {
      const currentTemplateCall = templateCallCount;
      templateCallCount += 1;
      const nextPayload =
        typeof templateResponse === "function"
          ? await templateResponse(currentTemplateCall)
          : (templateResponse ?? {});

      return new Response(JSON.stringify(nextPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/api/events")) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
};

describe("ResumeStudio", () => {
  it("shows the two-entry landing state", () => {
    const { container } = render(<ResumeStudio />);

    expect(screen.getByRole("button", { name: "从零开始" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导入旧材料" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "把你的第一版简历先做出来" })).toBeInTheDocument();
    expect(screen.getByText("校招一页简历助手")).toBeInTheDocument();
    expect(screen.queryByText("Siamese Dream")).not.toBeInTheDocument();
    expect(container.querySelector(".hero-title-lockup")).not.toBeNull();
    expect(container.querySelector(".hero-side")).toBeNull();
    expect(screen.getByText("先填写基本信息，再慢慢完善成可投递的一版。")).toBeInTheDocument();
    expect(screen.queryByText("HR Companion Resume Studio")).not.toBeInTheDocument();
  });

  it("walks guided users through one question at a time before generating a draft", async () => {
    const user = userEvent.setup();
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "从零开始" }));

    expect(screen.getByText("我们先从你是谁开始。")).toBeInTheDocument();
    expect(screen.getByLabelText("当前回答")).toBeInTheDocument();
    expect(screen.queryByText("学校 / 专业 / 时间")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("当前回答"), "向金涛");
    await user.click(screen.getByRole("button", { name: "下一题" }));

    expect(screen.getByText("你最想投的岗位是什么？")).toBeInTheDocument();
  });

  it("advances guided core questions locally without waiting for the remote planner", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/api/ai/interview-next")) {
        return new Promise<Response>(() => {});
      }

      if (url.includes("/api/events")) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "从零开始" }));
    await user.type(screen.getByLabelText("当前回答"), "向金涛");
    await user.click(screen.getByRole("button", { name: "下一题" }));

    await screen.findByText("你最想投的岗位是什么？");
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
    expect(
      fetchSpy.mock.calls.filter(([input]) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        return url.includes("/api/ai/interview-next");
      }),
    ).toHaveLength(0);
  });

  it("keeps the guided flow active if a persisted workspace finishes loading after the user already entered it", async () => {
    const user = userEvent.setup();
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

    let resolveLoadWorkspace: ((value: typeof workspace) => void) | undefined;
    vi.spyOn(storage, "loadWorkspace").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoadWorkspace = resolve;
        }),
    );
    vi.spyOn(storage, "saveWorkspace").mockResolvedValue();

    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "从零开始" }));
    expect(screen.getByText("我们先从你是谁开始。")).toBeInTheDocument();

    await act(async () => {
      resolveLoadWorkspace?.(workspace);
      await Promise.resolve();
    });

    expect(screen.getByText("我们先从你是谁开始。")).toBeInTheDocument();
    expect(screen.queryByText("下一步建议")).not.toBeInTheDocument();
  });

  it("keeps contact format guidance visible while the user fills the guided contact answer", async () => {
    const user = userEvent.setup();
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "从零开始" }));
    await user.type(screen.getByLabelText("当前回答"), "陈星野");
    await user.click(screen.getByRole("button", { name: "下一题" }));

    await screen.findByText("你最想投的岗位是什么？");
    await user.type(screen.getByLabelText("当前回答"), "招聘运营实习生");
    await user.click(screen.getByRole("button", { name: "下一题" }));

    await screen.findByText("把电话、邮箱、所在地一次告诉我。");
    expect(screen.getByText("第 1 行：电话")).toBeInTheDocument();
    expect(screen.getByText("第 2 行：邮箱")).toBeInTheDocument();
    expect(screen.getByText("第 3 行：所在地")).toBeInTheDocument();
    expect(screen.getByText("待补：电话、邮箱、所在地")).toBeInTheDocument();

    await user.type(screen.getByLabelText("当前回答"), "13800001234");

    expect(screen.getByText("第 1 行：电话")).toBeInTheDocument();
    expect(screen.getByText("第 2 行：邮箱")).toBeInTheDocument();
    expect(screen.getByText("第 3 行：所在地")).toBeInTheDocument();
    expect(screen.getByText("已识别：电话")).toBeInTheDocument();
    expect(screen.getByText("待补：邮箱、所在地")).toBeInTheDocument();

    await user.type(screen.getByLabelText("当前回答"), "\n3294");

    expect(screen.getByText("已识别：电话、邮箱")).toBeInTheDocument();
    expect(screen.getByText("待补：所在地")).toBeInTheDocument();
    expect(screen.queryByText("已识别：电话、所在地")).not.toBeInTheDocument();
  });

  it("shows persistent helper guidance across the other guided questions", async () => {
    const user = userEvent.setup();
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "从零开始" }));

    expect(screen.getByText("填写项：姓名")).toBeInTheDocument();
    expect(screen.getByText("待补：姓名")).toBeInTheDocument();

    await user.type(screen.getByLabelText("当前回答"), "向金涛");

    expect(screen.getByText("已识别：姓名")).toBeInTheDocument();
    expect(screen.queryByText("待补：姓名")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下一题" }));
    await screen.findByText("你最想投的岗位是什么？");

    expect(screen.getByText("填写项：目标岗位")).toBeInTheDocument();
    expect(screen.getByText("待补：目标岗位")).toBeInTheDocument();

    await user.type(screen.getByLabelText("当前回答"), "招聘实习生");

    expect(screen.getByText("已识别：目标岗位")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下一题" }));
    await screen.findByText("把电话、邮箱、所在地一次告诉我。");
    await user.type(
      screen.getByLabelText("当前回答"),
      "13800001234\nchenxingye@example.com\n杭州",
    );
    await user.click(screen.getByRole("button", { name: "下一题" }));

    await screen.findByText("学校、专业、时间怎么写？");
    expect(screen.getByText("第 1 行：学校")).toBeInTheDocument();
    expect(screen.getByText("第 2 行：专业")).toBeInTheDocument();
    expect(screen.getByText("第 3 行：时间")).toBeInTheDocument();
    expect(screen.getByText("待补：学校、专业、时间")).toBeInTheDocument();

    await user.type(screen.getByLabelText("当前回答"), "中国政法大学\n法律");

    expect(screen.getByText("已识别：学校、专业")).toBeInTheDocument();
    expect(screen.getByText("待补：时间")).toBeInTheDocument();
    expect(
      screen.getByText("如果还有第二段教育，先填时间最近的一段；起稿后点“新增教育背景”继续补。"),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("当前回答"), "\n2022.09-2026.06");
    await user.click(screen.getByRole("button", { name: "下一题" }));

    await screen.findByText("最重要的一段经历，是在哪里做什么？");
    expect(screen.getByText("第 1 行：组织 / 公司")).toBeInTheDocument();
    expect(screen.getByText("第 2 行：岗位")).toBeInTheDocument();
    expect(screen.getByText("第 3 行：时间")).toBeInTheDocument();
    expect(screen.getByText("待补：组织 / 公司、岗位、时间")).toBeInTheDocument();

    await user.type(screen.getByLabelText("当前回答"), "微派网络科技有限公司\n招聘实习生");

    expect(screen.getByText("已识别：组织 / 公司、岗位")).toBeInTheDocument();
    expect(screen.getByText("待补：时间")).toBeInTheDocument();
  });

  it("stops guided intake once minimum completeness is met and lands on a visible first draft", async () => {
    const user = userEvent.setup();
    mockAdaptiveIntakeFetch({
      interviewResponses: [
        {
          mode: "fallback",
          stage: "core-follow-up",
          focus: "target-role",
          question: "你最想投的岗位是什么？",
          reason: "先锁定目标岗位，后面的表达才能收束。",
          suggestion: "先写一个最想投的方向。",
        },
        {
          mode: "fallback",
          stage: "core-follow-up",
          focus: "contact",
          question: "把电话、邮箱、所在地一次告诉我。",
          reason: "先补齐联系方式，草稿就能成型。",
          suggestion: "推荐分 3 行填写，也可以用 / 分隔。",
        },
        {
          mode: "fallback",
          stage: "core-follow-up",
          focus: "education",
          question: "学校、专业、时间怎么写？",
          reason: "教育背景是校招简历的基础骨架。",
          suggestion: "学校 / 专业 / 时间",
        },
        {
          mode: "fallback",
          stage: "core-follow-up",
          focus: "experience-basics",
          question: "最重要的一段经历，是在哪里做什么？",
          reason: "先把最强经历的组织、岗位、时间立起来。",
          suggestion: "组织 / 岗位 / 时间",
        },
        {
          mode: "fallback",
          stage: "strengthening-follow-up",
          focus: "experience-metrics",
          question: "这段经历里能补一个数字结果吗？",
          reason: "第一版已经能生成了，但缺数字会削弱说服力。",
          suggestion: "例如：推进多少候选人进入终面或入职。",
        },
      ],
    });
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "从零开始" }));
    await user.type(screen.getByLabelText("当前回答"), "向金涛");
    await user.click(screen.getByRole("button", { name: "下一题" }));

    await screen.findByText("你最想投的岗位是什么？");
    await user.type(screen.getByLabelText("当前回答"), "招聘实习生");
    await user.click(screen.getByRole("button", { name: "下一题" }));

    await screen.findByText("把电话、邮箱、所在地一次告诉我。");
    await user.type(
      screen.getByLabelText("当前回答"),
      "18973111415\n3294182452@qq.com\n深圳",
    );
    await user.click(screen.getByRole("button", { name: "下一题" }));

    await screen.findByText("学校、专业、时间怎么写？");
    await user.type(
      screen.getByLabelText("当前回答"),
      "中南财经政法大学\n人力资源管理\n2022.09-2026.06",
    );
    await user.click(screen.getByRole("button", { name: "下一题" }));

    await screen.findByText("最重要的一段经历，是在哪里做什么？");
    await user.type(
      screen.getByLabelText("当前回答"),
      "微派网络科技有限公司\n招聘实习生\n2025.10-2026.02",
    );
    expect(screen.getByRole("button", { name: "生成第一版简历" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "生成第一版简历" }));

    await screen.findByText("第一版简历已经出来了");
    expect(screen.getAllByText("向金涛").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("微派网络科技有限公司")).toBeInTheDocument();
    expect(screen.queryByText("第 6 / 7 题")).not.toBeInTheDocument();
    expect(screen.queryByText("下一步建议")).not.toBeInTheDocument();
    expect(screen.queryByText("这段经历里能补一个数字结果吗？")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "继续完善这版" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再加一段教育" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再加一段实习" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再加一段在校经历" })).toBeInTheDocument();
  });

  it("turns pasted text into a starter skeleton preview", async () => {
    const user = userEvent.setup();
    const { container } = render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "向金涛",
        "目标岗位：招聘实习生",
        "电话：18973111415",
        "邮箱：3294182452@qq.com",
        "所在地：深圳",
        "教育：中南财经政法大学 人力资源管理 2022.09-2026.06",
        "经历：微派网络科技有限公司 招聘实习生 2025.10-2026.02 支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));

    expect((await screen.findAllByText("微派网络科技有限公司")).length).toBeGreaterThan(0);
    const previewRail = container.querySelector(".studio-right");
    const editorColumn = container.querySelector(".studio-left");

    expect(previewRail).not.toBeNull();
    expect(editorColumn).not.toBeNull();
    expect(await screen.findByText("第一版简历已经出来了")).toBeInTheDocument();
    expect(screen.getByText("这是第一版，建议先补 1 条关键信息，再决定要不要导出。")).toBeInTheDocument();
    expect(screen.getByText("如果你已经知道还缺第二段教育或经历，可以直接从下面继续加。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "继续完善这版" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "稳妥通用版" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "一页紧凑版" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上半页抢眼版" })).toBeInTheDocument();
    expect(screen.getByText("先把姓名、教育和经历都讲清楚，适合大多数校招简历。")).toBeInTheDocument();
    expect(screen.getByText("先把更多内容压进一页，适合经历和技能都偏多的人。")).toBeInTheDocument();
    expect(within(previewRail as HTMLElement).getByRole("button", { name: "导出网页版" })).toBeDisabled();
    expect(within(previewRail as HTMLElement).getByRole("button", { name: "导出 PDF" })).toBeDisabled();
    expect(
      within(previewRail as HTMLElement).getByText("这还是第一版，建议先补 1 条关键信息后再导出。"),
    ).toBeInTheDocument();
    expect(within(editorColumn as HTMLElement).queryByRole("button", { name: "备份 JSON 草稿" })).not.toBeInTheDocument();
    expect(within(previewRail as HTMLElement).getByText("第一版预览")).toBeInTheDocument();
    expect((previewRail as HTMLElement).querySelector(".entry-actions.stacked")).toBeNull();
    expect(screen.getByRole("button", { name: "预览简历" })).toBeInTheDocument();
  });

  it("shows a paste recognition summary on the first-draft screen", async () => {
    const user = userEvent.setup();
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "向金涛",
        "目标岗位：招聘实习生",
        "电话：18973111415",
        "邮箱：3294182452@qq.com",
        "所在地：深圳",
        "教育：中南财经政法大学 人力资源管理 2022.09-2026.06",
        "教育：中国政法大学 法律（非法学） 2026.09-2029.07",
        "经历：微派网络科技有限公司 招聘实习生 2025.10-2026.02 支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));

    await screen.findByText("第一版简历已经出来了");
    const summaryHeading = screen.getByText("我先从原文里整理到这些");
    const summaryCard = summaryHeading.closest(".starter-summary-card") as HTMLElement;

    expect(summaryCard).not.toBeNull();
    expect(within(summaryCard).getByText("姓名")).toBeInTheDocument();
    expect(within(summaryCard).getByText("向金涛")).toBeInTheDocument();
    expect(within(summaryCard).getByText("目标岗位")).toBeInTheDocument();
    expect(within(summaryCard).getByText("招聘实习生")).toBeInTheDocument();
    expect(within(summaryCard).getByText("联系方式")).toBeInTheDocument();
    expect(within(summaryCard).getByText("电话、邮箱、所在地")).toBeInTheDocument();
    expect(within(summaryCard).getByText("教育经历")).toBeInTheDocument();
    expect(within(summaryCard).getByText("已识别 1 段")).toBeInTheDocument();
    expect(within(summaryCard).getByText("经历")).toBeInTheDocument();
    expect(within(summaryCard).getByText("已识别 1 段实习")).toBeInTheDocument();
    expect(within(summaryCard).getByRole("button", { name: "返回修改原文" })).toBeInTheDocument();
  });

  it("returns pasted users to the original source text without clearing it", async () => {
    const user = userEvent.setup();
    render(<ResumeStudio />);
    const pastedSource = [
      "向金涛",
      "目标岗位：招聘实习生",
      "电话：18973111415",
      "邮箱：3294182452@qq.com",
      "所在地：深圳",
      "教育：中南财经政法大学 人力资源管理 2022.09-2026.06",
      "经历：微派网络科技有限公司 招聘实习生 2025.10-2026.02 支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
    ].join("\n");

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(screen.getByLabelText("粘贴现有简历或自我介绍"), pastedSource);
    await user.click(screen.getByRole("button", { name: "整理并起稿" }));

    await screen.findByText("第一版简历已经出来了");
    await user.click(screen.getByRole("button", { name: "返回修改原文" }));

    expect(screen.getByRole("heading", { name: "导入旧材料，先整理第一版" })).toBeInTheDocument();
    expect(screen.getByLabelText("粘贴现有简历或自我介绍")).toHaveValue(pastedSource);
    expect(screen.getByRole("button", { name: "整理并起稿" })).toBeEnabled();
  });

  it("shows paste progress immediately and prevents duplicate submissions while extraction is running", async () => {
    const user = userEvent.setup();
    let resolveExtractRequest: ((response: Response) => void) | undefined;
    const extractRequest = new Promise<Response>((resolve) => {
      resolveExtractRequest = resolve;
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/api/ai/extract-content")) {
        return extractRequest;
      }

      if (url.includes("/api/ai/generate-templates")) {
        return new Response(
          JSON.stringify({
            mode: "fallback",
            candidates: BASELINE_TEMPLATE_MANIFESTS,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.includes("/api/events")) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "陈星野",
        "目标岗位：招聘运营实习生",
        "电话：13800001234",
        "邮箱：chenxingye@example.com",
        "所在地：杭州",
        "教育：华东师范大学 人力资源管理 2022.09-2026.06",
        "经历：星桥科技 招聘运营实习生 2025.10-2026.02 支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));

    expect(screen.getByRole("button", { name: "整理中..." })).toBeDisabled();
    expect(screen.getByLabelText("粘贴现有简历或自我介绍")).toBeDisabled();
    expect(
      fetchSpy.mock.calls.filter(([input]) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        return url.includes("/api/ai/extract-content");
      }),
    ).toHaveLength(1);

    resolveExtractRequest?.(
      new Response(
        JSON.stringify({
          mode: "fallback",
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
          intake: {
            stage: "early-draft",
            completenessScore: 1,
            evidenceScore: 0,
            minimumDraftReady: true,
            weakAreas: ["experience-metrics", "skills-specificity", "education-signals"],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await screen.findByText("第一版简历已经出来了");
    expect(
      fetchSpy.mock.calls.filter(([input]) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        return url.includes("/api/ai/extract-content");
      }),
    ).toHaveLength(1);
  });

  it("shows three fuller starter template cards by default", async () => {
    const user = userEvent.setup();
    mockAdaptiveIntakeFetch({
      templateResponse: {
        mode: "fallback",
        candidates: [
          createManifest({
            templateId: "flagship-reference",
            name: "Flagship Reference",
            displayName: "稳妥通用版",
            description: "先把姓名、教育和经历都讲清楚，适合大多数校招简历。",
            familyLabel: "温暖专业",
            fitSummary: "适合想先交出一版稳妥、可信、不过度冒险的校招简历。",
            previewHighlights: ["抬头信息完整清楚", "教育与经历层次稳定", "整体观感正式克制"],
          }),
          createManifest({
            templateId: "compact-template",
            name: "Compact Template",
            displayName: "一页紧凑版",
            description: "先把更多内容压进一页，适合经历和技能都偏多的人。",
            familyLabel: "现代清爽",
            fitSummary: "适合经历和技能都偏多，需要在一页内提高版面利用率的人。",
            previewHighlights: ["信息密度更高", "经历卡片更利于快扫", "整体感受利落清爽"],
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
          createManifest({
            templateId: "banner-template",
            name: "Banner Template",
            displayName: "上半页抢眼版",
            description: "先把页头和结果抬到上半页，适合想先抓住注意力的人。",
            familyLabel: "重点鲜明",
            fitSummary: "适合已经有明确成果点，想在前几秒就把卖点和结果传达出来的人。",
            previewHighlights: ["标题带更醒目", "结果导向感明显", "适合快节奏筛选"],
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
    });
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "向金涛",
        "目标岗位：招聘实习生",
        "电话：18973111415",
        "邮箱：3294182452@qq.com",
        "所在地：深圳",
        "教育：中南财经政法大学 人力资源管理 2022.09-2026.06",
        "经历：微派网络科技有限公司 招聘实习生 2025.10-2026.02 支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));

    await screen.findByRole("heading", { name: "看看哪套版式更适合这版简历" });
    const templateBlock = screen
      .getByRole("heading", { name: "看看哪套版式更适合这版简历" })
      .closest(".studio-block") as HTMLElement;

    expect(templateBlock).not.toBeNull();
    expect(templateBlock.querySelectorAll(".template-card-grid .template-card")).toHaveLength(3);
    expect(within(templateBlock).getByRole("button", { name: "看看更多版式" })).toBeInTheDocument();

    const flagshipCard = within(templateBlock).getByRole("button", { name: /稳妥通用版/ });
    expect(flagshipCard).toHaveAccessibleName("稳妥通用版");
    expect(flagshipCard).toHaveAccessibleDescription(/温暖专业/);
    expect(flagshipCard).toHaveAccessibleDescription(
      /适合想先交出一版稳妥、可信、不过度冒险的校招简历。/,
    );
    expect(flagshipCard).toHaveAttribute("aria-pressed", "true");
    expect(within(flagshipCard).getByText("稳妥通用版")).toBeInTheDocument();
    expect(within(flagshipCard).getByText("先把姓名、教育和经历都讲清楚，适合大多数校招简历。")).toBeInTheDocument();
    expect(within(flagshipCard).getByText("最匹配你的内容")).toBeInTheDocument();
    expect(within(flagshipCard).getByTestId("template-preview-flagship-reference")).toHaveAttribute(
      "data-hero-variant",
      "name-left-photo-right",
    );
    expect(within(flagshipCard).getByTestId("template-preview-flagship-reference")).toHaveAttribute(
      "data-experience-variant",
      "stacked-bullets",
    );

    const compactCard = within(templateBlock).getByRole("button", { name: /一页紧凑版/ });
    expect(compactCard).toBeInTheDocument();
    expect(within(compactCard).getByText("先把更多内容压进一页，适合经历和技能都偏多的人。")).toBeInTheDocument();
    expect(within(compactCard).getByTestId("template-preview-compact-template")).toHaveAttribute(
      "data-hero-variant",
      "centered-name-minimal",
    );
    expect(within(compactCard).getByTestId("template-preview-compact-template")).toHaveAttribute(
      "data-density",
      "tight",
    );

    const bannerCard = within(templateBlock).getByRole("button", { name: /上半页抢眼版/ });
    expect(bannerCard).toBeInTheDocument();
    expect(within(bannerCard).getByText("先把页头和结果抬到上半页，适合想先抓住注意力的人。")).toBeInTheDocument();
    expect(within(bannerCard).getByTestId("template-preview-banner-template")).toHaveAttribute(
      "data-hero-variant",
      "classic-banner",
    );
    expect(within(bannerCard).getByTestId("template-preview-banner-template")).toHaveAttribute(
      "data-experience-variant",
      "metric-first",
    );
    expect(screen.queryByText("Flagship Reference")).not.toBeInTheDocument();
    expect(screen.getByText("你的经历里有量化成果，推荐先看结果导向型版式。")).toBeInTheDocument();
  });

  it("keeps additional templates collapsed until requested and promotes one into the recommended set", async () => {
    const user = userEvent.setup();
    mockAdaptiveIntakeFetch({});
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "向金涛",
        "目标岗位：招聘实习生",
        "电话：18973111415",
        "邮箱：3294182452@qq.com",
        "所在地：深圳",
        "教育：中南财经政法大学 人力资源管理 2022.09-2026.06",
        "经历：微派网络科技有限公司 招聘实习生 2025.10-2026.02 支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));

    const templateBlock = (await screen.findByRole("heading", { name: "看看哪套版式更适合这版简历" }))
      .closest(".studio-block") as HTMLElement;
    expect(templateBlock).not.toBeNull();
    expect(templateBlock.querySelectorAll(".template-card-grid .template-card")).toHaveLength(3);
    expect(within(templateBlock).queryByRole("button", { name: "教育亮点先读" })).not.toBeInTheDocument();

    await user.click(within(templateBlock).getByRole("button", { name: "看看更多版式" }));

    const moreSection = within(templateBlock).getByTestId("more-template-options");
    const familyHeadings = within(moreSection).getAllByRole("heading", { level: 4 });

    expect(familyHeadings[0]).toHaveTextContent("冷静学术");
    expect(
      within(moreSection).getByText("适合教育亮点、研究经历或学术信号更强，想把履历讲得更清楚的人。"),
    ).toBeInTheDocument();
    expect(
      within(moreSection).getByText("适合想先投出一版稳妥、正式、不过分冒险的校招简历。"),
    ).toBeInTheDocument();
    expect(within(moreSection).getByRole("button", { name: "教育亮点先读" })).toBeInTheDocument();

    const academicGroup = familyHeadings[0].closest(".template-family-group") as HTMLElement;
    expect(academicGroup).not.toBeNull();
    expect(academicGroup.querySelectorAll(".template-card")).toHaveLength(4);
    expect(within(academicGroup).queryByRole("button", { name: "展开本组更多" })).not.toBeInTheDocument();
    expect(within(academicGroup).getByRole("button", { name: "学业履历版" })).toBeInTheDocument();

    await user.click(within(moreSection).getByRole("button", { name: "教育亮点先读" }));

    const recommendedGrid = templateBlock.querySelector(".template-card-grid") as HTMLElement;
    expect(recommendedGrid).not.toBeNull();
    expect(within(recommendedGrid).getByRole("button", { name: "教育亮点先读" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(recommendedGrid).getAllByRole("button")).toHaveLength(3);
    expect(within(templateBlock).getAllByRole("button", { name: "教育亮点先读" })).toHaveLength(1);
  });

  it("falls back to built-in card highlights for newer template variants", async () => {
    const user = userEvent.setup();
    mockAdaptiveIntakeFetch({
      templateResponse: {
        mode: "fallback",
        candidates: [
          createManifest({
            templateId: "signal-template",
            name: "Signal Template",
            displayName: "亮点清晰",
            description: "适合把重要信息压缩到更清楚的版头里。",
            familyLabel: "重点鲜明",
            fitSummary: "适合亮点明确，想让筛选时先看到重点的人。",
            previewHighlights: undefined,
            sections: {
              hero: { variant: "split-meta-band" },
              education: { variant: "highlight-strip" },
              experience: { variant: "result-callout" },
              awards: { variant: "inline-list" },
              skills: { variant: "inline-tags" },
            },
            compactionPolicy: {
              density: "balanced",
              overflowPriority: ["awards", "skills", "experience"],
            },
          }),
          createManifest({
            templateId: "flagship-reference",
            name: "Flagship Reference",
          }),
          createManifest({
            templateId: "compact-template",
            name: "Compact Template",
          }),
        ],
      },
    });
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "向金涛",
        "目标岗位：招聘实习生",
        "电话：18973111415",
        "邮箱：3294182452@qq.com",
        "所在地：深圳",
        "教育：中南财经政法大学 人力资源管理 2022.09-2026.06",
        "经历：微派网络科技有限公司 招聘实习生 2025.10-2026.02 支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));

    const signalCard = await screen.findByRole("button", { name: "亮点清晰" });
    expect(within(signalCard).getByText("适合把重要信息压缩到更清楚的版头里。")).toBeInTheDocument();
    expect(within(signalCard).queryByText("上下分区更清楚")).not.toBeInTheDocument();
    expect(within(signalCard).queryByText("还有 1 项")).not.toBeInTheDocument();
  });

  it("renders variant-shaped mini previews for education, awards, and skills", async () => {
    const user = userEvent.setup();
    mockAdaptiveIntakeFetch({
      templateResponse: {
        mode: "fallback",
        candidates: [
          createManifest({
            templateId: "signal-grid-template",
            name: "Signal Grid Template",
            displayName: "学业信号版",
            description: "适合把学业亮点拆成更好扫读的小块。",
            familyLabel: "冷静学术",
            fitSummary: "适合教育亮点明确的人。",
            previewHighlights: ["亮点分块", "学业信号前置", "阅读更聚焦"],
            sections: {
              hero: { variant: "split-meta-band" },
              education: { variant: "signal-grid" },
              experience: { variant: "stacked-bullets" },
              awards: { variant: "two-column-table" },
              skills: { variant: "label-columns" },
            },
          }),
          createManifest({
            templateId: "chips-template",
            name: "Chips Template",
            displayName: "技能标签版",
            description: "适合用更轻的标签方式展示技能。",
            familyLabel: "现代清爽",
            fitSummary: "适合技能较多但不想显得拥挤的人。",
            previewHighlights: ["技能更像标签", "模块更轻", "整体更现代"],
            sections: {
              hero: { variant: "centered-name-minimal" },
              education: { variant: "compact-rows" },
              experience: { variant: "compact-cards" },
              awards: { variant: "inline-list" },
              skills: { variant: "grouped-chips" },
            },
          }),
          createManifest({
            templateId: "pill-awards-template",
            name: "Pill Awards Template",
            displayName: "奖项胶囊版",
            description: "适合用更轻的胶囊条展示奖项。",
            familyLabel: "重点鲜明",
            fitSummary: "适合奖项和标签都比较短的人。",
            previewHighlights: ["奖项更像标签", "亮点集中", "阅读更快"],
            sections: {
              hero: { variant: "stacked-profile-card" },
              education: { variant: "highlight-strip" },
              experience: { variant: "metric-first" },
              awards: { variant: "pill-row" },
              skills: { variant: "inline-tags" },
            },
          }),
        ],
      },
    });
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "向金涛",
        "目标岗位：招聘实习生",
        "电话：18973111415",
        "邮箱：3294182452@qq.com",
        "所在地：深圳",
        "教育：中南财经政法大学 人力资源管理 2022.09-2026.06",
        "经历：微派网络科技有限公司 招聘实习生 2025.10-2026.02 支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));

    expect(
      within(screen.getByTestId("template-preview-signal-grid-template")).getByTestId(
        "template-preview-education-signal-grid",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("template-preview-signal-grid-template")).getByTestId(
        "template-preview-awards-two-column-table",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("template-preview-signal-grid-template")).getByTestId(
        "template-preview-skills-label-columns",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("template-preview-chips-template")).getByTestId(
        "template-preview-skills-grouped-chips",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("template-preview-pill-awards-template")).getByTestId(
        "template-preview-awards-pill-row",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("template-preview-pill-awards-template")).getByTestId(
        "template-preview-skills-inline-tags",
      ),
    ).toBeInTheDocument();
  });

  it("shows only the template toggle before reopening template choices in strengthening", async () => {
    const user = userEvent.setup();
    mockAdaptiveIntakeFetch({
      interviewResponses: [
        {
          mode: "fallback",
          stage: "strengthening-follow-up",
          focus: "experience-metrics",
          question: "这段经历里能补一个数字结果吗？",
          reason: "有骨架了，但经历缺少数字结果。",
          suggestion: "例如：推进多少候选人进入下一轮。",
        },
      ],
      templateResponse: {
        mode: "fallback",
        candidates: [
          createManifest({
            templateId: "flagship-reference",
            name: "Flagship Reference",
            displayName: "稳妥通用版",
            description: "先把姓名、教育和经历都讲清楚，适合大多数校招简历。",
            familyLabel: "温暖专业",
            fitSummary: "适合想先交出一版稳妥、可信、不过度冒险的校招简历。",
            previewHighlights: ["抬头信息完整清楚", "教育与经历层次稳定", "整体观感正式克制"],
          }),
          createManifest({
            templateId: "compact-template",
            name: "Compact Template",
            displayName: "一页紧凑版",
            description: "先把更多内容压进一页，适合经历和技能都偏多的人。",
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
          createManifest({
            templateId: "banner-template",
            name: "Banner Template",
            displayName: "上半页抢眼版",
            description: "先把页头和结果抬到上半页，适合想先抓住注意力的人。",
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
    });
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "陈星野",
        "目标岗位：招聘运营实习生",
        "电话：13800001234",
        "邮箱：chenxingye@example.com",
        "所在地：杭州",
        "教育：华东师范大学 人力资源管理 2022.09-2026.06",
        "经历：星桥科技 招聘运营实习生 2025.10-2026.02 支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));
    expect(await screen.findByRole("button", { name: "一页紧凑版" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "继续完善这版" }));

    expect(await screen.findByText("这段经历里能补一个数字结果吗？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "需要时再看版式" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "看看哪套版式更适合这版简历" })).not.toBeInTheDocument();
    expect(screen.queryByText("3 套候选")).not.toBeInTheDocument();
    expect(screen.queryByText("先把内容补顺，再看看哪种排版更清楚。切换版式不会改动你的内容。")).not.toBeInTheDocument();
    expect(screen.queryByText("已先给你几种版式候选，先看看哪套更适合这版内容。")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /稳妥通用版/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /一页紧凑版/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /上半页抢眼版/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "需要时再看版式" }));
    const templateBlock = screen
      .getByRole("heading", { name: "看看哪套版式更适合这版简历" })
      .closest(".studio-block") as HTMLElement;

    expect(templateBlock).not.toBeNull();
    const reopenedFlagshipCard = within(templateBlock).getByRole("button", { name: /稳妥通用版/ });

    expect(screen.getByRole("button", { name: "一页紧凑版" })).toBeInTheDocument();
    expect(within(reopenedFlagshipCard).getByText("稳妥通用版")).toBeInTheDocument();
    expect(within(reopenedFlagshipCard).getByText("先把姓名、教育和经历都讲清楚，适合大多数校招简历。")).toBeInTheDocument();
    expect(
      within(reopenedFlagshipCard).queryByText("抬头信息完整清楚"),
    ).not.toBeInTheDocument();
  });

  it("refreshes template candidates after editor content changes", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockAdaptiveIntakeFetch({
      templateResponse: (callIndex) =>
        Promise.resolve({
          mode: "fallback",
          candidates:
            callIndex === 0
              ? [
                  createManifest({
                    templateId: "flagship-reference",
                    name: "Flagship Reference",
                  }),
                  createManifest({
                    templateId: "initial-template",
                    name: "Initial Template",
                    displayName: "极简直给版",
                    description: "减少装饰和说明，适合想让事实自己说话的人。",
                    tone: "modern",
                    theme: {
                      fontPair: "humanist-sans",
                      accentColor: "ink",
                      dividerStyle: "line",
                    },
                    sections: {
                      hero: { variant: "centered-name-minimal" },
                      education: { variant: "highlight-strip" },
                      experience: { variant: "stacked-bullets" },
                      awards: { variant: "two-column-table" },
                      skills: { variant: "grouped-chips" },
                    },
                  }),
                  createManifest({
                    templateId: "banner-template",
                    name: "Banner Template",
                    tone: "confident",
                    theme: {
                      fontPair: "serif-sans",
                      accentColor: "navy",
                      dividerStyle: "soft",
                    },
                    sections: {
                      hero: { variant: "classic-banner" },
                      education: { variant: "compact-rows" },
                      experience: { variant: "metric-first" },
                      awards: { variant: "inline-list" },
                      skills: { variant: "inline-tags" },
                    },
                  }),
                ]
              : [
                  createManifest({
                    templateId: "flagship-reference",
                    name: "Flagship Reference",
                  }),
                  createManifest({
                    templateId: "edited-template",
                    name: "Edited Template",
                    displayName: "紧凑清晰",
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
                  }),
                  createManifest({
                    templateId: "classic-template",
                    name: "Classic Template",
                    displayName: "上半页抢眼版",
                    description: "先把页头和结果抬到上半页，适合想先抓住注意力的人。",
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
        }),
    });
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "向金涛",
        "目标岗位：招聘实习生",
        "电话：18973111415",
        "邮箱：3294182452@qq.com",
        "所在地：深圳",
        "教育：中南财经政法大学 人力资源管理 2022.09-2026.06",
        "经历：微派网络科技有限公司 招聘实习生 2025.10-2026.02 支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));
    expect(await screen.findByRole("button", { name: "极简直给版" })).toBeInTheDocument();

    fireEvent.change(screen.getAllByLabelText("学校")[0], {
      target: { value: "复旦大学" },
    });

    await waitFor(
      () => {
        expect(screen.getByTestId("template-preview-edited-template")).toBeInTheDocument();
        expect(
          fetchSpy.mock.calls.filter(([input]) => {
            const url =
              typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
            return url.includes("/api/ai/generate-templates");
          }),
        ).toHaveLength(2);
      },
      { timeout: 5000 },
    );
  });

  it("extracts pasted text into fields before the user explicitly starts strengthening", async () => {
    const user = userEvent.setup();
    mockAdaptiveIntakeFetch({
      extractResponse: {
        mode: "fallback",
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
      },
      interviewResponses: [
        {
          mode: "fallback",
          stage: "strengthening-follow-up",
          focus: "experience-metrics",
          question: "这段经历里能补一个数字结果吗？",
          reason: "有骨架了，但经历缺少数字结果。",
          suggestion: "例如：推进多少候选人进入下一轮。",
        },
      ],
    });
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "陈星野",
        "目标岗位：招聘运营实习生",
        "电话：13800001234",
        "邮箱：chenxingye@example.com",
        "所在地：杭州",
        "教育：华东师范大学 人力资源管理 2022.09-2026.06",
        "经历：星桥科技 招聘运营实习生 2025.10-2026.02 支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));

    await screen.findByText("第一版简历已经出来了");
    expect(screen.getByDisplayValue("华东师范大学")).toBeInTheDocument();
    expect(screen.getByDisplayValue("星桥科技")).toBeInTheDocument();
    expect(screen.queryByText("这段经历里能补一个数字结果吗？")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "继续完善这版" }));

    expect(await screen.findByText("这段经历里能补一个数字结果吗？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出网页版" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "导出 PDF" })).toBeEnabled();
  });

  it("keeps strengthening focused on the targeted section and hides extra adjustments by default", async () => {
    const user = userEvent.setup();
    mockAdaptiveIntakeFetch({
      extractResponse: {
        mode: "fallback",
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
      },
      interviewResponses: [
        {
          mode: "fallback",
          stage: "strengthening-follow-up",
          focus: "experience-metrics",
          question: "这段经历里能补一个数字结果吗？",
          reason: "有骨架了，但经历缺少数字结果。",
          suggestion: "例如：推进多少候选人进入下一轮。",
        },
      ],
    });
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "陈星野",
        "目标岗位：招聘运营实习生",
        "电话：13800001234",
        "邮箱：chenxingye@example.com",
        "所在地：杭州",
        "教育：华东师范大学 人力资源管理 2022.09-2026.06",
        "经历：星桥科技 招聘运营实习生 2025.10-2026.02 支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));
    await user.click(screen.getByRole("button", { name: "继续完善这版" }));

    expect(await screen.findByText("这条会补到：实习 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "实习经历" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开教育背景" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开在校经历" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开更多调整" })).toBeInTheDocument();
    expect(screen.queryByLabelText("学校")).not.toBeInTheDocument();
    expect(screen.queryByText("证件照")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开教育背景" }));
    expect(screen.getByLabelText("学校")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开更多调整" }));
    expect(screen.getByText("证件照")).toBeInTheDocument();
  });

  it("keeps incomplete pasted content in core follow-up before creating the first draft", async () => {
    const user = userEvent.setup();
    mockAdaptiveIntakeFetch({
      extractResponse: {
        mode: "fallback",
        contentDocument: {
          profile: {
            fullName: "陈星野",
            targetRole: "",
            phone: "",
            email: "",
            location: "",
            summary: "",
            preferredLocation: "",
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
            {
              id: "edu-2",
              school: "上海外国语大学",
              degree: "英语双学位",
              dateRange: "2023.09-2025.06",
              highlights: [],
            },
          ],
          experiences: [
            {
              id: "exp-1",
              section: "internship",
              organization: "星桥科技",
              role: "校园招聘运营",
              dateRange: "2025.10-2026.02",
              priority: 100,
              locked: true,
              rawNarrative: "支持多个岗位招聘推进。",
              bullets: ["支持多个岗位招聘推进。"],
              metrics: [],
              tags: [],
              variants: {
                raw: "支持多个岗位招聘推进。",
                star: "支持多个岗位招聘推进。",
                standard: "支持多个岗位招聘推进。",
                compact: "支持多个岗位招聘推进。",
              },
            },
            {
              id: "exp-2",
              section: "campus",
              organization: "学院就业中心",
              role: "学生助理",
              dateRange: "2024.03-2025.01",
              priority: 60,
              locked: false,
              rawNarrative: "协助组织双选会活动。",
              bullets: ["协助组织双选会活动。"],
              metrics: [],
              tags: [],
              variants: {
                raw: "协助组织双选会活动。",
                star: "协助组织双选会活动。",
                standard: "协助组织双选会活动。",
                compact: "协助组织双选会活动。",
              },
            },
          ],
          awards: [{ id: "award-1", title: "优秀学生干部", priority: 40 }],
          skills: [],
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
        intake: {
          stage: "core-follow-up",
          minimumDraftReady: false,
          completenessScore: 0.65,
          evidenceScore: 0,
          weakAreas: ["target-role", "contact"],
        },
      },
      interviewResponses: [
        {
          mode: "fallback",
          stage: "core-follow-up",
          focus: "target-role",
          question: "你最想投的岗位是什么？",
          reason: "先锁定目标岗位。",
          suggestion: "先写一个最想投的方向。",
        },
        {
          mode: "fallback",
          stage: "core-follow-up",
          focus: "contact",
          question: "把电话、邮箱、所在地一次告诉我。",
          reason: "先补齐联系方式。",
          suggestion: "推荐分 3 行填写。",
        },
        {
          mode: "fallback",
          stage: "strengthening-follow-up",
          focus: "experience-metrics",
          question: "这段经历里能补一个数字结果吗？",
          reason: "第一版已经能生成了，但还缺量化结果。",
          suggestion: "例如：推进多少人进入下一轮。",
        },
      ],
    });
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(screen.getByLabelText("粘贴现有简历或自我介绍"), "陈星野");
    await user.click(screen.getByRole("button", { name: "整理并起稿" }));

    await screen.findByText("你最想投的岗位是什么？");
    expect(
      screen.getByText("刚刚导入的内容已经保留，现在只补还缺的关键信息。"),
    ).toBeInTheDocument();
    expect(screen.queryByText("下一步建议")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "导出网页版" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("当前回答"), "招聘实习生");
    await user.click(screen.getByRole("button", { name: "下一题" }));

    await screen.findByText("把电话、邮箱、所在地一次告诉我。");
    await user.type(
      screen.getByLabelText("当前回答"),
      "13800001234\nchenxingye@example.com\n杭州",
    );
    await user.click(screen.getByRole("button", { name: "生成第一版简历" }));

    await screen.findByText("第一版简历已经出来了");
    expect(screen.getAllByLabelText("学校")).toHaveLength(2);
    expect(screen.getByDisplayValue("上海外国语大学")).toBeInTheDocument();
    expect(screen.getByDisplayValue("星桥科技")).toBeInTheDocument();
    expect(screen.getByText("在校经历 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("学院就业中心")).toBeInTheDocument();
    expect(screen.queryByText("这段经历里能补一个数字结果吗？")).not.toBeInTheDocument();
  });

  it(
    "returns to the overview after a strengthening answer and only resumes when the user asks for the next prompt",
    async () => {
    const user = userEvent.setup();
    mockAdaptiveIntakeFetch({
      extractResponse: {
        mode: "fallback",
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
        intake: {
          stage: "early-draft",
          minimumDraftReady: true,
          completenessScore: 1,
          evidenceScore: 0,
          weakAreas: ["experience-metrics", "skills-specificity", "education-signals"],
        },
      },
      interviewResponses: [
        {
          mode: "fallback",
          stage: "strengthening-follow-up",
          focus: "experience-metrics",
          question: "这段经历里能补一个数字结果吗？",
          reason: "经历缺少数字结果。",
          suggestion: "例如：推进多少候选人进入下一轮。",
        },
        {
          mode: "fallback",
          stage: "strengthening-follow-up",
          focus: "skills-specificity",
          question: "再补 3 到 6 个更具体的技能关键词？",
          reason: "技能还不够具体。",
          suggestion: "例如：招聘漏斗分析、Excel、ATS。",
        },
      ],
    });
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "陈星野",
        "目标岗位：招聘运营实习生",
        "电话：13800001234",
        "邮箱：chenxingye@example.com",
        "所在地：杭州",
        "教育：华东师范大学 人力资源管理 2022.09-2026.06",
        "经历：星桥科技 招聘运营实习生 2025.10-2026.02 支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));
    await user.click(screen.getByRole("button", { name: "继续完善这版" }));

    await screen.findByText("这段经历里能补一个数字结果吗？");
    await user.type(screen.getByLabelText("把这条信息补上"), "推进13位候选人进入终面，促成5人入职");
    await user.click(screen.getByRole("button", { name: "补上这一条" }));

    expect(await screen.findByText("刚完善了 1 条")).toBeInTheDocument();
    expect(screen.getByText("下一条建议：再补 3 到 6 个更具体的技能关键词？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "继续补下一条" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "先看看现在这版" })).toBeInTheDocument();
    expect(screen.queryByText("再补 3 到 6 个更具体的技能关键词？")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "继续补下一条" }));

    await screen.findByText("再补 3 到 6 个更具体的技能关键词？");
    await user.click(screen.getByRole("button", { name: "展开实习经历" }));
    expect(screen.getByRole("button", { name: "导出网页版" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "导出 PDF" })).toBeEnabled();
    expect(screen.queryByText("这段经历里能补一个数字结果吗？")).not.toBeInTheDocument();
    expect(
      (screen.getAllByLabelText("经历要点")[0] as HTMLTextAreaElement).value,
    ).toContain("推进13位候选人进入终面，促成5人入职");
    },
    15_000,
  );

  it(
    "binds strengthening follow-up to the internship card the user is editing",
    async () => {
    const user = userEvent.setup();
    mockAdaptiveIntakeFetch({
      extractResponse: {
        mode: "fallback",
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
        intake: {
          stage: "early-draft",
          minimumDraftReady: true,
          completenessScore: 1,
          evidenceScore: 0,
          weakAreas: ["experience-metrics"],
        },
      },
      interviewResponses: [
        {
          mode: "fallback",
          stage: "strengthening-follow-up",
          focus: "experience-metrics",
          question: "这段经历里能补一个数字结果吗？",
          reason: "经历缺少数字结果。",
          suggestion: "例如：推进多少候选人进入下一轮。",
        },
      ],
    });
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "陈星野",
        "目标岗位：招聘运营实习生",
        "电话：13800001234",
        "邮箱：chenxingye@example.com",
        "所在地：杭州",
        "教育：华东师范大学 人力资源管理 2022.09-2026.06",
        "经历：星桥科技 招聘运营实习生 2025.10-2026.02 支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));
    await user.click(screen.getByRole("button", { name: "再加一段实习" }));

    const secondInternshipCard = screen.getByText("实习经历 2").closest(".editor-card");
    expect(secondInternshipCard).not.toBeNull();

    await user.type(
      within(secondInternshipCard as HTMLElement).getByLabelText("公司/组织") as HTMLInputElement,
      "海豚招聘",
    );
    await user.type(
      within(secondInternshipCard as HTMLElement).getByLabelText("岗位/身份") as HTMLInputElement,
      "招聘助理",
    );
    await user.type(
      within(secondInternshipCard as HTMLElement).getByLabelText("时间") as HTMLInputElement,
      "2024.03-2024.08",
    );

    await user.click(screen.getByRole("button", { name: "继续完善这版" }));

    await screen.findByText("这段经历里能补一个数字结果吗？");
    expect(screen.getByText(/这条会补到：实习 2/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("把这条信息补上"), "推进 27 位候选人进入初筛，促成 6 人到面");
    await user.click(screen.getByRole("button", { name: "补上这一条" }));

    expect(await screen.findByText("下一条会补到：实习 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "继续补下一条" }));
    const expandInternshipButton = screen.queryByRole("button", { name: "展开实习经历" });
    if (expandInternshipButton) {
      await user.click(expandInternshipButton);
    }
    const firstInternshipCard = await screen.findByText("实习经历 1");
    const updatedSecondInternshipCard = await screen.findByText("实习经历 2");
    await waitFor(() => {
      expect(
        (
          within(updatedSecondInternshipCard.closest(".editor-card") as HTMLElement).getByLabelText(
            "经历要点",
          ) as HTMLTextAreaElement
        ).value,
      ).toContain("推进 27 位候选人进入初筛，促成 6 人到面");
    });
    expect(
      (
        within(firstInternshipCard.closest(".editor-card") as HTMLElement).getByLabelText(
          "经历要点",
        ) as HTMLTextAreaElement
      ).value,
    ).not.toContain(
      "推进 27 位候选人进入初筛，促成 6 人到面",
    );
  }, 25_000);

  it("closes the strengthening prompt after the user fixes the missing metric directly in the editor", async () => {
    const user = userEvent.setup();
    mockAdaptiveIntakeFetch({
      extractResponse: {
        mode: "fallback",
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
          skills: ["招聘漏斗分析", "Excel"],
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
        intake: {
          stage: "early-draft",
          minimumDraftReady: true,
          completenessScore: 1,
          evidenceScore: 0,
          weakAreas: ["experience-metrics"],
        },
      },
      interviewResponses: [
        {
          mode: "fallback",
          stage: "strengthening-follow-up",
          focus: "experience-metrics",
          question: "这段经历里能补一个数字结果吗？",
          reason: "经历缺少数字结果。",
          suggestion: "例如：推进多少候选人进入下一轮。",
        },
      ],
    });
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "陈星野",
        "目标岗位：招聘运营实习生",
        "电话：13800001234",
        "邮箱：chenxingye@example.com",
        "所在地：杭州",
        "教育：华东师范大学 人力资源管理 2022.09-2026.06",
        "经历：星桥科技 招聘运营实习生 2025.10-2026.02 支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));
    await user.click(screen.getByRole("button", { name: "继续完善这版" }));

    await screen.findByText("这段经历里能补一个数字结果吗？");
    await user.type(
      screen.getAllByLabelText("经历要点")[0] as HTMLTextAreaElement,
      "{end}{enter}推进 13 位候选人进入终面，促成 5 人入职",
    );

    await waitFor(() => {
      expect(screen.queryByText("这段经历里能补一个数字结果吗？")).not.toBeInTheDocument();
    });
    expect(screen.getByText("下一步建议")).toBeInTheDocument();
  }, 15_000);

  it("lets users add multiple education and internship entries in the editor", async () => {
    const user = userEvent.setup();
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "向金涛",
        "目标岗位：招聘实习生",
        "电话：18973111415",
        "邮箱：3294182452@qq.com",
        "所在地：深圳",
        "教育：中南财经政法大学 人力资源管理 2022.09-2026.06",
        "经历：微派网络科技有限公司 招聘实习生 2025.10-2026.02 支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));

    await user.click(screen.getByRole("button", { name: "再加一段教育" }));
    await user.click(screen.getByRole("button", { name: "再加一段实习" }));

    expect(screen.getAllByLabelText("学校").length).toBeGreaterThan(1);
    expect(screen.getAllByLabelText("公司/组织").length).toBeGreaterThan(1);
    expect(screen.getAllByRole("button", { name: "帮我润色" }).length).toBeGreaterThan(1);
    expect(screen.queryByText("经历编辑")).not.toBeInTheDocument();
    },
    25_000,
  );

  it("keeps adding campus entries in the editor beyond two items", async () => {
    const user = userEvent.setup();
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "陈星野",
        "目标岗位：招聘实习生",
        "电话：13800001234",
        "邮箱：chenxingye@example.com",
        "所在地：杭州",
        "教育：华东师范大学 人力资源管理 2022.09-2026.06",
        "经历：星桥科技 招聘运营实习生 2025.10-2026.02 支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));

    await user.click(screen.getByRole("button", { name: "再加一段在校经历" }));
    await user.click(screen.getByRole("button", { name: "再加一段在校经历" }));
    await user.click(screen.getByRole("button", { name: "再加一段在校经历" }));

    expect(screen.getByText("在校经历 1")).toBeInTheDocument();
    expect(screen.getByText("在校经历 2")).toBeInTheDocument();
    expect(screen.getByText("在校经历 3")).toBeInTheDocument();
    expect(screen.queryByText(/当前一页稿暂时收起了 .*条在校经历/)).not.toBeInTheDocument();
    expect(screen.queryByText("未进入当前一页稿")).not.toBeInTheDocument();
  }, 15_000);

  it("shows an ai suggestion first and only rewrites bullets after explicit apply", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/api/ai/rewrite-experience")) {
        return new Response(
          JSON.stringify({
            mode: "fallback",
            suggestedBullets: [
              "支持运营、美术、技术等10余个岗位招聘，推进13位候选人入职。",
              "围绕高优先级岗位持续跟进流程，帮助招聘目标达成率稳定在87%。",
            ],
            variants: {
              raw: "支持运营、美术、技术等10余个岗位招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
              star: "支持运营、美术、技术等10余个岗位招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
              standard: "支持运营、美术、技术等10余个岗位招聘，推进13位候选人入职，帮助招聘目标达成率稳定在87%。",
              compact: "推进10余个岗位招聘，促成13位候选人入职，达成率87%。",
            },
            rationale: "已优先突出招聘规模、推进动作和结果。",
            followUpPrompt: "如果能再补一个最难岗位或周期，会更像正式简历。",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "向金涛",
        "目标岗位：招聘实习生",
        "电话：18973111415",
        "邮箱：3294182452@qq.com",
        "所在地：深圳",
        "教育：中南财经政法大学 人力资源管理 2022.09-2026.06",
        "经历：微派网络科技有限公司 招聘实习生 2025.10-2026.02 支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));
    await user.click(screen.getByRole("button", { name: "继续完善这版" }));

    await user.click(screen.getByRole("button", { name: "展开实习经历" }));
    expect(screen.getByDisplayValue(/支持运营、美术、技术等10余个岗位类型招聘/)).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "帮我润色" })[0]!);

    await screen.findByText("建议稿");
    expect(screen.getByText("已先按你现有的事实整理出一版建议。")).toBeInTheDocument();
    expect(screen.getByText("已优先突出招聘规模、推进动作和结果。")).toBeInTheDocument();
    expect(screen.getByText("如果能再补一个最难岗位或周期，会更像正式简历。")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/支持运营、美术、技术等10余个岗位类型招聘/)).toBeInTheDocument();
    expect(screen.queryByText("AI")).not.toBeInTheDocument();
    expect(screen.queryByText("本地")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "应用到经历要点" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue(/围绕高优先级岗位持续跟进流程/)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/帮助招聘目标达成率稳定在87/).length).toBeGreaterThan(0);
  }, 20_000);

  it("keeps the multiline hint visible and preserves line breaks while editing bullets", async () => {
    const user = userEvent.setup();
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "陈星野",
        "目标岗位：招聘实习生",
        "电话：13800001234",
        "邮箱：chenxingye@example.com",
        "所在地：杭州",
        "教育：华东师范大学 人力资源管理 2022.09-2026.06",
        "经历：星桥科技 招聘运营实习生 2025.10-2026.02 支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));
    await user.click(screen.getByRole("button", { name: "继续完善这版" }));

    expect(screen.getByText("按 Enter 换行，一行一条")).toBeInTheDocument();
    expect(screen.getByText("系统会自动拆成多条经历要点并同步预览")).toBeInTheDocument();

    const bulletsTextarea = screen.getAllByLabelText("经历要点")[0] as HTMLTextAreaElement;
    await user.type(bulletsTextarea, "{end}{enter}补充复盘招聘数据并输出周报");

    expect(bulletsTextarea.value).toContain("\n补充复盘招聘数据并输出周报");
    expect(screen.getByText("按 Enter 换行，一行一条")).toBeInTheDocument();
    expect(screen.getAllByText(/补充复盘招聘数据并输出周报/).length).toBeGreaterThan(0);
  });

  it(
    "replaces the task board with lightweight clickable guidance and a quieter preview summary",
    async () => {
      const user = userEvent.setup();
      const { container } = render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "陈星野",
        "目标岗位：招聘实习生",
        "电话：13800001234",
        "邮箱：chenxingye@example.com",
        "所在地：杭州",
        "教育：华东师范大学 人力资源管理 2022.09-2026.06",
        "经历：星桥科技 招聘运营实习生 2025.10-2026.02 支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));
    await user.click(screen.getByRole("button", { name: "继续完善这版" }));

    expect(screen.queryByText("先 3 步")).not.toBeInTheDocument();
    expect(screen.queryByText("再 3 步")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "完成“补头部与教育亮点”" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "补教育加分项" })).not.toBeInTheDocument();
    expect(screen.queryByText("下一步建议")).not.toBeInTheDocument();
    expect(screen.getByText("这还是第一版，建议先补完当前这一条再导出。")).toBeInTheDocument();

    await user.type(screen.getByLabelText("把这条信息补上"), "推进 12 位候选人进入下一轮，促成 4 人入职");
    await user.click(screen.getByRole("button", { name: "补上这一条" }));

    expect(screen.getByRole("button", { name: "补教育加分项" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "把经历写得更像简历" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "看看能不能放进一页" })).toBeInTheDocument();
    expect(screen.getByText("当前为舒展单页，内容偏少。")).toBeInTheDocument();
    const statusBlock = screen.getByText("下一步建议").closest(".studio-block");
    expect(statusBlock).not.toBeNull();
    expect(within(statusBlock as HTMLElement).getByText("建议补强")).toBeInTheDocument();
    expect(within(statusBlock as HTMLElement).getByText("可以导出，但建议先补强")).toBeInTheDocument();
    expect(
      within(statusBlock as HTMLElement).getByText("这一版版面已经稳定，但内容偏少，导出后会显得有些空。"),
    ).toBeInTheDocument();
    expect(
      within(statusBlock as HTMLElement).getByText(
        "建议先补：教育亮点 / 1 条量化结果 / 更完整的技能关键词。",
      ),
    ).toBeInTheDocument();
    const reviewText = statusBlock?.textContent ?? "";
    expect(reviewText).not.toContain("airy");
    expect(reviewText).not.toContain("sparse");
    expect(reviewText).not.toContain("fits");
      expect(reviewText).not.toContain("待检测");
      expect(reviewText).not.toContain("规则单页");
      expect(reviewText).not.toContain("实测预览");
    },
    15_000,
  );

  it("uses measured balance for the guided preview summary when preview data is available", async () => {
    vi.resetModules();
    vi.doMock("@/components/resume-preview", async () => {
      const React = await import("react");

      return {
        ResumePreview: ({
          onMeasurementChange,
        }: {
          onMeasurementChange?: (measurement: {
            widthPx: number;
            heightPx: number;
            pageHeightPx: number;
            overflowPx: number;
            status: "fits";
          }) => void;
        }) => {
          React.useEffect(() => {
            onMeasurementChange?.({
              widthPx: 700,
              heightPx: 965,
              pageHeightPx: 990,
              overflowPx: 0,
              status: "fits",
            });
          }, [onMeasurementChange]);

          return React.createElement("div", { "data-testid": "mock-guided-preview" }, "mock preview");
        },
      };
    });

    const { ResumeStudio: IsolatedResumeStudio } = await import("@/components/resume-studio");
    const user = userEvent.setup();

    render(<IsolatedResumeStudio />);

    await user.click(screen.getByRole("button", { name: "从零开始" }));
    await user.type(screen.getByLabelText("当前回答"), "陈星野");

    expect(await screen.findByText("当前为舒展草稿，内容偏满。")).toBeInTheDocument();

    vi.doUnmock("@/components/resume-preview");
    vi.resetModules();
  });

  it("uses quick guidance buttons to jump to the real editor sections", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "陈星野",
        "目标岗位：招聘实习生",
        "电话：13800001234",
        "邮箱：chenxingye@example.com",
        "所在地：杭州",
        "教育：华东师范大学 人力资源管理 2022.09-2026.06",
        "经历：星桥科技 招聘运营实习生 2025.10-2026.02 支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));
    await user.click(screen.getByRole("button", { name: "继续完善这版" }));

    await user.type(screen.getByLabelText("把这条信息补上"), "推进 9 位候选人进入终面，促成 3 人入职");
    await user.click(screen.getByRole("button", { name: "补上这一条" }));

    await user.click(screen.getByRole("button", { name: "补教育加分项" }));
    await user.click(screen.getByRole("button", { name: "把经历写得更像简历" }));
    await user.click(screen.getByRole("button", { name: "看看能不能放进一页" }));

    expect(scrollIntoView).toHaveBeenCalledTimes(3);
  }, 15_000);

  it("lets users fill optional education highlights in the sample format", async () => {
    const user = userEvent.setup();
    const { container } = render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "陈星野",
        "目标岗位：招聘实习生",
        "电话：13800001234",
        "邮箱：chenxingye@example.com",
        "所在地：杭州",
        "教育：华东师范大学 人力资源管理 2022.09-2026.06",
        "经历：星桥科技 招聘运营实习生 2025.10-2026.02 支持多个岗位招聘推进，协助安排面试并跟进候选人流程。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));

    await user.type(screen.getByLabelText("英语六级"), "571分");
    await user.type(screen.getByLabelText("普通话等级"), "一乙");

    expect(screen.getByDisplayValue("571分")).toBeInTheDocument();
    expect(screen.getByDisplayValue("一乙")).toBeInTheDocument();
    expect(screen.getByText("系统会自动隐藏空字段，不会占位。")).toBeInTheDocument();

    const summaryLine = container.querySelector(".resume-education-summary");
    expect(summaryLine).not.toBeNull();
    expect(summaryLine).toHaveTextContent("英语六级：571分");
    expect(summaryLine).toHaveTextContent("普通话等级：一乙");
  });

  it("syncs factual edits into contentDocument and renderState before persisting", async () => {
    const user = userEvent.setup();
    const compactManifest = createManifest({
      templateId: "compact-template",
      compactionPolicy: {
        density: "tight",
        overflowPriority: ["skills", "awards", "experience"],
      },
    });
    vi.spyOn(templateManifestModule, "resolveTemplateManifestById").mockImplementation(
      (templateId?: string) =>
        templateId === "compact-template"
          ? compactManifest
          : (BASELINE_TEMPLATE_MANIFESTS[0] as TemplateManifest),
    );
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
    const experienceId = workspace.experiences[0]!.id;
    workspace.templateSession = {
      ...workspace.templateSession!,
      candidateTemplateIds: ["flagship-reference", "compact-elegance"],
      selectedTemplateId: "compact-elegance",
    };
    workspace.draft.selectedVariants = {
      ...workspace.draft.selectedVariants,
      [experienceId]: "compact",
    };
    workspace.layoutPlan.selectedVariants = {
      ...workspace.layoutPlan.selectedVariants,
      [experienceId]: "compact",
    };
    workspace.renderState = {
      ...workspace.renderState!,
      density: "airy",
      selectedVariants: {
        ...workspace.renderState!.selectedVariants,
        [experienceId]: "compact",
      },
      hiddenModuleIds: ["skills"],
      overflowStatus: "overflow",
      exportAllowed: false,
      blockingReasons: ["stale render state"],
    };

    vi.spyOn(storage, "loadWorkspace").mockResolvedValue(workspace);
    const saveWorkspace = vi.spyOn(storage, "saveWorkspace").mockResolvedValue();

    render(<ResumeStudio />);

    const bulletsTextarea = (await screen.findAllByLabelText("经历要点"))[0] as HTMLTextAreaElement;
    saveWorkspace.mockClear();

    await user.type(bulletsTextarea, "{end}{enter}补充复盘招聘数据并输出周报");

    await waitFor(() => {
      const savedWorkspace = [...saveWorkspace.mock.calls]
        .map(([saved]) => saved)
        .reverse()
        .find((saved) =>
          saved?.contentDocument?.experiences[0]?.bullets?.includes("补充复盘招聘数据并输出周报"),
        );

      expect(savedWorkspace?.templateSession?.selectedTemplateId).toBe("compact-elegance");
      expect(savedWorkspace?.renderState?.hiddenModuleIds).not.toContain("skills");
      expect(savedWorkspace?.renderState?.overflowStatus).toBe("fits");
      expect(savedWorkspace?.contentDocument?.experiences[0]?.bullets).toContain(
        "补充复盘招聘数据并输出周报",
      );
    });
  });

  it("switches templates without mutating resume facts", async () => {
    const user = userEvent.setup();
    const compactManifest = createManifest({
      templateId: "compact-elegance",
      name: "Compact Elegance",
      displayName: "紧凑清晰",
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
    const bannerManifest = createManifest({
      templateId: "banner-template",
      name: "Banner Template",
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
    });
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
    workspace.templateSession = {
      ...workspace.templateSession!,
      candidateTemplateIds: [
        BASELINE_TEMPLATE_MANIFESTS[0]!.templateId,
        compactManifest.templateId,
        bannerManifest.templateId,
      ],
      candidateManifests: [BASELINE_TEMPLATE_MANIFESTS[0]!, compactManifest, bannerManifest],
      selectedTemplateId: BASELINE_TEMPLATE_MANIFESTS[0]!.templateId,
      moduleOrder: ["profile", ...compactManifest.sectionOrder],
    };
    const originalContentDocument = structuredClone(workspace.contentDocument);

    vi.spyOn(storage, "loadWorkspace").mockResolvedValue(workspace);
    const saveWorkspace = vi.spyOn(storage, "saveWorkspace").mockResolvedValue();

    const { container } = render(<ResumeStudio />);

    expect(await screen.findByRole("button", { name: "一页紧凑版" })).toBeInTheDocument();
    saveWorkspace.mockClear();

    await user.click(screen.getByRole("button", { name: "一页紧凑版" }));

    await waitFor(() => {
      const savedWorkspace = saveWorkspace.mock.calls.at(-1)?.[0];

      expect(savedWorkspace?.templateSession?.selectedTemplateId).toBe("compact-elegance");
      expect(savedWorkspace?.contentDocument).toEqual(originalContentDocument);
      expect(savedWorkspace?.renderState?.density).toBe("tight");
    });

    expect(screen.getByDisplayValue("中南财经政法大学")).toBeInTheDocument();
    expect(screen.getByDisplayValue("微派网络科技有限公司")).toBeInTheDocument();
    expect(container.querySelector(".resume-template--compact-elegance")).not.toBeNull();
    expect(container.querySelector(".resume-template--flagship-reference")).toBeNull();
  });

  it("persists a promoted extra template inside the recommended shortlist", async () => {
    const user = userEvent.setup();
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

    vi.spyOn(storage, "loadWorkspace").mockResolvedValue(workspace);
    const saveWorkspace = vi.spyOn(storage, "saveWorkspace").mockResolvedValue();

    render(<ResumeStudio />);

    expect(await screen.findByRole("button", { name: "稳妥通用版" })).toBeInTheDocument();
    saveWorkspace.mockClear();

    await user.click(screen.getByRole("button", { name: "看看更多版式" }));
    await user.click(screen.getByRole("button", { name: "教育亮点先读" }));

    await waitFor(() => {
      const savedWorkspace = saveWorkspace.mock.calls.at(-1)?.[0];

      expect(savedWorkspace?.templateSession?.selectedTemplateId).toBe("warm-education-first");
      expect(savedWorkspace?.templateSession?.candidateTemplateIds).toEqual([
        "warm-education-first",
        "flagship-reference",
        "compact-elegance",
      ]);
    });
  });

  it("persists and renders the selected template section order after switching templates", async () => {
    const user = userEvent.setup();
    const skillsFirstManifest = createManifest({
      templateId: "skills-first-template",
      name: "Skills First Template",
      displayName: "技能先看",
      description: "技能放在前面，适合技能更成体系的简历。",
      sectionOrder: ["skills", "education", "experience", "awards"],
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
    workspace.templateSession = {
      ...workspace.templateSession!,
      candidateTemplateIds: [BASELINE_TEMPLATE_MANIFESTS[0]!.templateId, skillsFirstManifest.templateId],
      candidateManifests: [BASELINE_TEMPLATE_MANIFESTS[0]!, skillsFirstManifest],
      selectedTemplateId: BASELINE_TEMPLATE_MANIFESTS[0]!.templateId,
      moduleOrder: ["profile", ...BASELINE_TEMPLATE_MANIFESTS[0]!.sectionOrder],
    };

    vi.spyOn(storage, "loadWorkspace").mockResolvedValue(workspace);
    const saveWorkspace = vi.spyOn(storage, "saveWorkspace").mockResolvedValue();

    const { container } = render(<ResumeStudio />);

    expect(await screen.findByRole("button", { name: "技能先看" })).toBeInTheDocument();
    saveWorkspace.mockClear();

    await user.click(screen.getByRole("button", { name: "技能先看" }));

    await waitFor(() => {
      const savedWorkspace = saveWorkspace.mock.calls.at(-1)?.[0];

      expect(savedWorkspace?.templateSession?.selectedTemplateId).toBe("skills-first-template");
      expect(savedWorkspace?.templateSession?.moduleOrder).toEqual([
        "profile",
        "skills",
        "education",
        "experience",
        "awards",
      ]);
    });

    const sectionHeadings = [...container.querySelectorAll(".resume-section-bar")].map((node) =>
      node.textContent?.trim(),
    );

    expect(sectionHeadings.indexOf("专业技能")).toBeLessThan(sectionHeadings.indexOf("教育背景"));
    expect(sectionHeadings.indexOf("教育背景")).toBeLessThan(sectionHeadings.indexOf("实习经历"));
  });

  it("ignores stale template-generation responses when newer draft generation finishes later", async () => {
    const user = userEvent.setup();
    let resolveFirstTemplateResponse: ((value: Record<string, unknown>) => void) | undefined;

    const fetchSpy = mockAdaptiveIntakeFetch({
      templateResponse: (callIndex) => {
        if (callIndex === 0) {
          return new Promise<Record<string, unknown>>((resolve) => {
            resolveFirstTemplateResponse = resolve;
          });
        }

        return Promise.resolve({
          mode: "fallback",
          candidates: [
            createManifest({
              templateId: "flagship-reference",
              name: "Flagship Reference",
            }),
            createManifest({
              templateId: "fresh-template",
              name: "Fresh Template",
              displayName: "新版紧凑",
              description: "新版候选里更紧凑的一套。",
              sectionOrder: ["skills", "education", "experience", "awards"],
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
            createManifest({
              templateId: "banner-template",
              name: "Banner Template",
              displayName: "重点突出",
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
        });
      },
    });
    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    const generateButton = screen.getByRole("button", { name: "整理并起稿" });

    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "向金涛",
        "目标岗位：招聘实习生",
        "电话：18973111415",
        "邮箱：3294182452@qq.com",
        "所在地：深圳",
        "教育：中南财经政法大学 人力资源管理 2022.09-2026.06",
        "经历：微派网络科技有限公司 招聘实习生 2025.10-2026.02 支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      ].join("\n"),
    );

    await act(async () => {
      fireEvent.click(generateButton);
      fireEvent.click(generateButton);
      await Promise.resolve();
    });

    await screen.findByText("第一版简历已经出来了");
    expect(await screen.findByRole("button", { name: "新版紧凑" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重点突出" })).toBeInTheDocument();
    expect(
      fetchSpy.mock.calls.filter(([input]) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        return url.includes("/api/ai/generate-templates");
      }),
    ).toHaveLength(2);

    await act(async () => {
      resolveFirstTemplateResponse?.({
        mode: "fallback",
        candidates: [
          createManifest({
            templateId: "flagship-reference",
            name: "Flagship Reference",
          }),
          createManifest({
            templateId: "stale-template",
            name: "Stale Template",
            displayName: "旧版重点",
            description: "旧请求返回的重点样式。",
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
          createManifest({
            templateId: "stale-compact-template",
            name: "Stale Compact Template",
            displayName: "旧版紧凑",
            description: "旧请求返回的紧凑样式。",
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
        ],
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "新版紧凑" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "旧版重点" })).not.toBeInTheDocument();
  });

  it("preserves a manual template switch while one template-generation request is still in flight", async () => {
    const user = userEvent.setup();
    let resolveTemplateResponse: ((value: Record<string, unknown>) => void) | undefined;

    mockAdaptiveIntakeFetch({
      templateResponse: () =>
        new Promise<Record<string, unknown>>((resolve) => {
          resolveTemplateResponse = resolve;
        }),
    });
    const saveWorkspace = vi.spyOn(storage, "saveWorkspace").mockResolvedValue();

    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "向金涛",
        "目标岗位：招聘实习生",
        "电话：18973111415",
        "邮箱：3294182452@qq.com",
        "所在地：深圳",
        "教育：中南财经政法大学 人力资源管理 2022.09-2026.06",
        "经历：微派网络科技有限公司 招聘实习生 2025.10-2026.02 支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));
    const compactButton = await screen.findByRole("button", { name: "一页紧凑版" });

    saveWorkspace.mockClear();
    await user.click(compactButton);

    await waitFor(() => {
      const savedWorkspace = saveWorkspace.mock.calls.at(-1)?.[0];

      expect(savedWorkspace?.templateSession?.selectedTemplateId).toBe("compact-elegance");
    });

    await act(async () => {
      resolveTemplateResponse?.({
        mode: "fallback",
        candidates: BASELINE_TEMPLATE_MANIFESTS,
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "一页紧凑版" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    const savedWorkspace = saveWorkspace.mock.calls.at(-1)?.[0];
    expect(savedWorkspace?.templateSession?.selectedTemplateId).toBe("compact-elegance");
  }, 15_000);

  it("ignores a late template response when the user switched to a template that is not in that response", async () => {
    const user = userEvent.setup();
    let resolveTemplateResponse: ((value: Record<string, unknown>) => void) | undefined;

    mockAdaptiveIntakeFetch({
      templateResponse: () =>
        new Promise<Record<string, unknown>>((resolve) => {
          resolveTemplateResponse = resolve;
        }),
    });
    const saveWorkspace = vi.spyOn(storage, "saveWorkspace").mockResolvedValue();

    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "向金涛",
        "目标岗位：招聘实习生",
        "电话：18973111415",
        "邮箱：3294182452@qq.com",
        "所在地：深圳",
        "教育：中南财经政法大学 人力资源管理 2022.09-2026.06",
        "经历：微派网络科技有限公司 招聘实习生 2025.10-2026.02 支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));
    const compactButton = await screen.findByRole("button", { name: "一页紧凑版" });

    saveWorkspace.mockClear();
    await user.click(compactButton);

    await waitFor(() => {
      const savedWorkspace = saveWorkspace.mock.calls.at(-1)?.[0];
      expect(savedWorkspace?.templateSession?.selectedTemplateId).toBe("compact-elegance");
      expect(savedWorkspace?.templateSession?.candidateTemplateIds).toContain("compact-elegance");
    });

    await act(async () => {
      resolveTemplateResponse?.({
        mode: "fallback",
        candidates: [
          createManifest({
            templateId: "flagship-reference",
            name: "Flagship Reference",
          }),
          createManifest({
            templateId: "fresh-template",
            name: "Fresh Template",
            displayName: "新版紧凑",
            description: "新版候选里更紧凑的一套。",
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
          createManifest({
            templateId: "banner-template",
            name: "Banner Template",
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
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "一页紧凑版" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    const savedWorkspace = saveWorkspace.mock.calls.at(-1)?.[0];
    expect(savedWorkspace?.templateSession?.selectedTemplateId).toBe("compact-elegance");
    expect(savedWorkspace?.templateSession?.candidateTemplateIds).toContain("compact-elegance");
    expect(savedWorkspace?.templateSession?.candidateTemplateIds).not.toContain("fresh-template");
  });

  it("falls back to a returned candidate when a refresh omits the original selection without a manual switch", async () => {
    const user = userEvent.setup();
    let resolveTemplateResponse: ((value: Record<string, unknown>) => void) | undefined;

    mockAdaptiveIntakeFetch({
      templateResponse: () =>
        new Promise<Record<string, unknown>>((resolve) => {
          resolveTemplateResponse = resolve;
        }),
    });
    const saveWorkspace = vi.spyOn(storage, "saveWorkspace").mockResolvedValue();

    render(<ResumeStudio />);

    await user.click(screen.getByRole("button", { name: "导入旧材料" }));
    await user.type(
      screen.getByLabelText("粘贴现有简历或自我介绍"),
      [
        "向金涛",
        "目标岗位：招聘实习生",
        "电话：18973111415",
        "邮箱：3294182452@qq.com",
        "所在地：深圳",
        "教育：中南财经政法大学 人力资源管理 2022.09-2026.06",
        "经历：微派网络科技有限公司 招聘实习生 2025.10-2026.02 支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
      ].join("\n"),
    );

    await user.click(screen.getByRole("button", { name: "整理并起稿" }));
    await screen.findByRole("button", { name: "稳妥通用版" });

    await act(async () => {
      resolveTemplateResponse?.({
        mode: "fallback",
        candidates: [
          createManifest({
            templateId: "fresh-template",
            name: "Fresh Template",
            displayName: "新版紧凑",
            description: "新版候选里更紧凑的一套。",
            sectionOrder: ["skills", "education", "experience", "awards"],
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
          createManifest({
            templateId: "banner-template",
            name: "Banner Template",
            sectionOrder: ["education", "awards", "experience", "skills"],
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
          createManifest({
            templateId: "compact-template",
            name: "Compact Template",
            sectionOrder: ["experience", "education", "skills", "awards"],
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
        ],
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "新版紧凑" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    const savedWorkspace = saveWorkspace.mock.calls.at(-1)?.[0];
    expect(savedWorkspace?.templateSession?.selectedTemplateId).toBe("fresh-template");
    expect(savedWorkspace?.templateSession?.candidateTemplateIds).toEqual([
      "fresh-template",
      "banner-template",
      "compact-template",
    ]);
    expect(savedWorkspace?.templateSession?.moduleOrder).toEqual([
      "profile",
      "skills",
      "education",
      "experience",
      "awards",
    ]);
  });
});
