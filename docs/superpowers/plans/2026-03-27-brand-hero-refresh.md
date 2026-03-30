# Brand Hero Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the landing hero around `Siamese Dream` as the product name and `人人都有美观简历` as the supporting right-side slogan.

**Architecture:** Keep the existing hero container and layout, but replace the current title hierarchy with a brand-first structure and lighter supporting copy. Update page metadata so the browser title matches the visible product name.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS, Vitest, Testing Library

---

### Task 1: Lock the new hero language in tests

**Files:**
- Modify: `tests/resume-studio.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a landing-state assertion that checks:
- `Siamese Dream` is visible as the main hero name
- `人人都有美观简历` is still visible
- `HR Companion Resume Studio` is no longer visible in the hero

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/resume-studio.test.tsx`
Expected: FAIL because the hero still uses the old generic label and Chinese slogan as the main title

### Task 2: Update hero markup and metadata

**Files:**
- Modify: `components/resume-studio.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace hero title hierarchy**

Make `Siamese Dream` the main hero headline and move `人人都有美观简历` into the right-side supporting area.

- [ ] **Step 2: Update metadata**

Change the page title to `Siamese Dream`.

### Task 3: Refine hero styling

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Adjust typography and spacing**

Tune the hero layout so the brand name leads and the supporting right-side line feels elegant rather than promotional.

- [ ] **Step 2: Keep mobile safe**

Ensure the new hierarchy still reads well when the hero stacks on smaller screens.

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
