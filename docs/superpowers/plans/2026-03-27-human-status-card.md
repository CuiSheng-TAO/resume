# Human Status Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把编辑区状态卡改成人话结论卡，让用户一眼看懂能否导出、版面是否偏空/偏满，以及下一步该补什么。

**Architecture:** 在 `ResumeStudio` 内新增一层轻量状态推导，统一输出 badge、结论、原因、下一步建议；更新状态卡渲染和样式；通过组件测试锁定“偏少但可导出时显示建议补强”的核心行为。

**Tech Stack:** React, Next.js, Vitest, Testing Library

---

### Task 1: Lock the new copy with a failing test

**Files:**
- Modify: `tests/resume-studio.test.tsx`

- [ ] **Step 1: Write the failing test**

Add assertions for the sparse-draft case:

```tsx
expect(screen.getByText("这版简历怎么样")).toBeInTheDocument();
expect(screen.getByText("建议补强")).toBeInTheDocument();
expect(screen.getByText("可以导出，但建议先补强")).toBeInTheDocument();
expect(screen.getByText("这一版版面已经稳定，但内容偏少，导出后会显得有些空。")).toBeInTheDocument();
expect(screen.getByText("建议先补：教育亮点 / 1 条量化结果 / 更完整的技能关键词。")).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/resume-studio.test.tsx -t "replaces the task board with lightweight clickable guidance and a quieter preview summary"`

Expected: FAIL because the component still renders the old `当前草稿 / 规则单页 / 实测预览` copy.

### Task 2: Implement the human status card

**Files:**
- Modify: `components/resume-studio.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write minimal implementation**

Add a derived status object and render:

```tsx
<h3>这版简历怎么样</h3>
<span className="block-status warn">建议补强</span>
<p className="status-card-summary">可以导出，但建议先补强</p>
<p className="status-card-reason">这一版版面已经稳定，但内容偏少，导出后会显得有些空。</p>
<p className="status-card-next">建议先补：教育亮点 / 1 条量化结果 / 更完整的技能关键词。</p>
```

Add badge tone styles and summary text styles in CSS.

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- tests/resume-studio.test.tsx -t "replaces the task board with lightweight clickable guidance and a quieter preview summary"`

Expected: PASS

### Task 3: Verify the full app

**Files:**
- Modify: `tests/resume-studio.test.tsx` if any final wording alignment is needed

- [ ] **Step 1: Run focused UI regression**

Run: `npm test -- tests/resume-studio.test.tsx`

Expected: PASS

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.
