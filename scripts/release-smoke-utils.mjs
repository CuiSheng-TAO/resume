export const RELEASE_SMOKE_STEP_IDS = [
  "guided-entry",
  "paste-entry",
  "starter-template-cards",
  "template-switch-updates-preview",
  "strengthening-collapses-templates",
  "second-education-refreshes-templates",
];

export const STARTER_TEMPLATE_CARD_COUNT = 3;

export const isServerReadyStatus = (statusCode) => statusCode >= 200 && statusCode < 400;

export const extractResumeTemplateClass = (className) => {
  if (!className) {
    return null;
  }

  return className
    .split(/\s+/)
    .find((token) => token.startsWith("resume-template--")) ?? null;
};
