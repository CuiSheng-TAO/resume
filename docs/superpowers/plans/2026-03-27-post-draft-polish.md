# Post-Draft Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the post-draft experience feel like a real product by replacing raw internal status chips with readable copy, adding a visible `先 3 步 / 再 3 步` refinement flow, and supporting resume-sample-style education highlights.

**Architecture:** Keep the current flagship resume structure, but move product meaning into explicit UI helpers and checklist state. Extend education highlights as optional structured data that renders into the existing `edu-sub` line so preview and export stay aligned.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library

---

### Files and responsibilities

- Modify: `components/resume-studio.tsx`
  Add human-readable preview status copy, introduce refinement checklist UI/state, and expose editable education highlight fields.
- Modify: `lib/types.ts`
  Add lightweight workspace state for post-draft refinement progression.
- Modify: `lib/intake.ts`
  Seed default post-draft checklist state for guided and pasted drafts.
- Modify: `lib/flagship-template.ts`
  Reuse existing education highlight rendering, ensuring optional entries map cleanly to the sample-style line.
- Modify: `tests/resume-studio.test.tsx`
  Cover landing promise copy, post-draft checklist behavior, and education highlight editing.
- Modify: `tests/resume-preview.test.tsx`
  Cover human-readable preview badges/status and sample-style optional education highlights.
- Modify: `tests/export.test.ts`
  Cover exported sample-style education highlight line.

### Task 1: Lock the new product behavior in tests

- [ ] Add a failing test showing the landing promise mentions both first draft and follow-up refinement.
- [ ] Add a failing test showing the editor presents `先 3 步` tasks after the first draft.
- [ ] Add a failing test showing completing the first three refinement tasks reveals a `再 3 步` entry.
- [ ] Add a failing test showing education highlights like `英语六级：571分` render in preview/export when filled.

### Task 2: Implement the refinement flow and human-readable status

- [ ] Add minimal refinement-phase state to the workspace model and seed it in intake builders.
- [ ] Replace raw preview chips like `tight / dense / fits` with readable Chinese labels or summary sentences.
- [ ] Add a compact refinement checklist above the editor with `先 3 步` and expandable `再 3 步`.

### Task 3: Implement optional education highlights in sample format

- [ ] Add structured optional education highlight inputs for the first education entry.
- [ ] Keep them optional and omit empty values.
- [ ] Ensure preview/export continue sharing the same `edu-sub` rendering path.

### Task 4: Verify and stabilize

- [ ] Run targeted tests for the changed behavior.
- [ ] Run the full test suite.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
