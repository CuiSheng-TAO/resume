# AI Template Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single-template workspace with a normalized content model, manifest-driven template rendering, adaptive intake flow, and safe AI-generated template candidates for campus-recruiting resumes.

**Architecture:** Split the current mixed `WorkspaceData` model into factual content, template session state, and derived render state. Keep preview/export on one shared renderer, then layer adaptive intake and AI manifest generation on top of that stable contract. Preserve fallback behavior at every stage so draft creation and export remain available when AI is missing or invalid.

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, Vitest, Testing Library, IndexedDB

---

### Files and responsibilities

- Create: `lib/resume-document.ts`
  Define `ResumeContentDocument`, `TemplateManifest`, `TemplateSession`, `RenderState`, schema helpers, and migration/normalization utilities.
- Create: `lib/template-manifest.ts`
  Hold `zod` schemas, baseline manifests, manifest dedupe helpers, and candidate validation.
- Create: `lib/template-renderer.ts`
  Centralize section-slot rendering for preview and export from `ResumeContentDocument + TemplateManifest + RenderState`.
- Create: `lib/intake-engine.ts`
  Implement extractable intake state, completeness rules, stage transitions, and next-question planning helpers.
- Create: `app/api/ai/extract-content/route.ts`
  Accept freeform content and return `ResumeContentDocument` patches with fallback extraction.
- Create: `app/api/ai/interview-next/route.ts`
  Accept current content state and return the next adaptive interview question with fallback logic.
- Create: `app/api/ai/generate-templates/route.ts`
  Accept content document + role context and return validated manifest candidates with fallback to baseline manifests.
- Modify: `lib/types.ts`
  Reduce legacy overlap and either re-export or bridge to the new normalized document types during migration.
- Modify: `lib/intake.ts`
  Build normalized content documents and initial template/render session state instead of a single mixed workspace.
- Modify: `lib/layout-plan.ts`
  Make balancing manifest-aware and derive `RenderState` from the selected template instead of hard-coded flagship assumptions.
- Modify: `lib/layout-advice.ts`
  Read/write the new render state shape and keep overflow advice aligned with manifest-aware compaction.
- Modify: `lib/export.ts`
  Export HTML/PDF from the shared template renderer and selected manifest instead of hard-coded flagship rendering.
- Modify: `lib/storage.ts`
  Persist `contentDocument`, `templateSession`, and editor preferences separately, with a migration path for existing stored workspace payloads.
- Modify: `lib/ai-prompts.ts`
  Add bounded prompts for content extraction, interview planning, and template manifest generation.
- Modify: `lib/ai-fallback.ts`
  Add non-AI fallbacks for content extraction, adaptive next-question planning, and baseline template candidate generation.
- Modify: `app/api/ai/intake-turn/route.ts`
  Either thin it into a compatibility shim over `interview-next` or retire it in favor of the new routes while preserving existing callers during migration.
- Modify: `components/resume-preview.tsx`
  Render via the shared template renderer and selected manifest.
- Modify: `components/resume-studio.tsx`
  Replace fixed seven-question progression with adaptive intake stages, early draft generation, and template candidate selection.
- Modify: `app/globals.css`
  Add stable class coverage for the approved slot variants and remove direct reliance on one flagship-only stylesheet path where necessary.
- Modify: `lib/flagship-template.ts`
  Convert the existing flagship template into one baseline manifest and renderer configuration rather than the only render implementation.
- Test: `tests/intake.test.ts`
  Cover normalized draft creation and migration from guided/paste entry into the new document model.
- Test: `tests/layout-plan.test.ts`
  Cover manifest-aware compaction and one-page balancing rules.
- Test: `tests/layout-advice.test.ts`
  Cover advice generation against render state derived from manifests.
- Test: `tests/resume-preview.test.tsx`
  Cover manifest-driven preview rendering and template switching.
- Test: `tests/export.test.ts`
  Cover shared preview/export rendering and baseline fallback manifests.
- Test: `tests/resume-studio.test.tsx`
  Cover adaptive intake, early draft stop conditions, and template candidate selection.
- Test: `tests/ai-routes.test.ts`
  Cover extraction, adaptive interview, template generation, and fallback behavior.
- Test: `tests/storage.test.ts`
  Cover persistence and restoration of split content/session state.
- Test: `tests/template-manifest.test.ts`
  Cover schema validation, whitelist enforcement, dedupe, and baseline fallback replacement.

### Task 1: Split the data model without breaking current draft creation

