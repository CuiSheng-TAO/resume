# Sticky Preview Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the desktop preview area into a sticky right rail, move primary export actions into that rail, and remove JSON backup from the visible main path.

**Architecture:** Keep the current editor and preview components, but restructure the editor shell so the right column owns both the live A4 preview and export actions. Preserve mobile behavior while applying sticky rail behavior only to the desktop layout.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS, Vitest, Testing Library

---

### Task 1: Lock the new desktop UX in tests

**Files:**
- Modify: `tests/resume-studio.test.tsx`

- [ ] **Step 1: Write failing tests for export placement and JSON demotion**

Add tests that assert:
- `备份 JSON 草稿` is no longer visible in the main editor UI after generating a draft
- `导出 HTML` and `打印 PDF` are rendered inside the preview rail area
- the preview rail exposes a distinct footer/actions region

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/resume-studio.test.tsx`
Expected: FAIL because export actions still live in the left editor column and JSON backup is still visible

### Task 2: Move export actions into the preview rail

**Files:**
- Modify: `components/resume-studio.tsx`

- [ ] **Step 1: Remove the left-column export block**

Delete the current `Export` section from the left editor stack.

- [ ] **Step 2: Add a preview rail footer**

Render a footer/actions area in the right preview rail that contains:
- `导出 HTML`
- `打印 PDF`

Only show these actions when a workspace exists.

- [ ] **Step 3: Demote JSON backup**

Remove `备份 JSON 草稿` from the visible primary editor path.
Keep the handler intact so the capability can be surfaced later from a secondary affordance.

### Task 3: Make the right preview column sticky and balanced

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Introduce a sticky rail container**

Add desktop-only layout rules so the right column:
- stays aligned to the top of the viewport
- uses `position: sticky`
- preserves enough height for preview + export actions

- [ ] **Step 2: Balance desktop column proportions**

Adjust the two-column grid so the preview rail feels intentionally sized rather than like a short side card.

- [ ] **Step 3: Keep mobile behavior safe**

Ensure the sticky behavior is disabled or neutralized for the existing mobile panel toggle layout.

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
