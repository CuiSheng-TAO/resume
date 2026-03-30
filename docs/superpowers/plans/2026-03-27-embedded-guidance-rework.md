# Embedded Guidance Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the awkward standalone `先 3 步 / 再 3 步` task board and replace it with lightweight clickable guidance embedded in the actual resume editing flow.

**Architecture:** Keep the existing editor sections as the only primary workspace, add a thin quick-guidance strip that scrolls users to relevant modules, and move all hints into user-facing module copy. Reduce preview status emphasis from multiple chips to one lighter summary line.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library

---

### Task 1: Lock the new UX in tests

**Files:**
- Modify: `tests/resume-studio.test.tsx`

- [ ] **Step 1: Write failing tests for the new embedded guidance**

Add tests that assert:
- the standalone `先 3 步 / 再 3 步` task panel is gone
- a lightweight clickable guidance strip appears instead
- the implementation-note helper text is removed from education highlights
- preview shows one lighter status summary instead of multiple separate status chips

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/resume-studio.test.tsx`
Expected: FAIL because the current UI still renders the task panel and old helper copy

### Task 2: Replace the task board with quick guidance

**Files:**
- Modify: `components/resume-studio.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Remove refinement task state and panel**

Delete:
- `completedRefinementTaskIds`
- `showExtraRefinementSteps`
- the large `Refine` block and its related handlers

- [ ] **Step 2: Add a lightweight clickable guidance strip**

Implement a compact strip near the top of the editor with buttons such as:
- `补教育亮点`
- `强化经历`
- `检查单页`

Each button should scroll to the corresponding editor section using refs.

- [ ] **Step 3: Downgrade preview status emphasis**

Replace the current multi-chip preview status row with a quieter single-line summary, for example:
- `当前为紧凑单页，内容偏满，实测预览通过`

### Task 3: Move guidance into real modules

**Files:**
- Modify: `components/resume-studio.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Make education hints user-facing**

Replace the implementation note with user-facing copy like:
- `可选补充六级、GPA、排名、普通话等信息；有就填，没有可留空。`

- [ ] **Step 2: Make experience/export hints user-facing**

Add brief helpful hints inside the real modules instead of task-board language.

### Task 4: Verify

**Files:**
- Modify: `tests/resume-studio.test.tsx`

- [ ] **Step 1: Run targeted tests**

Run: `npm test -- tests/resume-studio.test.tsx`
Expected: PASS

- [ ] **Step 2: Run full verification**

Run:
- `npm test`
- `npm run lint`
- `npm run build`

Expected:
- all tests pass
- lint passes
- build passes
