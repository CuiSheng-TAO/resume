# Resume Design Skill System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前“3 套候选模板 + 窄 manifest 组合”升级成“4 个家族、14 套首批模板的高质量模板库”，并让 AI 只负责从模板库里匹配、排序、轻量调节，而不是继续临时发明模板。

**Architecture:** 先把“简历美观”沉淀成项目内部的设计系统文档，再把模板库抽成显式的代码资产，最后把模板生成链路改成“模板库短名单 + AI 排序”的两段式流程。渲染层继续走受控 renderer，但要扩展变体面；UI 层默认展示更丰富的模板卡片信息，补强态再收起，保持注意力聚焦。

**Tech Stack:** Next.js 16、React 19、TypeScript、Vitest、Zod、现有 Anthropic JSON 路由、现有 shared template renderer。

---

## File Map

**Create**

- `docs/product/2026-03-30-resume-template-family-library.md`
- `docs/product/2026-03-30-resume-design-skill-system-skill-creator-review.md`
- `lib/template-library.ts`
- `lib/template-matching.ts`
- `tests/template-library.test.ts`

**Modify**

- `lib/template-manifest.ts`
- `lib/resume-document.ts`
- `lib/template-renderer.ts`
- `app/api/ai/generate-templates/route.ts`
- `components/resume-studio.tsx`
- `app/globals.css`
- `tests/template-manifest.test.ts`
- `tests/ai-routes.test.ts`
- `tests/resume-studio.test.tsx`
- `tests/resume-preview.test.tsx`
- `tests/export.test.ts`

## Implementation Notes

- 当前 `lib/template-manifest.ts` 只内置 3 套 baseline manifest，且 `displayName/description` 仍然由少数启发式推断出来，这会把“AI 版式”继续压成三种近似命名。
- 当前 `app/api/ai/generate-templates/route.ts` 仍然要求 AI 直接返回 manifest-like 结果；这条链路过宽，也不适合沉淀“模板资产”。
- 当前 `lib/template-renderer.ts` 仍然主要围绕现有的少量变体工作；如果不先扩展 renderer surface，14 套模板最后只会变成 14 张相似卡片。
- 当前 `components/resume-studio.tsx` 已经能显示 `displayName` 与 `description`，所以 UI 改动重点是“更丰富的卡片信息”和“默认展开/补强态折叠”，而不是重做交互骨架。

### Task 1: 固化设计系统文档与 `skill-creator` 审查附录

**Files:**
- Create: `docs/product/2026-03-30-resume-template-family-library.md`
- Create: `docs/product/2026-03-30-resume-design-skill-system-skill-creator-review.md`

- [ ] **Step 1: 写出模板家族设计总文档**

在 `docs/product/2026-03-30-resume-template-family-library.md` 中直接落完整结构，不要只写提纲。正文至少覆盖：

```md
# 校招简历模板家族库

## 目标
- 模板是设计资产，不是运行时随意组合
- 首批交付 4 个家族 / 14 套模板
- 80% 稳妥可投，20% 有设计感但仍可打印

## 家族
### 温暖专业
- 适合：大多数校招生
- 关键词：稳妥、可信、有人味
- 模板：暖调标准、暖调教育优先、暖调经历优先、暖调轻照片

### 冷静学术
- 适合：教育强、气质偏理性
- 关键词：秩序、克制、学术感
- 模板：学术横排、学术亮点、学术时间轴、学术紧凑

### 现代清爽
- 适合：内容不算多、想更利落
- 关键词：轻、干净、当代
- 模板：清爽极简、清爽均衡、清爽紧凑

### 重点鲜明
- 适合：亮点足、结果数字清楚
- 关键词：抓眼、上半页有力
- 模板：亮点横幅、亮点指标、亮点上提
```

- [ ] **Step 2: 写出 `skill-creator` 审查附录**