**Files:**
- Create: `lib/resume-document.ts`
- Modify: `lib/types.ts`
- Modify: `lib/intake.ts`
- Modify: `lib/storage.ts`
- Test: `tests/intake.test.ts`
- Test: `tests/storage.test.ts`

- [ ] Add failing tests that describe the new persisted shape:
  - guided intake returns a normalized `contentDocument`
  - paste intake returns a normalized `contentDocument`
  - storage restores `contentDocument` and `templateSession` separately
  - legacy stored workspace payloads still load through a migration adapter
- [ ] Introduce `ResumeContentDocument`, `TemplateSession`, and `RenderState` in `lib/resume-document.ts`, then re-export or bridge them from `lib/types.ts` so migration can be incremental.
- [ ] Add normalization helpers:
  - create baseline content document from guided answers
  - create baseline content document from pasted text
  - derive initial `TemplateSession` from baseline manifest ids
  - derive initial `RenderState` with default density and no hidden modules
- [ ] Update `lib/intake.ts` to return the new normalized shape while preserving current content semantics for education, experiences, awards, and skills.
- [ ] Update `lib/storage.ts` to persist split state and migrate previously saved `WorkspaceData` payloads into the new shape on read.
- [ ] Run:
  - `npm run test -- tests/intake.test.ts tests/storage.test.ts`

### Task 2: Replace the single flagship path with a manifest-driven renderer

**Files:**
- Create: `lib/template-manifest.ts`
- Create: `lib/template-renderer.ts`
- Modify: `lib/flagship-template.ts`
- Modify: `components/resume-preview.tsx`
- Modify: `lib/export.ts`
- Modify: `app/globals.css`
- Test: `tests/template-manifest.test.ts`
- Test: `tests/resume-preview.test.tsx`
- Test: `tests/export.test.ts`

- [ ] Add failing tests that lock the v1 manifest contract:
  - only approved slot variants pass validation
  - invalid colors/fonts/layouts are rejected
  - the former flagship layout is still available as a baseline manifest
  - preview and export read from the same shared renderer path
- [ ] Implement `zod` schemas and baseline manifests in `lib/template-manifest.ts`.
- [ ] Convert `lib/flagship-template.ts` from “the renderer” into one baseline manifest plus any mapping helpers that are still specific to that baseline design.
- [ ] Implement `lib/template-renderer.ts` with slot renderers for:
  - `hero`
  - `education`
  - `experience`
  - `awards`
  - `skills`
- [ ] Update `components/resume-preview.tsx` to select the active manifest from `TemplateSession` and render through `template-renderer`.
- [ ] Update `lib/export.ts` so HTML export and PDF print both use the same renderer entrypoint as preview.
- [ ] Add or reorganize CSS tokens/classes in `app/globals.css` so the approved variants can render without relying on hard-coded flagship-only selectors.
- [ ] Run:
  - `npm run test -- tests/template-manifest.test.ts tests/resume-preview.test.tsx tests/export.test.ts`

### Task 3: Make layout balancing and editing manifest-aware

**Files:**
- Modify: `lib/layout-plan.ts`
- Modify: `lib/layout-advice.ts`
- Modify: `components/resume-studio.tsx`
- Test: `tests/layout-plan.test.ts`
- Test: `tests/layout-advice.test.ts`
- Test: `tests/resume-studio.test.tsx`

- [ ] Add failing tests that prove balancing depends on the selected manifest rather than one hard-coded template budget.
- [ ] Move compaction inputs in `lib/layout-plan.ts` from flagship assumptions to manifest-driven page/layout rules:
  - density preset
  - visible section order
  - section-specific compaction priorities
- [ ] Update `RenderState` derivation so selected variants, hidden sections, and overflow status are computed against the selected manifest.
- [ ] Update `lib/layout-advice.ts` so suggestions read the new render state shape and remain stable when users switch templates mid-edit.
- [ ] Update editing flows in `components/resume-studio.tsx` so content edits invalidate and recompute render state without mutating factual content.
- [ ] Run:
  - `npm run test -- tests/layout-plan.test.ts tests/layout-advice.test.ts tests/resume-studio.test.tsx`

### Task 4: Replace the fixed 7-question intake with adaptive intake and early draft creation

