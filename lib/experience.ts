import type { ExperienceVariantKey } from "@/lib/types";

export type ExperienceRewriteSuggestion = {
  suggestedBullets: string[];
  variants: Record<ExperienceVariantKey, string>;
  rationale?: string;
  followUpPrompt?: string;
};

const ensureSentenceEnding = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return /[。！？!?]$/.test(trimmed) ? trimmed : `${trimmed}。`;
};

export const normalizeExperienceBullets = (value: string | string[]) => {
  const lines = Array.isArray(value) ? value : value.split(/\n+/);

  return lines
    .map((item) => item.trim())
    .filter(Boolean);
};

const compactifyBullet = (value: string) =>
  value
    .replace(/支持/g, "推进")
    .replace(/持续跟进/g, "跟进")
    .replace(/招聘目标达成率/g, "达成率")
    .replace(/帮助/g, "")
    .replace(/\s+/g, "");

const prioritizeByMetrics = (bullets: string[]) => {
  const withMetrics = bullets.filter((b) => /\d/.test(b));
  const withoutMetrics = bullets.filter((b) => !/\d/.test(b));
  return [...withMetrics, ...withoutMetrics];
};

export const deriveExperienceVariants = (
  bullets: string[],
): Record<ExperienceVariantKey, string> => {
  const normalizedBullets = normalizeExperienceBullets(bullets);
  if (normalizedBullets.length === 0) {
    return { raw: "", star: "", standard: "", compact: "" };
  }

  const finalizedBullets = normalizedBullets.map((item) => ensureSentenceEnding(item));
  const metricsFirst = prioritizeByMetrics(finalizedBullets);

  // raw: all bullets, original order
  const raw = finalizedBullets.join("\n");

  // star: all bullets, metrics-bearing ones prioritized to top
  const star = metricsFirst.join("\n");

  // standard: up to 3 bullets, prefer metric-bearing
  const standard = metricsFirst.slice(0, Math.min(finalizedBullets.length, 3)).join("\n");

  // compact: up to 2 bullets, condensed wording
  const compact = metricsFirst
    .slice(0, Math.min(finalizedBullets.length, 2))
    .map((item) => compactifyBullet(item))
    .join("\n");

  return { raw, star, standard, compact };
};

export const extractExperienceMetrics = (bullets: string[]) =>
  normalizeExperienceBullets(bullets).join(" ").match(/\d+[^\s，。；]*/g) ?? [];

export const buildExperienceNarrative = (bullets: string[]) =>
  normalizeExperienceBullets(bullets).join(" ");
