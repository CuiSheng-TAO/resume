type AnalyticsPayload = Record<string, unknown>;

const BLOCKED_KEYS = new Set([
  "body",
  "content",
  "email",
  "fullName",
  "name",
  "narrative",
  "phone",
  "raw",
  "rawNarrative",
  "summary",
]);

export type AnalyticsEvent = {
  name: string;
  timestamp: string;
  payload: AnalyticsPayload;
};

export const sanitizeAnalyticsPayload = (payload: AnalyticsPayload): AnalyticsPayload =>
  Object.fromEntries(
    Object.entries(payload).filter(([key]) => !BLOCKED_KEYS.has(key)),
  );

export const createAnalyticsEvent = (
  name: string,
  payload: AnalyticsPayload = {},
): AnalyticsEvent => ({
  name,
  timestamp: new Date().toISOString(),
  payload: sanitizeAnalyticsPayload(payload),
});