在 `docs/product/2026-03-30-resume-design-skill-system-skill-creator-review.md` 中明确区分“审美判断”和“skill 结构判断”：

```md
# Resume Design Skill System `skill-creator` Review

## 审查结论
- `skill-creator` 适合审查边界、触发条件、复用性
- `skill-creator` 不负责判断模板是否真的美

## 建议保留为内部设计系统的 skill
- 教育呈现
- 经历可读性
- 单页平衡
- 重点鲜明

## 建议后续升级为真实可调用 skill 的候选
- 信息层级
- 信息压缩
- 打印安全
- 温暖专业

## 理由
- 这些条目更接近稳定规则，适合高复用、低歧义的调用方式
```

- [ ] **Step 3: 运行文档自检**

Run:

```bash
rg -n "TODO|TBD|placeholder" docs/product/2026-03-30-resume-template-family-library.md docs/product/2026-03-30-resume-design-skill-system-skill-creator-review.md
```

Expected:

```text
no matches
```

- [ ] **Step 4: Commit**

```bash
git add docs/product/2026-03-30-resume-template-family-library.md docs/product/2026-03-30-resume-design-skill-system-skill-creator-review.md
git commit -m "docs: add template family library docs"
```

### Task 2: 抽出模板库元数据层，停止用少量启发式硬推卡片文案

**Files:**
- Create: `lib/template-library.ts`
- Modify: `lib/template-manifest.ts`
- Modify: `lib/resume-document.ts`
- Test: `tests/template-library.test.ts`
- Test: `tests/template-manifest.test.ts`

- [ ] **Step 1: 写失败测试，锁住模板库元数据结构**

在 `tests/template-library.test.ts` 新增：

```ts
import { describe, expect, it } from "vitest";

import {
  TEMPLATE_FAMILY_LIBRARY,
  TEMPLATE_FAMILY_ORDER,
  type TemplateFamilyId,
} from "@/lib/template-library";

describe("template library", () => {
  it("ships 4 families and 14 curated templates", () => {
    expect(TEMPLATE_FAMILY_ORDER).toEqual([
      "warm-professional",
      "calm-academic",
      "modern-clean",
      "highlight-forward",
    ] satisfies TemplateFamilyId[]);
    expect(TEMPLATE_FAMILY_LIBRARY).toHaveLength(14);
  });

  it("gives every template a Chinese card copy and family metadata", () => {
    for (const template of TEMPLATE_FAMILY_LIBRARY) {
      expect(template.displayName.trim().length).toBeGreaterThan(0);
      expect(template.description.trim().length).toBeGreaterThan(0);
      expect(template.familyId).toBeTruthy();
      expect(template.familyLabel).toBeTruthy();
      expect(template.fitSummary).toBeTruthy();
      expect(template.previewHighlights.length).toBeGreaterThanOrEqual(2);
    }
  });
});
```

- [ ] **Step 2: 跑测试，确认当前失败**

Run:

```bash
npm test -- tests/template-library.test.ts
```

Expected:

```text
FAIL
Cannot find module '@/lib/template-library'
```

- [ ] **Step 3: 写模板库文件与 manifest 元数据扩展**

创建 `lib/template-library.ts`，并在 `lib/template-manifest.ts` 中把这批元数据变成 schema 的一部分。首版用下面的形状：

