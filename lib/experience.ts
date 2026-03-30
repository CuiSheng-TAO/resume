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

export const deriveExperienceVariants = (
  bullets: string[],
): Record<ExperienceVariantKey, string> => {
  const normalizedBullets = normalizeExperienceBullets(bullets);
  const finalizedBullets = normalizedBullets.map((item) => ensureSentenceEnding(item));
  const joined = finalizedBullets.join(" ");
  const primary = finalizedBullets[0] ?? "";
  const compact = finalizedBullets.map((item) => compactifyBullet(item)).join(" ");

  return {
    raw: joined,
    star: joined || primary,
    standard: joined || primary,
    compact,
  };
};

export const extractExperienceMetrics = (bullets: string[]) =>
  normalizeExperienceBullets(bullets).join(" ").match(/\d+[^\s，。；]*/g) ?? [];

export const buildExperienceNarrative = (bullets: string[]) =>
  normalizeExperienceBullets(bullets).join(" ");
