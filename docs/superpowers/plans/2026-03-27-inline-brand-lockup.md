# Inline Brand Lockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把首页 hero 改成单一品牌锁定，让 `人人都有美观简历` 成为贴近 `Siamese Dream` 的小副标。

**Architecture:** 更新 `ResumeStudio` 的 hero 标记结构，用一个内联品牌锁定替代左右分栏；同步调整 `globals.css` 的 hero 样式；用组件测试锁定新结构并防止旧结构回归。

**Tech Stack:** Next.js, React, Vitest, Testing Library

---

### Task 1: Lock the new hero structure with a failing test

**Files:**
- Modify: `tests/resume-studio.test.tsx`

- [ ] **Step 1: Write the failing test**

Add assertions that the landing state renders:

```tsx
expect(container.querySelector(".hero-title-lockup")).not.toBeNull();
expect(screen.getByText("人人都有美观简历")).toBeInTheDocument();
expect(container.querySelector(".hero-side")).toBeNull();
expect(
  screen.getByText("3 分钟先起一版，接着用 3 步把它修成可投递简历。"),
).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/resume-studio.test.tsx -t "shows the two-entry landing state"`

Expected: FAIL because `.hero-title-lockup` does not exist and the note still uses the old split structure.

### Task 2: Implement the inline brand lockup

**Files:**
- Modify: `components/resume-studio.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write minimal implementation**

Update the hero markup to:

```tsx
<section className="hero-strip">
  <div className="hero-brand">
    <div className="hero-title-lockup">
      <h1>Siamese Dream</h1>
      <p className="hero-subtitle">人人都有美观简历</p>
    </div>
    <p className="hero-note">3 分钟先起一版，接着用 3 步把它修成可投递简历。</p>
  </div>
</section>
```

Add CSS for:

```css
.hero-title-lockup {
  display: flex;
  align-items: baseline;
  gap: 16px;
  flex-wrap: wrap;
}

.hero-subtitle {
  margin: 0;
  padding-left: 16px;
}
```

Also remove the now-unused `.hero-side` layout styling.

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- tests/resume-studio.test.tsx -t "shows the two-entry landing state"`

Expected: PASS

### Task 3: Verify the full app still behaves

**Files:**
- Modify: `tests/resume-studio.test.tsx` if any follow-up assertion needs alignment

- [ ] **Step 1: Run focused regression checks**

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
