# AI Template Manifest Design

**Date:** 2026-03-27

**Goal:** Evolve the product from a single hard-coded resume template into a controlled multi-template system where AI generates template manifests, while content collection stays standardized and optimized for Chinese campus recruiting.

## Problem

The current product is structurally limited:

- It has one render path bound to `flagship`, so template diversity does not exist.
- Guided intake is a fixed 7-question flow and cannot stop early, adapt, or follow up based on missing evidence.
- Content facts, layout state, and template-specific rendering are stored together, which makes template evolution expensive.
- AI currently helps with question copy and experience rewriting, but it does not participate in controlled template selection.

If more users share the same template, the output loses differentiation and the perceived value of the product drops.

## Approved Direction

The user approved the following product direction:

- AI should not generate a full template from zero.
- AI should generate a constrained `TemplateManifest` by selecting from approved layout skills, section variants, and style tokens.
- Resume content should be normalized into a stable schema independent from template choice.
- The product should keep focusing on Chinese campus recruiting / new graduate resumes in v1.
- Intake should become a semi-structured interview flow: extract what is available, ask only for missing high-signal facts, generate a draft early, then follow up based on weak sections.
- The first release should use a hybrid approach:
  - fixed content schema
  - controlled component library
  - a small set of baseline templates
  - runtime AI-generated manifest variants for users to choose from

## Design Summary

The system should be split into three layers:

1. `ResumeContentDocument`
   Stable factual content extracted from paste input or interview answers.

2. `TemplateManifest` / `TemplateSession`
   Chosen template recipe, candidate manifests, and user selection state.

3. `RenderState`
   Derived layout state such as density, hidden modules, selected compact variants, overflow status, and export readiness.

This separation allows template growth without rewriting intake, and intake changes without rewriting rendering.

## Content Model

Introduce a stable content schema for v1 campus recruiting resumes.

### Required top-level sections

- `profile`
  - full name
  - target role
  - phone
  - email
  - location
  - summary
  - photo
  - website / portfolio link
- `education[]`
  - school
  - degree / major
  - date range
  - optional highlights
- `experiences[]`
  - unified list with `kind` to distinguish `internship`, `project`, or `campus`
  - organization
  - role
  - date range
  - bullets / evidence
  - metrics
  - tags
- `awards[]`
- `skills[]`
- `meta`
  - language
  - target audience
  - completeness
  - evidence strength

### Explicit non-goals for the content model

- No user-defined arbitrary sections in v1.
- No template-specific fields inside the content document.
- No persistent layout state such as `density`, `selectedVariants`, or `hiddenExperienceIds` inside factual content.

## Template Manifest Contract

AI output must be constrained to a schema-validated manifest. It must not generate React, HTML, or CSS directly.

### Allowed manifest responsibilities

- choose layout tone
- choose approved theme tokens
- choose section order from allowed sections
- choose approved section component variants
- choose compaction policy priorities

### Disallowed manifest responsibilities

- invent new components
- inject arbitrary CSS
- define freeform page geometry outside tokens
- rewrite or infer content facts
- bypass A4 / export constraints

### v1 manifest shape

```ts
type TemplateManifest = {
  version: "v1";
  templateId: string;
  name: string;
  tone: "calm" | "confident" | "academic" | "modern";
  page: {
    size: "A4";
    marginPreset: "tight" | "balanced" | "airy";
    layout: "single-column";
  };
  theme: {
    fontPair: "serif-sans" | "humanist-sans" | "songti-sans";
    accentColor: "ink" | "navy" | "forest" | "burgundy";
    dividerStyle: "line" | "bar" | "soft";
  };
  sectionOrder: Array<"education" | "experience" | "awards" | "skills">;
  sections: {
    hero: { variant: "classic-banner" | "name-left-photo-right" | "centered-name-minimal" };
    education: { variant: "compact-rows" | "highlight-strip" };
    experience: { variant: "stacked-bullets" | "metric-first" | "compact-cards" };
    awards: { variant: "two-column-table" | "inline-list" };
    skills: { variant: "inline-tags" | "grouped-chips" };
  };
  compactionPolicy: {
    density: "airy" | "balanced" | "tight";
    overflowPriority: Array<"awards" | "skills" | "experience">;
  };
};
```

All manifest fields must be validated with `zod` before rendering.

## Template Component Library

v1 should use fixed slots with a small approved component set.

### Slots

- `hero`
- `education`
- `experience`
- `awards`
- `skills`

### Initial approved variants

- `hero`
  - `classic-banner`
  - `name-left-photo-right`
  - `centered-name-minimal`
- `education`
  - `compact-rows`
  - `highlight-strip`
- `experience`
  - `stacked-bullets`
  - `metric-first`
  - `compact-cards`
- `awards`
  - `two-column-table`
  - `inline-list`
- `skills`
  - `inline-tags`
  - `grouped-chips`

### v1 constraints

- Single-column only.
- A4 only.
- No arbitrary decorative blocks.
- No custom typography outside approved font pairs.
- No arbitrary color values outside approved tokens.

This is intentionally narrow. The goal is meaningful variation without losing render stability.

## Semi-Structured Interview Flow

Replace the fixed question-index model with a state-driven interview flow.

### Stage 1: Import

