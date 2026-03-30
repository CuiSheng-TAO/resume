# Resume Design Skill System Design

**Date:** 2026-03-30

**Goal:** Define a reusable design-skill system for campus-recruiting resumes so the product can grow from a narrow three-template picker into a high-quality template family library where beauty is the primary value, AI only handles matching and light tuning, and every shipped template is held to an explicit visual quality bar.

## Problem

The current template system has three structural limits:

- The visual space is too narrow. Even when AI is enabled, the user usually sees near-variants of the same three baseline templates.
- Template differences are mostly constrained to a small manifest surface, so visible variety is weak and the product does not yet feel like “many beautiful resumes.”
- Beauty is not yet modeled as a first-class system. The product has rendering rules and export rules, but it does not have an explicit design-skill framework for what makes a resume look good, readable, premium, and safe to print.

This creates a product gap:

- the user wants a large set of genuinely attractive resume styles
- the system currently behaves more like “AI chooses among a few controlled layouts”

## Approved Direction

The user approved the following direction:

- Beauty is the core value of the resume product.
- The product should prioritize a high-quality template family library over open-ended AI template invention.
- The first release should focus on campus-recruiting / student resumes, not multi-year professional resumes.
- The first batch should be weighted toward safe, broadly usable templates:
  - roughly 80% stable / professional
  - roughly 20% higher-design but still printable and credible
- The first template batch should be “campus general,” not split first by profession.
- The template system should be built in two layers:
  - universal beauty skills
  - style skills
- The file at [system.md](/Users/wepie/Desktop/.interface-design/system.md) should be treated as a valid aesthetic reference, especially for the “warm professional” family.
- A `skill-creator` pass is required, but only as a structure / reusability review. It does not replace human aesthetic judgment.

## Design Summary

The next version of the template system should be organized around three layers:

1. **Design Skill System**
   A documented set of reusable visual rules for what makes a resume beautiful, readable, and printable.

2. **Template Family Library**
   A curated inventory of hand-designed template families and variants built from those skills.

3. **AI Matching Layer**
   AI selects, ranks, and lightly tunes from the template library. It does not invent template aesthetics from scratch.

This changes the role of AI:

- from: “generate template-like outputs inside a narrow manifest”
- to: “choose the best candidates from a larger, high-quality visual inventory”

## Core Product Principle

The product should not optimize for “more combinations.”

It should optimize for:

- more beautiful templates
- more meaningful template differences
- more reliable one-page output
- better template-to-content fit

The system should therefore treat templates as design assets, not as arbitrary runtime permutations.

## Design Skill System

The design-skill system should have two layers:

1. **Universal Beauty Skills**
   The non-negotiable quality rules that every template must satisfy.

2. **Style Skills**
   The controlled visual personalities that differentiate template families.

### Why split the system this way

Without this split, the template library will drift into one of two bad states:

- many templates that differ only superficially
- very different templates that do not share a common quality floor

The system must therefore separate:

- **quality floor** → universal skills
- **visual character** → style skills

## Universal Beauty Skills

The first release should define 8 universal beauty skills.

### 1. Information Hierarchy

**Purpose:** Ensure the user’s identity, target role, and strongest selling point are visible in the first scan.

**Good behavior:**

- the name is always the strongest visual anchor
- the target role is consistently second-level
- contact details never compete with identity
- either education or experience establishes a clear first “value block” in the upper page area

**Failure mode:**

- everything looks equally important
- the page starts with weak information
- the upper half does not tell the reviewer why this person is worth reading

**Affected modules:**

- hero
- education
- experience
- top-of-page spacing

**Validation rule:**

- a first-time reviewer should understand “who this is / what they want / what looks strongest” within one fast scan

### 2. Page Rhythm

**Purpose:** Create visual breathing room and controlled pacing across the page.

**Good behavior:**

- section spacing follows a stable cadence
- similar elements use consistent vertical distance
- no part of the page feels suffocating or empty
- the eye has multiple natural stopping points

**Failure mode:**

- one section is cramped while another floats
- spacing feels accidental
- the page reads as a wall of information

**Affected modules:**

- all section containers
- title spacing
- bullet spacing
- gap and margin presets

**Validation rule:**

- the page should feel intentionally paced, not merely “fit on one page”

### 3. Heading System

**Purpose:** Keep the whole resume speaking one visual language.

**Good behavior:**

- name, role, section title, field label, and metadata belong to a coherent hierarchy
- heading style is consistent inside a family
- title emphasis is deliberate, not decorative

