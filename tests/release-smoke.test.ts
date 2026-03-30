import { describe, expect, it } from "vitest";

import {
  RELEASE_SMOKE_STEP_IDS,
  STARTER_TEMPLATE_CARD_COUNT,
  extractResumeTemplateClass,
  isServerReadyStatus,
} from "../scripts/release-smoke-utils.mjs";

describe("release smoke helpers", () => {
  it("defines the six required release smoke checkpoints", () => {
    expect(RELEASE_SMOKE_STEP_IDS).toEqual([
      "guided-entry",
      "paste-entry",
      "starter-template-cards",
      "template-switch-updates-preview",
      "strengthening-collapses-templates",
      "second-education-refreshes-templates",
    ]);
    expect(STARTER_TEMPLATE_CARD_COUNT).toBe(3);
  });

  it("extracts the active resume template class from preview markup", () => {
    expect(
      extractResumeTemplateClass(
        "resume-sheet resume-theme--navy resume-template--warm-profile-card flagship-page",
      ),
    ).toBe("resume-template--warm-profile-card");
    expect(extractResumeTemplateClass("resume-sheet resume-theme--navy")).toBeNull();
    expect(extractResumeTemplateClass(null)).toBeNull();
  });

  it("treats 2xx and 3xx responses as a ready local app", () => {
    expect(isServerReadyStatus(200)).toBe(true);
    expect(isServerReadyStatus(307)).toBe(true);
    expect(isServerReadyStatus(404)).toBe(false);
  });
});