```ts
export type TemplateFamilyId =
  | "warm-professional"
  | "calm-academic"
  | "modern-clean"
  | "highlight-forward";

export type CuratedTemplateManifest = TemplateManifest & {
  familyId: TemplateFamilyId;
  familyLabel: string;
  fitSummary: string;
  previewHighlights: string[];
};

export const TEMPLATE_FAMILY_ORDER: TemplateFamilyId[] = [
  "warm-professional",
  "calm-academic",
  "modern-clean",
  "highlight-forward",
];

export const TEMPLATE_FAMILY_LIBRARY: CuratedTemplateManifest[] = [
  {
    version: "v1",
    templateId: "warm-classic",
    name: "Warm Classic",
    displayName: "温和标准版",
    description: "稳妥耐看，适合大多数校招简历。",
    familyId: "warm-professional",
    familyLabel: "温暖专业",
    fitSummary: "适合信息中等、想先稳稳做出一版的人。",
    previewHighlights: ["稳妥", "单栏", "教育和经历平衡"],
    tone: "academic",
    page: { size: "A4", marginPreset: "balanced", layout: "single-column" },
    theme: { fontPair: "songti-sans", accentColor: "navy", dividerStyle: "line" },
    sectionOrder: ["education", "experience", "awards", "skills"],
    sections: {
      hero: { variant: "split-meta-band" },
      education: { variant: "school-emphasis" },
      experience: { variant: "stacked-bullets" },
      awards: { variant: "two-column-table" },
      skills: { variant: "inline-tags" },
    },
    compactionPolicy: { density: "balanced", overflowPriority: ["awards", "skills", "experience"] },
  },
];
```

同时在 `lib/template-manifest.ts` 中把 schema 扩成：

```ts
const templateMetadataSchema = z.object({
  familyId: z.enum(["warm-professional", "calm-academic", "modern-clean", "highlight-forward"]),
  familyLabel: z.string().trim().min(1),
  fitSummary: z.string().trim().min(1),
  previewHighlights: z.array(z.string().trim().min(1)).min(2).max(3),
});
```

并把 `TemplateManifest` 变成包含这些字段的输出类型，`hydrateTemplateManifestDisplayCopy` 不再只靠 `classic-banner / compact-cards` 等启发式兜底生成最终卡片文案。

- [ ] **Step 4: 更新 template session 归一化逻辑**

在 `lib/resume-document.ts` 里保持 `candidateManifests` 经过 hydration 后仍能带着模板库元数据进入 `TemplateSession`：

```ts
const resolveCandidateTemplateManifests = (
  candidateManifests?: readonly TemplateManifest[],
  candidateTemplateIds: readonly string[] = BASELINE_TEMPLATE_IDS,
) => {
  const manifestById = new Map<string, TemplateManifest>();
  const orderedManifests: TemplateManifest[] = [];

  for (const manifest of candidateManifests ?? []) {
    const hydratedManifest = hydrateTemplateManifestDisplayCopy(manifest);
    manifestById.set(hydratedManifest.templateId, hydratedManifest);
    orderedManifests.push(hydratedManifest);
  }
```

这一段代码结构可以保留，但后续 fallback 要优先走模板库里的首批 14 套，而不是固定 3 套 baseline。

- [ ] **Step 5: 跑 manifest 与模板库测试**

Run:

```bash
npm test -- tests/template-library.test.ts tests/template-manifest.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 6: Commit**

```bash
git add lib/template-library.ts lib/template-manifest.ts lib/resume-document.ts tests/template-library.test.ts tests/template-manifest.test.ts
git commit -m "feat: add curated template library metadata"
```

### Task 3: 扩大 renderer surface，让 14 套模板不只是换标题文案

**Files:**
- Modify: `lib/template-manifest.ts`
- Modify: `lib/template-renderer.ts`
- Modify: `app/globals.css`
- Test: `tests/resume-preview.test.tsx`
- Test: `tests/export.test.ts`

- [ ] **Step 1: 写失败测试，锁住新变体真的会出现在 DOM/CSS 上**

在 `tests/resume-preview.test.tsx` 增加一条使用新模板变体的测试：

```ts
it("renders the curated warm-classic manifest through the shared renderer classes", () => {
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
      narrative: "推进候选人初筛、约面和到岗复盘。",
    },
    skills: ["招聘", "Excel"],
  }) as any;

  workspace.templateSession.selectedTemplateId = "warm-classic";
  workspace.templateSession.candidateManifests = TEMPLATE_FAMILY_LIBRARY;

  const { container } = render(<ResumePreview workspace={workspace} />);

  expect(container.querySelector(".resume-hero--split-meta-band")).toBeTruthy();
  expect(container.querySelector(".resume-education--school-emphasis")).toBeTruthy();
});
```

- [ ] **Step 2: 跑测试，确认当前失败**

Run:

```bash
npm test -- tests/resume-preview.test.tsx tests/export.test.ts
```

Expected:

```text
FAIL
Expected null to be truthy
```

- [ ] **Step 3: 扩展 manifest 允许的变体枚举**

在 `lib/template-manifest.ts` 里扩展枚举，不要继续只维持当前 3x2x3 的窄面：

```ts
export const heroVariantSchema = z.enum([
  "classic-banner",
  "name-left-photo-right",
  "centered-name-minimal",
  "split-meta-band",
  "stacked-profile-card",
]);