**Failure mode:**

- each section looks like it came from a different template
- headings overcompete with content
- title styling is unstable from one template to another

**Affected modules:**

- hero
- section headers
- metadata labels
- badge / chip patterns

**Validation rule:**

- every template can be described as using one heading grammar, not several mixed systems

### 4. Education Presentation

**Purpose:** Make education an asset in campus resumes, not just a mandatory row.

**Good behavior:**

- school, degree, and date are readable immediately
- GPA / ranking / certificates / recommendation signals have a dedicated visual home
- education can move upward naturally for education-strong users

**Failure mode:**

- education becomes a flat line item
- highlights are awkward add-ons
- education-strong users look no different from education-weak users

**Affected modules:**

- education layout variants
- highlight patterns
- title weight inside education blocks

**Validation rule:**

- a strong education block should feel meaningfully stronger, not merely longer

### 5. Experience Readability

**Purpose:** Make experiences easy to scan and easy to trust.

**Good behavior:**

- each experience has a clear reading entry point
- bullets are visually separated
- outcomes or important actions can surface quickly
- long text is structured, not dumped

**Failure mode:**

- experience reads like paragraph prose
- the user’s role and result are buried
- multiple bullets blur together

**Affected modules:**

- experience layout variants
- metadata rows
- bullet markers
- emphasis on metrics / outcomes

**Validation rule:**

- an experience should be scannable in seconds without losing the story

### 6. Information Compression

**Purpose:** Allow content-rich resumes to remain attractive under one-page pressure.

**Good behavior:**

- density can increase safely
- secondary information compresses before primary information
- the page remains structured even in tighter mode

**Failure mode:**

- compression destroys hierarchy
- text collapses into an indistinct block
- titles and spacing lose their role under pressure

**Affected modules:**

- density presets
- compaction policies
- bullet and section spacing
- skills / awards treatment

**Validation rule:**

- a tight page should still look designed, not merely squeezed

### 7. Print Safety

**Purpose:** Ensure the template survives export and printing without losing hierarchy.

**Good behavior:**

- contrast works in grayscale
- hierarchy does not depend on subtle effects alone
- section boundaries survive PDF output

**Failure mode:**

- the design only works on screen
- low-contrast details disappear in print
- soft visual effects carry too much structural responsibility

**Affected modules:**

- color tokens
- divider styles
- font weights
- badge and tag treatments

**Validation rule:**

- the printed result must preserve structure, not just text presence

### 8. Single-Page Balance

**Purpose:** Make a one-page resume feel compositionally complete.

**Good behavior:**

- the page is visually balanced top-to-bottom
- the upper and lower halves carry proportionate weight
- there is no obvious “empty page with content glued to the top” or “overloaded bottom”

**Failure mode:**

- the content technically fits but looks visually wrong
- the page is top-heavy, bottom-heavy, or structurally lopsided

**Affected modules:**

- global section order
- density
- measurement logic
- export readiness and preview states

**Validation rule:**

- page-fit status must account for visual balance, not only overflow math

## Style Skills

The first release should define 4 style skills. These do not replace universal quality rules. They sit on top of them.

### 1. Warm Professional

**Purpose:** Provide the main “safe but cared-for” campus template family.

**Reference base:** [system.md](/Users/wepie/Desktop/.interface-design/system.md)

**Visual intent:**

- warm but professional
- trusted, not cold
- tasteful, not flashy

**Design rules:**

- warm off-white / beige backgrounds instead of harsh white
- controlled blue-led primary accents
- human but restrained typography
- subtle borders and low-drama shadows
- broad suitability for most students

**Best used for:**

- default-safe campus templates
- education-first or experience-first standard layouts

### 2. Calm Academic

**Purpose:** Provide a more orderly, restrained, study-forward family.

**Visual intent:**

- calm
- rational
- structured
- serious without looking old

**Design rules:**

- lower emotional temperature
- stronger structural alignment
- clearer timeline / school / degree organization
- more neutral emphasis model

**Best used for:**

- education-strong candidates
- law / business / finance / consulting-adjacent campus aesthetics

### 3. Modern Clean

**Purpose:** Provide a lighter, more contemporary family that still feels employable.

**Visual intent:**

- clean
- current
- light
- efficient

**Design rules:**

- more open whitespace
- lighter hero treatment
- weaker separators but clearer information grouping
- cleaner skills and metadata presentation

**Best used for:**

- students who want a more modern feel without looking risky

### 4. Highlight Forward

**Purpose:** Provide a family that surfaces strong signals near the top of the page.

