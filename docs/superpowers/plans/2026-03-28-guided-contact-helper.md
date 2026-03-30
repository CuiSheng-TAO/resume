# Guided Contact Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep contact-format guidance visible while the user types the guided contact answer so they do not lose track of the expected line order.

**Architecture:** Extend the guided question metadata for the contact step with persistent helper content, then render that helper under the textarea without changing the underlying parsing flow. Add a focused UI regression test first, then implement the minimal view/state logic needed to keep the helper visible and reflect which fields are still missing.

**Tech Stack:** React 19, Next.js 16, Vitest, Testing Library

---

### Task 1: Add a focused guided-contact regression test

**Files:**
- Modify: `tests/resume-studio.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a test that enters the guided flow, advances to the contact question, types a phone number, and asserts that the persistent contact helper content is still visible.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/resume-studio.test.tsx`
Expected: FAIL because the contact helper content is not rendered once typing begins.

### Task 2: Render persistent helper content for the guided contact question

**Files:**
- Modify: `components/resume-studio.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Add guided-question helper metadata**

Extend the guided question model so the contact step can define persistent helper lines and a lightweight completeness summary.

- [ ] **Step 2: Render the helper below the textarea**

Show three persistent line labels for phone, email, and location, plus a recognized/missing summary derived from the current draft value.

- [ ] **Step 3: Keep styling aligned with existing field helper patterns**

Use the existing helper visual language in `app/globals.css`, adding only the minimal classes needed for the contact helper block.

### Task 3: Verify the change end to end

**Files:**
- No file changes

- [ ] **Step 1: Run the focused guided test**

Run: `npm run test -- tests/resume-studio.test.tsx`
Expected: PASS

- [ ] **Step 2: Run the full verification suite**

Run:
- `npm run test`
- `npm run lint`
- `npm run build`

Expected:
- `16 passed` or higher test file count
- `eslint` exit code `0`
- `next build` exit code `0`