export const educationVariantSchema = z.enum([
  "compact-rows",
  "highlight-strip",
  "school-emphasis",
  "signal-grid",
]);

export const experienceVariantSchema = z.enum([
  "stacked-bullets",
  "metric-first",
  "compact-cards",
  "role-first",
  "result-callout",
]);
```

- [ ] **Step 4: 在 renderer 和样式里实现新变体**

在 `lib/template-renderer.ts` 中按变体分发，而不是所有家族仍然共享一套布局：

```ts
const renderHero = (workspace: WorkspaceData, manifest: TemplateManifest) => {
  switch (manifest.sections.hero.variant) {
    case "split-meta-band":
      return renderSplitMetaBandHero(workspace, manifest);
    case "stacked-profile-card":
      return renderStackedProfileCardHero(workspace, manifest);
    case "centered-name-minimal":
      return renderCenteredHero(workspace, manifest);
    default:
      return renderDefaultHero(workspace, manifest);
  }
};
```

在 `app/globals.css` 中同步补对应类名，至少覆盖：

```css
.resume-hero--split-meta-band { }
.resume-hero--stacked-profile-card { }
.resume-education--school-emphasis { }
.resume-education--signal-grid { }
.resume-experience--role-first { }
.resume-experience--result-callout { }
.resume-awards--pill-row { }
.resume-skills--label-columns { }
```

导出路径也要走同一份 renderer，所以 `tests/export.test.ts` 要锁住新类名会出现在 HTML 里。

- [ ] **Step 5: 跑预览与导出回归**

Run:

```bash
npm test -- tests/resume-preview.test.tsx tests/export.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 6: Commit**

```bash
git add lib/template-manifest.ts lib/template-renderer.ts app/globals.css tests/resume-preview.test.tsx tests/export.test.ts
git commit -m "feat: expand renderer surface for curated template families"
```

### Task 4: 落首批 4 家族 / 14 套模板，不再只靠 3 套 baseline 顶住全部候选

**Files:**
- Modify: `lib/template-library.ts`
- Modify: `lib/template-manifest.ts`
- Test: `tests/template-library.test.ts`
- Test: `tests/template-manifest.test.ts`

- [ ] **Step 1: 写失败测试，锁住模板家族分布**

在 `tests/template-library.test.ts` 增加：

```ts
it("balances the first batch across the approved families", () => {
  const grouped = Object.groupBy(TEMPLATE_FAMILY_LIBRARY, (item) => item.familyId);

  expect(grouped["warm-professional"]).toHaveLength(4);
  expect(grouped["calm-academic"]).toHaveLength(4);
  expect(grouped["modern-clean"]).toHaveLength(3);
  expect(grouped["highlight-forward"]).toHaveLength(3);
});
```

- [ ] **Step 2: 跑测试，确认当前失败**

Run:

```bash
npm test -- tests/template-library.test.ts
```

Expected:

```text
FAIL
Expected length 4 but received 1
```

- [ ] **Step 3: 把 14 套模板全部填进模板库**