**Visual intent:**

- more assertive
- stronger top-half pull
- more obvious value communication

**Design rules:**

- strong upper-page anchor
- earlier surfacing of results, awards, or academic highlights
- higher local contrast around important information
- still printable and still credible

**Best used for:**

- candidates with clear quantified wins, strong honors, or standout signals

## Template Family Library

The first real library should be a curated family library, not a generic combinatoric set.

### First-batch target

- 4 families
- 14 templates total
- campus-general focus
- about 80% safe / professional
- about 20% more design-forward

### Family structure

1. **Warm Professional** — 4 templates
   - standard single-column
   - photo-light variant
   - education-forward variant
   - experience-forward variant

2. **Dense Efficient** — 4 templates
   - content-rich but readable
   - tight but structured
   - more aggressive compression behavior

3. **Highlight Forward** — 3 templates
   - upper-page emphasis
   - metric / award / education strengths surfaced

4. **Modern Clean** — 3 templates
   - lighter visual language
   - clearer whitespace personality

### Template difference rule

To avoid near-duplicate templates, every shipped template must differ on at least 3 major visual axes.

## Major Variation Axes

The first library should vary templates using 6 approved visual axes:

1. hero structure
2. education presentation
3. experience reading rhythm
4. skills presentation
5. heading and divider system
6. density and whitespace strategy

### Hard constraints for differentiation

- neighboring templates inside a family must not differ only by color or font
- no two families may share the exact same hero + experience presentation pair
- every template must have a clear “best for” sentence written in user language

This ensures the library grows in meaningful ways, not by cosmetic duplication.

## AI Responsibilities

AI should not be treated as the origin of aesthetic quality.

### AI should do:

- classify the resume content profile
- select the best 3 templates from the library
- lightly tune allowed parameters:
  - section order preference
  - density preference
  - highlight emphasis
  - content-forward vs education-forward bias

### AI should not do:

- invent brand-new aesthetic systems at runtime
- bypass template family constraints
- generate arbitrary code or unreviewed template structures
- determine the design language by itself

The product promise should become:

- **beauty comes from the design system**
- **matching comes from AI**

## Relationship to Existing Manifest System

The existing manifest system should remain, but its role should change.

### Current role

- defines a very small white-listed layout space
- behaves like a tiny template universe

### Future role

- becomes the delivery contract for a much larger curated template library
- continues to enforce print safety and render stability
- stops pretending to be the source of design variety

In other words:

- the manifest remains the transport format
- the design skill system becomes the aesthetic source of truth

## Skill-Creator Review Plan

The user requested that this system pass through the `skill-creator` lens.

### What `skill-creator` can validate well

- skill boundaries
- clarity of triggering language
- reusable structure
- the right degree of freedom
- what should live in documentation vs references vs assets

### What `skill-creator` cannot validate

- whether a template is actually beautiful
- whether a visual family feels premium
- whether differences are aesthetically meaningful

### Approved review model

1. Treat the 12 skills first as an internal project design system.
2. Review them using `skill-creator` as a structure and reuse audit.
3. Upgrade only the most stable, reusable skills into actual Codex skills.

### Likely first candidates for true skill promotion

- Information Hierarchy
- Information Compression
- Print Safety
- Warm Professional

These are the most rule-like, reusable, and least dependent on project-specific implementation details.

## Deliverables From This Design

This design should produce four concrete artifacts:

1. an internal “resume design skill system” document
2. a mapping table from 12 skills to 14 template variants
3. a template family backlog ordered by implementation priority
4. a later `skill-creator` review appendix that decides which skills graduate into actual Codex skills

## Non-Goals

This design explicitly does not do the following yet:

- define the full visual spec of all 14 templates
- generate mockups for every template in this document
- rewrite the manifest schema immediately
- implement the expanded template family library
- convert all 12 design skills into Codex skills now

Those belong to the next planning and implementation phases.

## Acceptance Criteria

This design should be considered valid only if later implementation can satisfy the following:

- the user can eventually see substantially more than the current 3 repeated template impressions
- the first shipped library contains multiple families with clearly distinct visual personalities
- every shipped template passes the 8 universal beauty skills
- AI chooses from a real library rather than mostly resurfacing baseline templates
- the product can explain why a template is a fit for a given resume
- print / export quality remains stable

## Recommended Next Step

Use this design to write an implementation plan for:

1. the internal design-skill document
2. the first 14-template family matrix
3. the priority order for building template families
4. the later `skill-creator` review pass