- User enters from `guided` or `paste`.
- System extracts as much content as possible into `ResumeContentDocument`.
- Missing fields are recorded as schema gaps, not as form errors.

### Stage 2: Core follow-up

- Ask only for the minimum information required to produce a credible first draft.
- Focus on high-signal fields:
  - target role
  - education skeleton
  - one or two strongest experiences
  - contact information
- Stop when minimum draft completeness is met.

### Stage 3: Early draft

- Generate the first content draft as soon as minimum completeness is met.
- Produce three template candidates at this stage.
- Let the user see outcome early rather than forcing full interview completion.

### Stage 4: Strengthening follow-up

- After draft creation, ask targeted follow-up questions based on weak sections.
- Examples:
  - ask for metrics if an experience lacks quantified outcomes
  - ask for GPA / rank / CET scores if the education block looks sparse
  - ask for specific tools or methods if skills are generic

The goal of the flow is not “finish all questions.” The goal is “collect enough facts to draft early, then improve weak areas.”

## AI Responsibilities

Split AI capabilities into separate bounded services.

### `content-extract`

- input: paste text or freeform user answer
- output: partial `ResumeContentDocument` patch

### `interview-next`

- input: current content document + completeness / evidence summary
- output:
  - next question
  - why this question matters
  - optional suggestion for what a strong answer looks like

### `template-generate`

- input: content document + target role + optional style preference
- output: three candidate `TemplateManifest` objects

### `rewrite-experience`

- keep current responsibility
- improve bullet quality without changing facts

These capabilities should not share a generic “AI turn” interface.

## Rendering and Session Model

Current `WorkspaceData` should be decomposed.

### New state boundaries

- `ResumeContentDocument`
  - persistent factual content
- `TemplateSession`
  - candidate manifests
  - selected template id
  - optional user locks on template-related choices
- `RenderState`
  - derived density
  - selected compact variants
  - hidden modules
  - overflow status
  - export readiness

### Rendering rule

Preview and export must use the same renderer:

- input: `ResumeContentDocument + selected TemplateManifest + RenderState`
- output: preview DOM or export HTML

This replaces the current direct `flagship` render path.

## Fallback and Safety Rules

AI-generated template candidates must go through strict validation and graceful fallback.

### Candidate pipeline

1. Generate manifest candidates.
2. Validate schema with `zod`.
3. Reject any non-whitelisted component, token, or layout value.
4. Pre-render each candidate.
5. Run one-page validation.
6. Reject or compact candidates that fail.
7. Fill missing slots with baseline templates if needed.

### Required fallback behavior

- If AI output is invalid: discard it and use baseline template.
- If AI output is valid but too similar to another candidate: deduplicate and replace with baseline template.
- If AI output is valid but cannot stay within one page after compaction: discard it.
- If all AI candidates fail: return baseline templates only.
- If AI is unavailable: the user must still complete the end-to-end resume flow.

## Engineering Changes

The existing code should evolve in-place rather than be rewritten wholesale.

### Primary refactors

- `lib/types.ts`
  - split factual content, template session, and render state
- `lib/flagship-template.ts`
  - convert from single hard-coded template into:
    - one baseline manifest
    - section render helpers
    - shared HTML render utilities
- `components/resume-preview.tsx`
  - render from selected manifest instead of directly rendering `flagship`
- `lib/export.ts`
  - export based on selected manifest, not a hard-coded template function
- `lib/layout-plan.ts`
  - become manifest-aware
- `components/resume-studio.tsx`
  - replace fixed question progression with extraction + follow-up + early draft
- `app/api/ai/intake-turn/route.ts`
  - replace with clearer bounded AI endpoints over time

### Storage changes

Persist separate payloads:

- `contentDocument`
- `templateSession`
- `editorPreferences`

Do not persist the whole mixed workspace shape as the primary contract.

## Constraints

- v1 remains optimized for Chinese campus recruiting / new graduates.
- v1 supports fixed core sections only.
- v1 template generation is manifest-based, not code generation.
- v1 stays within A4 single-page export constraints.
- Existing no-AI and fallback behavior must remain usable.

## Success Criteria

- User can reach a first draft from `guided` or `paste` within roughly 3 minutes.
- System returns three visually distinct template candidates, not just color swaps.
- Template switching never changes content facts.
- All candidate templates that reach the UI can preview and export within one A4 page.
- AI failure never blocks draft creation or export.
- Post-draft follow-up questions improve weak sections without forcing the user back into a fixed questionnaire.

## Test Scenarios

- Sparse input: name, school, one weak experience.
- Dense input: multiple experiences, awards, education highlights, photo.
- Guided-first then template-select flow.
- Template-select then content-strengthen flow.
- Invalid manifest from AI.
- Duplicate manifest candidates from AI.
- Overfull manifest candidate that cannot fit after compaction.
- AI unavailable for template generation.
- Preview/export consistency for every approved template variant.

## Implementation Order

1. Split data model into content, template session, and render state.
2. Introduce manifest-aware renderer while keeping a single baseline template working.
3. Replace fixed guided questions with extraction + adaptive follow-up + early draft.
4. Add manifest generation, validation, fallback, and template selection UI.

This order minimizes risk by stabilizing interfaces before placing AI-generated template candidates on the main path.