在 `lib/template-library.ts` 里补足以下清单，每套都要有不同的结构差异，不允许只改颜色：

```ts
export const TEMPLATE_FAMILY_LIBRARY: CuratedTemplateManifest[] = [
  // warm-professional
  warmClassic,
  warmEducationFirst,
  warmExperienceFirst,
  warmPhotoRight,

  // calm-academic
  academicLedger,
  academicSignals,
  academicTimeline,
  academicCompact,

  // modern-clean
  modernMinimal,
  modernBalanced,
  modernTight,

  // highlight-forward
  highlightBanner,
  highlightMetrics,
  highlightTopBlock,
];
```

每个条目都必须包含：

```ts
{
  displayName: "学术亮点版",
  familyLabel: "冷静学术",
  fitSummary: "适合教育亮点明确、想突出 GPA / 排名 / 保研信息的人。",
  previewHighlights: ["教育前置", "亮点清楚", "秩序感强"],
}
```

同时把 `BASELINE_TEMPLATE_MANIFESTS` 退化为“最后兜底的小集合”，不要再把它当成用户平时会长期看到的主模板源。

- [ ] **Step 4: 跑模板库与 manifest 去重回归**

Run:

```bash
npm test -- tests/template-library.test.ts tests/template-manifest.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 5: Commit**

```bash
git add lib/template-library.ts lib/template-manifest.ts tests/template-library.test.ts tests/template-manifest.test.ts
git commit -m "feat: ship first curated template family batch"
```

### Task 5: 把模板生成链路改成“模板库短名单 + AI 排序”，不再让 AI 直接造 manifest

**Files:**
- Create: `lib/template-matching.ts`
- Modify: `app/api/ai/generate-templates/route.ts`
- Test: `tests/ai-routes.test.ts`
- Test: `tests/template-library.test.ts`

- [ ] **Step 1: 写失败测试，锁住路由改成库内排序**

在 `tests/ai-routes.test.ts` 中新增：

```ts
it("returns curated template library candidates when ai is unavailable", async () => {
  vi.spyOn(anthropicModule, "getAnthropicConfig").mockReturnValue({
    apiKey: null,
    model: null,
    timeoutMs: 12000,
    maxRetries: 0,
    routeLimitWindowMs: 300000,
    routeLimitMaxRequests: 20,
    enabled: false,
  });

  const response = await generateTemplatesPost(
    new Request("http://localhost/api/ai/generate-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentDocument: createContentDocument(),
        stylePreference: "",
      }),
    }),
  );

  const payload = await response.json();

  expect(payload.candidates).toHaveLength(3);
  expect(payload.candidates[0].familyLabel).toBeTruthy();
  expect(payload.candidates[0].fitSummary).toBeTruthy();
});
```

- [ ] **Step 2: 跑测试，确认当前失败**

Run:

```bash
npm test -- tests/ai-routes.test.ts
```

Expected:

```text
FAIL
Expected familyLabel to be truthy
```

- [ ] **Step 3: 实现 deterministic matcher 与 AI shortlist 排序**

创建 `lib/template-matching.ts`：

```ts
import type { ResumeContentDocument } from "@/lib/resume-document";
import { TEMPLATE_FAMILY_LIBRARY } from "@/lib/template-library";

export const scoreTemplateFit = (content: ResumeContentDocument, templateId: string) => {
  const educationCount = content.education.length;
  const experienceCount = content.experiences.length;
  const metricCount = content.experiences.flatMap((item) => item.metrics ?? []).length;
  const skillCount = content.skills.length;

  const scoreParts = {
    educationStrength: educationCount >= 2 ? 2 : 1,
    experienceDensity: experienceCount >= 3 ? 2 : 1,
    highlightStrength: metricCount >= 2 ? 2 : 0,
    compressionNeed: skillCount >= 6 ? 1 : 0,
  };

  return { total: Object.values(scoreParts).reduce((sum, value) => sum + value, 0), scoreParts };
};

