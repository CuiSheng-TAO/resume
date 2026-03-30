# Sticky Preview Rail Design

**Date:** 2026-03-27

**Goal:** Make the desktop editor feel balanced and premium by turning the right side into a true sticky preview rail, moving primary export actions into that rail, and demoting JSON backup from the main path.

## Problem

The current desktop editor feels visually unbalanced:

- The left editing column grows very long as users add more sections.
- The right preview area feels too short and secondary, even though “see the resume become real while editing” is a core value proposition.
- `备份 JSON 草稿` appears as a primary on-screen action even though it is a recovery affordance, not a core task.

## Approved Direction

The user approved:

- Use a `sticky` right-side preview rail on desktop.
- Move `导出 HTML` and `打印 PDF` into the right rail.
- Remove `备份 JSON 草稿` from the main path.

## UX Changes

### Layout

- Keep the desktop two-column workspace.
- Left column remains the long-form editing surface.
- Right column becomes a sticky rail that stays visible while the user scrolls the editor.

### Right Rail

The right rail should contain:

1. A lightweight preview header
2. A short human-readable preview summary
3. The A4 resume preview itself
4. A compact export action area

### Export Actions

- Show `导出 HTML` and `打印 PDF` in the right rail below the preview.
- Hide `备份 JSON 草稿` from the visible main UI.
- Keep JSON export available as an internal recovery affordance only; do not remove the underlying capability.

## Constraints

- Do not redesign the whole editor.
- Do not change mobile behavior beyond keeping it functional.
- Do not add new product concepts in this iteration.
- Keep preview and export reading the same data model.

## Implementation Notes

- Desktop only: the sticky behavior should apply at larger breakpoints.
- If viewport height is limited, the right rail should scroll internally rather than creating awkward whole-page imbalance.
- Existing tests around the editor flow should remain valid.

## Success Criteria

- The right preview remains visible while scrolling the left editor on desktop.
- Export actions are visually associated with the preview, not the long left form.
- JSON backup is no longer a primary visible action in the editor.
- The page feels more balanced without introducing a new task panel or modal flow.