**Files:**
- Create: `lib/intake-engine.ts`
- Modify: `components/resume-studio.tsx`
- Modify: `lib/ai-prompts.ts`
- Modify: `lib/ai-fallback.ts`
- Modify: `app/api/ai/intake-turn/route.ts`
- Create: `app/api/ai/extract-content/route.ts`
- Create: `app/api/ai/interview-next/route.ts`
- Test: `tests/resume-studio.test.tsx`
- Test: `tests/ai-routes.test.ts`
- Test: `tests/intake.test.ts`

- [ ] Add failing tests that lock the new product flow:
  - pasted text is extracted into content fields before follow-up starts
  - guided intake stops once minimum completeness is met instead of always asking seven fixed questions
  - the first draft appears as soon as minimum completeness is satisfied
  - post-draft follow-up targets weak sections such as missing metrics or weak skills
- [ ] Implement `lib/intake-engine.ts` with:
  - completeness scoring
  - evidence scoring
  - stage transitions: import, core-follow-up, early-draft, strengthening-follow-up
  - “next question” selection helpers
- [ ] Add extraction and adaptive interview prompts/fallbacks in `lib/ai-prompts.ts` and `lib/ai-fallback.ts`.
- [ ] Create `app/api/ai/extract-content/route.ts` and `app/api/ai/interview-next/route.ts` with the same fallback/rate-limit style already used by existing AI routes.
- [ ] Convert `app/api/ai/intake-turn/route.ts` into a compatibility wrapper or remove its callers after `ResumeStudio` has been updated.
- [ ] Update `components/resume-studio.tsx` to:
  - keep `guided` and `paste` entry modes
  - run extraction first
  - ask one adaptive question at a time
  - stop early when minimum draft completeness is reached
  - allow strengthening follow-up after the draft exists
- [ ] Run:
  - `npm run test -- tests/intake.test.ts tests/ai-routes.test.ts tests/resume-studio.test.tsx`

### Task 5: Add AI-generated template candidates with strict validation and fallback

**Files:**
- Create: `app/api/ai/generate-templates/route.ts`
- Modify: `lib/template-manifest.ts`
- Modify: `lib/ai-prompts.ts`
- Modify: `lib/ai-fallback.ts`
- Modify: `components/resume-studio.tsx`
- Modify: `tests/template-manifest.test.ts`
- Modify: `tests/ai-routes.test.ts`
- Modify: `tests/resume-studio.test.tsx`

- [ ] Add failing tests for candidate generation:
  - route returns three template candidates
  - invalid manifests are rejected and replaced with baseline manifests
  - duplicate manifests are deduped and replaced
  - template switching changes presentation but not content facts
  - AI-unavailable mode still returns baseline choices
- [ ] Implement manifest signature/dedupe helpers and fallback replacement rules in `lib/template-manifest.ts`.
- [ ] Add prompt and fallback support for `template-generate`.
- [ ] Create `app/api/ai/generate-templates/route.ts` that:
  - requests candidate manifests
  - validates them
  - dedupes them
  - pre-renders candidates if needed
  - replaces failed candidates with baseline manifests
- [ ] Update `components/resume-studio.tsx` to show three candidate templates immediately after early draft creation and allow safe switching during editing.
- [ ] Ensure switching templates only updates `TemplateSession` and derived `RenderState`, never `ResumeContentDocument`.
- [ ] Run:
  - `npm run test -- tests/template-manifest.test.ts tests/ai-routes.test.ts tests/resume-studio.test.tsx`

### Task 6: Full verification and release safety

**Files:**
- Modify: `tests/*` files touched above
- Review: `app/api/ai/*`, `components/*`, `lib/*`

- [ ] Run the targeted test commands from Tasks 1-5 again after any final refactor cleanup.
- [ ] Run the full test suite:
  - `npm run test`
- [ ] Run lint:
  - `npm run lint`
- [ ] Run production build:
  - `npm run build`
- [ ] Manually verify in `npm run dev`:
  - guided entry reaches early draft without forced seven-question completion
  - paste entry extracts content and can still reach export without AI
  - three template candidates appear after draft generation
  - template switching preserves content facts
  - preview and export stay aligned for at least one sparse and one dense sample
- [ ] Document any temporary compatibility shim left around `app/api/ai/intake-turn/route.ts` and remove it in a follow-up if no longer needed.

### Notes

- This workspace is not currently inside a git repository, so commit steps are intentionally omitted. If the project is moved back into a repo before implementation, commit after each task boundary.
- Do not execute Tasks 4 and 5 in parallel until Task 1 and Task 2 have landed, because both depend on the normalized document/session interfaces and the shared renderer contract.