export const shortlistTemplateLibrary = (content: ResumeContentDocument, count = 6) =>
  [...TEMPLATE_FAMILY_LIBRARY]
    .map((template) => ({
      template,
      score: scoreTemplateFit(content, template.templateId),
    }))
    .sort((left, right) => right.score.total - left.score.total)
    .slice(0, count);
```

然后把 `app/api/ai/generate-templates/route.ts` 改成：

```ts
const shortlist = shortlistTemplateLibrary(parsed.data.contentDocument, 6);

if (!config.enabled) {
  return NextResponse.json({
    candidates: shortlist.slice(0, 3).map((item) => item.template),
    mode: "fallback",
  });
}
```

AI 有配置时，不再让它直接返回完整 manifest，而是只允许它返回 shortlist 中的 `templateId[]` 排序结果，例如：

```ts
const responseSchema = z.object({
  orderedTemplateIds: z.array(z.string()).min(1).max(3),
});
```

最后仍然由本地代码从模板库里取出这 3 套模板，必要时再把 deterministic shortlist 补满。

- [ ] **Step 4: 跑 AI 路由回归**

Run:

```bash
npm test -- tests/ai-routes.test.ts tests/template-library.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 5: Commit**

```bash
git add lib/template-matching.ts app/api/ai/generate-templates/route.ts tests/ai-routes.test.ts tests/template-library.test.ts
git commit -m "feat: rank curated template library candidates"
```

### Task 6: 让第一版页面默认看到 3 套更完整的模板卡片，补强态再折叠

**Files:**
- Modify: `components/resume-studio.tsx`
- Modify: `app/globals.css`
- Test: `tests/resume-studio.test.tsx`

- [ ] **Step 1: 写失败测试，锁住模板卡片信息与展开策略**

在 `tests/resume-studio.test.tsx` 增加两条：

```ts
it("shows the first three template cards by default in starter mode", async () => {
  render(<ResumeStudio />);

  await userEvent.click(screen.getByText("导入旧材料"));
  await userEvent.type(screen.getByLabelText("旧材料"), "陈星野\n目标岗位：招聘运营实习生");
  await userEvent.click(screen.getByText("整理并起稿"));

  expect(await screen.findByText("第一版简历已经出来了")).toBeInTheDocument();
  expect(screen.getByText("温和标准版")).toBeInTheDocument();
  expect(screen.getByText("温暖专业")).toBeInTheDocument();
});

it("folds template cards again after entering strengthening mode", async () => {
  render(<ResumeStudio />);

  // ...走到 starter
  await userEvent.click(await screen.findByText("继续完善这版"));

  expect(screen.getByText("需要时再看版式")).toBeInTheDocument();
});
```

- [ ] **Step 2: 跑测试，确认当前失败**

Run:

```bash
npm test -- tests/resume-studio.test.tsx
```

Expected:

```text
FAIL
Unable to find text "温和标准版"
```

- [ ] **Step 3: 改模板卡片视图模型与页面文案**

在 `components/resume-studio.tsx` 里直接用 richer metadata 渲染卡片，不再只展示标题和一句描述：

```tsx
<button
  key={manifest.templateId}
  className={selected ? "template-card template-card-selected" : "template-card"}
  onClick={() => handleTemplateSwitch(manifest.templateId)}
  type="button"
>
  <span className="template-card-family">{manifest.familyLabel}</span>
  <span className="template-card-name">{manifest.displayName}</span>
  <span className="template-card-description">{manifest.description}</span>
  <span className="template-card-fit">{manifest.fitSummary}</span>
  <span className="template-card-tags">
    {manifest.previewHighlights.map((highlight) => (
      <span className="template-card-tag" key={`${manifest.templateId}-${highlight}`}>
        {highlight}
      </span>
    ))}
  </span>
</button>
```

starter 态默认展示卡片：

```ts
const shouldShowTemplateButtons =
  editorFlowMode === "starter" ? true : editorFlowMode !== "strengthening" || showStarterTemplateOptions;
```

strengthening 态默认折叠，保留现有的“需要时再看版式”按钮。

- [ ] **Step 4: 补卡片样式**

在 `app/globals.css` 里新增：

```css
.template-card-family {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
}

.template-card-fit {
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink-soft);
}
```

不要把这块做成花哨 marketing 卡；目标是让用户一眼看懂“这套版式适合我吗”。

- [ ] **Step 5: 跑 studio 回归**

Run:

```bash
npm test -- tests/resume-studio.test.tsx
```

Expected:

```text
PASS
```

- [ ] **Step 6: Commit**

```bash
git add components/resume-studio.tsx app/globals.css tests/resume-studio.test.tsx
git commit -m "feat: surface curated template cards in starter mode"
```

### Task 7: 做一轮完整回归，覆盖预览、导出、模板匹配和真实用户主流程

**Files:**
- Modify: `tests/resume-preview.test.tsx`
- Modify: `tests/export.test.ts`
- Modify: `tests/ai-routes.test.ts`
- Modify: `tests/resume-studio.test.tsx`

- [ ] **Step 1: 补足跨层回归测试**

把这 4 条回归补齐：

```ts
// tests/resume-preview.test.tsx
expect(screen.getByText("温暖专业")).toBeInTheDocument();
expect(container.querySelector(".resume-hero--split-meta-band")).toBeTruthy();

// tests/export.test.ts
expect(html).toContain("温暖专业");
expect(html).toContain("resume-experience--result-callout");

// tests/ai-routes.test.ts
expect(payload.candidates.every((item: any) => item.familyLabel && item.fitSummary)).toBe(true);

// tests/resume-studio.test.tsx
expect(screen.getByText("再加一段教育")).toBeInTheDocument();
expect(screen.getByText("继续完善这版")).toBeInTheDocument();
```

- [ ] **Step 2: 跑定向测试**

Run:

```bash
npm test -- tests/template-library.test.ts tests/template-manifest.test.ts tests/ai-routes.test.ts tests/resume-preview.test.tsx tests/export.test.ts tests/resume-studio.test.tsx
```

Expected:

```text
PASS
```

- [ ] **Step 3: 跑全量验证**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected:

```text
all tests pass
lint exits 0
build exits 0
```

- [ ] **Step 4: 跑真实浏览器走查**

手工检查至少覆盖：

```text
1. 从零开始
2. 导入旧材料
3. 第一版生成后直接看到 3 套模板卡片
4. 模板切换后预览明显变化，不只是换标题
5. 点“继续完善这版”后模板区重新折叠
6. 新增第二段教育后，候选模板会刷新
```

- [ ] **Step 5: Commit**

```bash
git add tests/resume-preview.test.tsx tests/export.test.ts tests/ai-routes.test.ts tests/resume-studio.test.tsx
git commit -m "test: cover curated template library flows"
```

## Self-Review

### Spec coverage

- `12 个设计 skill` 的正式落点：Task 1
- `4 家族 / 14 套模板`：Task 4
- `AI 只做匹配和轻调，不再发明模板`：Task 5
- `模板卡片更可见、默认展示`：Task 6
- `补强态重新折叠模板区`：Task 6
- `导出、预览、页面与路由回归`：Task 7

### Placeholder scan

- 计划中没有未完成占位词或“以后再补”的模糊步骤
- 所有新文件和修改文件都给了确切路径
- 所有运行命令都给了明确的预期结果

### Type consistency

- 模板元数据统一挂在 `TemplateManifest` 扩展字段上：`familyId / familyLabel / fitSummary / previewHighlights`
- 模板库常量统一来源于 `lib/template-library.ts`
- 路由只返回模板库里的 manifest，不再要求 AI 返回完整 manifest
