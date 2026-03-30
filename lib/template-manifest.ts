import { z } from "zod";

import {
  TEMPLATE_FAMILY_LIBRARY,
  TEMPLATE_FAMILY_LABELS,
  assertUniqueTemplateIds,
} from "@/lib/template-library";
import type {
  AwardsVariant,
  EducationVariant,
  ExperienceVariant,
  HeroVariant,
  SkillsVariant,
  TemplateFamilyId,
  TemplateManifest as BaseTemplateManifest,
  TemplateManifestDisplayMetadata,
} from "@/lib/template-types";

export type TemplateManifest = Omit<BaseTemplateManifest, "sections"> & {
  sections: {
    hero: {
      variant: HeroVariant;
    };
    education: {
      variant: EducationVariant;
    };
    experience: {
      variant: ExperienceVariant;
    };
    awards: {
      variant: AwardsVariant;
    };
    skills: {
      variant: SkillsVariant;
    };
  };
};

export const templateToneSchema = z.enum(["calm", "confident", "academic", "modern"]);
export const pageMarginPresetSchema = z.enum(["tight", "balanced", "airy"]);
export const pageLayoutSchema = z.enum(["single-column"]);
export const fontPairSchema = z.enum(["serif-sans", "humanist-sans", "songti-sans"]);
export const accentColorSchema = z.enum(["ink", "navy", "forest", "burgundy"]);
export const dividerStyleSchema = z.enum(["line", "bar", "soft"]);
export const sectionKeySchema = z.enum(["education", "experience", "awards", "skills"]);
export const heroVariantSchema = z.enum([
  "classic-banner",
  "name-left-photo-right",
  "centered-name-minimal",
  "split-meta-band",
  "stacked-profile-card",
]);
export const educationVariantSchema = z.enum([
  "compact-rows",
  "highlight-strip",
  "school-emphasis",
  "signal-grid",
]);
export const experienceVariantSchema = z.enum([
  "stacked-bullets",
  "metric-first",
  "compact-cards",
  "role-first",
  "result-callout",
]);
export const awardsVariantSchema = z.enum(["two-column-table", "inline-list", "pill-row"]);
export const skillsVariantSchema = z.enum(["inline-tags", "grouped-chips", "label-columns"]);
export const compactionDensitySchema = z.enum(["airy", "balanced", "tight"]);
export const overflowPrioritySchema = z.enum(["awards", "skills", "experience"]);
const requiredSectionOrder = sectionKeySchema.options;

const templateDisplayNameSchema = z.string().trim().min(1);
const templateDescriptionSchema = z.string().trim().min(1);
const templateFamilyIdSchema = z.enum([
  "warm-professional",
  "calm-academic",
  "modern-clean",
  "highlight-forward",
]);
const templateFamilyLabelSchema = z.string().trim().min(1);
const templateFitSummarySchema = z.string().trim().min(1);
const templatePreviewHighlightsSchema = z.array(z.string().trim().min(1)).min(2);

export const sectionOrderSchema = z
  .array(sectionKeySchema)
  .length(requiredSectionOrder.length)
  .superRefine((value, context) => {
    if (new Set(value).size !== value.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sectionOrder must not contain duplicates.",
        path: [],
      });
    }

    if (requiredSectionOrder.some((section) => !value.includes(section))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sectionOrder must include every v1 body section exactly once.",
        path: [],
      });
    }
  });

const templateManifestBaseSchema = z.object({
  version: z.literal("v1"),
  templateId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  displayName: templateDisplayNameSchema.optional(),
  description: templateDescriptionSchema.optional(),
  familyId: templateFamilyIdSchema.optional(),
  familyLabel: templateFamilyLabelSchema.optional(),
  fitSummary: templateFitSummarySchema.optional(),
  previewHighlights: templatePreviewHighlightsSchema.optional(),
  tone: templateToneSchema,
  page: z.object({
    size: z.literal("A4"),
    marginPreset: pageMarginPresetSchema,
    layout: pageLayoutSchema,
  }),
  theme: z.object({
    fontPair: fontPairSchema,
    accentColor: accentColorSchema,
    dividerStyle: dividerStyleSchema,
  }),
  sectionOrder: sectionOrderSchema,
  sections: z.object({
    hero: z.object({
      variant: heroVariantSchema,
    }),
    education: z.object({
      variant: educationVariantSchema,
    }),
    experience: z.object({
      variant: experienceVariantSchema,
    }),
    awards: z.object({
      variant: awardsVariantSchema,
    }),
    skills: z.object({
      variant: skillsVariantSchema,
    }),
  }),
  compactionPolicy: z.object({
    density: compactionDensitySchema,
    overflowPriority: z.array(overflowPrioritySchema).min(1),
  }),
});

type TemplateManifestInput = z.input<typeof templateManifestBaseSchema>;

const curatedTemplateManifestById = new Map(
  TEMPLATE_FAMILY_LIBRARY.map((manifest) => [manifest.templateId, manifest] as const),
);

const inferTemplateDisplayName = (manifest: TemplateManifestInput) => {
  if (manifest.sections.hero.variant === "classic-banner") {
    return "重点突出";
  }

  if (
    manifest.compactionPolicy.density === "tight" ||
    manifest.sections.experience.variant === "compact-cards"
  ) {
    return "紧凑清晰";
  }

  if (manifest.sections.hero.variant === "centered-name-minimal") {
    return "轻简清楚";
  }

  return "稳妥简洁";
};

const inferTemplateDescription = (manifest: TemplateManifestInput) => {
  if (manifest.sections.hero.variant === "classic-banner") {
    return "标题更醒目，适合把亮点和结果往上提。";
  }

  if (
    manifest.compactionPolicy.density === "tight" ||
    manifest.sections.experience.variant === "compact-cards"
  ) {
    return "排版更紧凑，适合信息稍多的一页简历。";
  }

  if (manifest.sections.hero.variant === "centered-name-minimal") {
    return "结构更轻，适合先快速看清关键信息。";
  }

  return "结构稳妥，适合先做出一版清楚的校招简历。";
};

const inferTemplateFamilyId = (manifest: TemplateManifestInput): TemplateFamilyId => {
  if (manifest.sections.hero.variant === "classic-banner") {
    return "highlight-forward";
  }

  if (
    manifest.compactionPolicy.density === "tight" ||
    manifest.sections.experience.variant === "compact-cards" ||
    manifest.tone === "modern"
  ) {
    return "modern-clean";
  }

  if (manifest.tone === "academic" || manifest.theme.fontPair === "songti-sans") {
    return "calm-academic";
  }

  return "warm-professional";
};

const inferTemplateFitSummary = (manifest: TemplateManifestInput) => {
  if (manifest.sections.hero.variant === "classic-banner") {
    return "适合已经有明确亮点，想把结果和卖点尽快推到上半页的简历。";
  }

  if (
    manifest.compactionPolicy.density === "tight" ||
    manifest.sections.experience.variant === "compact-cards"
  ) {
    return "适合信息量偏多、需要在一页内压紧排布的简历。";
  }

  if (manifest.tone === "academic" || manifest.theme.fontPair === "songti-sans") {
    return "适合希望先建立教育背景与整体可信度的简历。";
  }

  return "适合希望先交出一版稳妥、正式、易读简历的场景。";
};

const inferTemplatePreviewHighlights = (manifest: TemplateManifestInput) => {
  const highlights = new Set<string>();

  if (manifest.sections.hero.variant === "classic-banner") {
    highlights.add("顶部标题更醒目");
  } else if (manifest.sections.hero.variant === "centered-name-minimal") {
    highlights.add("抬头更轻更极简");
  } else {
    highlights.add("抬头信息完整清楚");
  }

  if (manifest.sections.experience.variant === "metric-first") {
    highlights.add("经历优先展示结果");
  } else if (manifest.sections.experience.variant === "compact-cards") {
    highlights.add("经历模块更利于快扫");
  } else {
    highlights.add("经历阅读节奏更稳定");
  }

  if (manifest.theme.fontPair === "songti-sans") {
    highlights.add("学院感更明显");
  } else if (manifest.theme.fontPair === "humanist-sans") {
    highlights.add("整体更现代利落");
  } else {
    highlights.add("正式感更强");
  }

  if (manifest.compactionPolicy.density === "tight") {
    highlights.add("更适合高信息密度");
  } else if (manifest.compactionPolicy.density === "airy") {
    highlights.add("留白更舒展");
  } else {
    highlights.add("版面密度平衡");
  }

  return [...highlights].slice(0, 3);
};

const deriveTemplateManifestDisplayMetadata = (
  manifest: TemplateManifestInput,
): TemplateManifestDisplayMetadata => {
  const curated = curatedTemplateManifestById.get(manifest.templateId);
  const familyId = manifest.familyId ?? curated?.familyId ?? inferTemplateFamilyId(manifest);
  const normalizedPreviewHighlights = manifest.previewHighlights?.filter(
    (highlight) => highlight.trim().length > 0,
  );

  return {
    displayName: manifest.displayName?.trim() || curated?.displayName || inferTemplateDisplayName(manifest),
    description: manifest.description?.trim() || curated?.description || inferTemplateDescription(manifest),
    familyId,
    familyLabel:
      manifest.familyLabel?.trim() || curated?.familyLabel || TEMPLATE_FAMILY_LABELS[familyId],
    fitSummary: manifest.fitSummary?.trim() || curated?.fitSummary || inferTemplateFitSummary(manifest),
    previewHighlights:
      (normalizedPreviewHighlights && normalizedPreviewHighlights.length >= 2
        ? normalizedPreviewHighlights
        : undefined) ??
      curated?.previewHighlights ??
      inferTemplatePreviewHighlights(manifest),
  };
};

export const hydrateTemplateManifestDisplayCopy = (
  manifest: TemplateManifestInput,
) => ({
  ...manifest,
  ...deriveTemplateManifestDisplayMetadata(manifest),
});

export const templateManifestSchema = templateManifestBaseSchema.transform((manifest) =>
  hydrateTemplateManifestDisplayCopy(manifest),
);

const providerSectionSchema = z
  .object({
    variant: z.string().optional(),
    showMetrics: z.boolean().optional(),
    showHighlights: z.boolean().optional(),
    showSummary: z.boolean().optional(),
    showPhoto: z.boolean().optional(),
    columns: z.number().optional(),
  })
  .passthrough();

const providerTemplateCandidateSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().optional(),
    layout: z.string().optional(),
    theme: z.string().optional(),
    colorAccent: z.string().optional(),
    fontPairing: z.string().optional(),
    sectionOrder: z.array(z.string()).optional(),
    sections: z
      .object({
        profile: providerSectionSchema.optional(),
        education: providerSectionSchema.optional(),
        internship: providerSectionSchema.optional(),
        experience: providerSectionSchema.optional(),
        skills: providerSectionSchema.optional(),
        awards: providerSectionSchema.optional(),
      })
      .partial()
      .optional(),
    compactionPolicy: z.string().optional(),
    pageLimit: z.number().optional(),
  })
  .passthrough();

export const DEFAULT_TEMPLATE_ID = "flagship-reference";
export const TEMPLATE_CANDIDATE_COUNT = 3;
export const BASELINE_TEMPLATE_ID_ORDER = [
  "flagship-reference",
  "compact-elegance",
  "classic-banner",
] as const;

const toTemplateManifestInput = (manifest: TemplateManifest): TemplateManifestInput => ({
  ...manifest,
  sectionOrder: [...manifest.sectionOrder],
  compactionPolicy: {
    ...manifest.compactionPolicy,
    overflowPriority: [...manifest.compactionPolicy.overflowPriority],
  },
  previewHighlights: manifest.previewHighlights ? [...manifest.previewHighlights] : undefined,
});

const parseTemplateManifest = (manifest: TemplateManifest) =>
  templateManifestSchema.parse(toTemplateManifestInput(manifest));

assertUniqueTemplateIds(TEMPLATE_FAMILY_LIBRARY);

const CURATED_TEMPLATE_MANIFESTS: TemplateManifest[] = TEMPLATE_FAMILY_LIBRARY.map((manifest) =>
  parseTemplateManifest(manifest),
);

const curatedManifestById = new Map(
  CURATED_TEMPLATE_MANIFESTS.map((manifest) => [manifest.templateId, manifest] as const),
);

export const BASELINE_TEMPLATE_MANIFESTS: TemplateManifest[] = BASELINE_TEMPLATE_ID_ORDER.map(
  (templateId) => {
    const manifest = curatedManifestById.get(templateId);

    if (!manifest) {
      throw new Error(`Missing baseline template manifest: ${templateId}`);
    }

    return manifest;
  },
);

const manifestById = new Map(
  CURATED_TEMPLATE_MANIFESTS.map((manifest) => [manifest.templateId, manifest] as const),
);

export const getTemplateManifestById = (templateId: string) => manifestById.get(templateId);

export const createTemplateManifestSignature = (manifest: TemplateManifest) =>
  JSON.stringify({
    version: manifest.version,
    tone: manifest.tone,
    page: manifest.page,
    theme: manifest.theme,
    sectionOrder: manifest.sectionOrder,
    sections: manifest.sections,
    compactionPolicy: manifest.compactionPolicy,
  });

const findManifestById = (
  templateId: string | undefined,
  manifests: readonly TemplateManifest[],
) => manifests.find((manifest) => manifest.templateId === templateId);

const fallbackTemplateId = (value: string | undefined, index: number) => {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `provider-template-${index + 1}`;
};

const mapProviderTone = (theme: string | undefined): TemplateManifest["tone"] => {
  switch (theme?.trim().toLowerCase()) {
    case "modern":
      return "modern";
    case "minimal":
      return "calm";
    case "classic":
      return "academic";
    default:
      return "confident";
  }
};

const mapProviderMarginPreset = (
  layout: string | undefined,
  compactionPolicy: string | undefined,
): TemplateManifest["page"]["marginPreset"] => {
  const normalizedLayout = layout?.trim().toLowerCase();
  const normalizedPolicy = compactionPolicy?.trim().toLowerCase();

  if (normalizedPolicy === "trim-bullets" || normalizedLayout === "two-column") {
    return "tight";
  }

  return "balanced";
};

const mapProviderFontPair = (
  fontPairing: string | undefined,
): TemplateManifest["theme"]["fontPair"] => {
  const normalized = fontPairing?.trim().toLowerCase() ?? "";

  if (normalized.includes("songti")) {
    return "songti-sans";
  }

  if (normalized.includes("serif") && normalized.includes("sans")) {
    return "serif-sans";
  }

  return "humanist-sans";
};

const mapProviderAccentColor = (
  colorAccent: string | undefined,
): TemplateManifest["theme"]["accentColor"] => {
  const normalized = colorAccent?.trim().toLowerCase() ?? "";

  if (normalized.startsWith("#") && normalized.length === 7) {
    const red = Number.parseInt(normalized.slice(1, 3), 16);
    const green = Number.parseInt(normalized.slice(3, 5), 16);
    const blue = Number.parseInt(normalized.slice(5, 7), 16);
    const spread = Math.max(red, green, blue) - Math.min(red, green, blue);

    if (spread < 20) {
      return "ink";
    }

    if (green >= red && green >= blue) {
      return "forest";
    }

    if (red > green && red > blue) {
      return "burgundy";
    }

    return "navy";
  }

  if (normalized.includes("green") || normalized.includes("teal")) {
    return "forest";
  }

  if (normalized.includes("red") || normalized.includes("burgundy")) {
    return "burgundy";
  }

  if (normalized.includes("gray") || normalized.includes("grey") || normalized.includes("black")) {
    return "ink";
  }

  return "navy";
};

const mapProviderDividerStyle = (theme: string | undefined): TemplateManifest["theme"]["dividerStyle"] => {
  switch (theme?.trim().toLowerCase()) {
    case "modern":
      return "soft";
    case "classic":
      return "line";
    default:
      return "line";
  }
};

const mapProviderHeroVariant = (
  variant: string | undefined,
): TemplateManifest["sections"]["hero"]["variant"] => {
  switch (variant?.trim().toLowerCase()) {
    case "banner":
      return "classic-banner";
    case "compact":
      return "centered-name-minimal";
    default:
      return "name-left-photo-right";
  }
};

const mapProviderEducationVariant = (
  variant: string | undefined,
): TemplateManifest["sections"]["education"]["variant"] => {
  switch (variant?.trim().toLowerCase()) {
    case "compact":
      return "compact-rows";
    default:
      return "highlight-strip";
  }
};

const mapProviderExperienceVariant = (
  variant: string | undefined,
  showMetrics: boolean | undefined,
): TemplateManifest["sections"]["experience"]["variant"] => {
  const normalized = variant?.trim().toLowerCase();

  if (normalized === "compact" || normalized === "cards" || normalized === "card") {
    return "compact-cards";
  }

  if (showMetrics || normalized === "star" || normalized === "metric") {
    return "metric-first";
  }

  return "stacked-bullets";
};

const mapProviderAwardsVariant = (
  layout: string | undefined,
  theme: string | undefined,
): TemplateManifest["sections"]["awards"]["variant"] => {
  if (layout?.trim().toLowerCase() === "two-column" || theme?.trim().toLowerCase() === "classic") {
    return "two-column-table";
  }

  return "inline-list";
};

const mapProviderSkillsVariant = (
  variant: string | undefined,
): TemplateManifest["sections"]["skills"]["variant"] => {
  switch (variant?.trim().toLowerCase()) {
    case "inline-list":
      return "inline-tags";
    default:
      return "grouped-chips";
  }
};

const mapProviderDensity = (
  compactionPolicy: string | undefined,
): TemplateManifest["compactionPolicy"]["density"] => {
  switch (compactionPolicy?.trim().toLowerCase()) {
    case "trim-bullets":
      return "tight";
    default:
      return "balanced";
  }
};

const mapProviderOverflowPriority = (
  compactionPolicy: string | undefined,
): TemplateManifest["compactionPolicy"]["overflowPriority"] => {
  switch (compactionPolicy?.trim().toLowerCase()) {
    case "trim-bullets":
      return ["experience", "awards", "skills"];
    case "merge-short":
      return ["skills", "awards", "experience"];
    default:
      return ["awards", "skills", "experience"];
  }
};

const normalizeProviderSectionOrder = (
  sectionOrder: string[] | undefined,
): TemplateManifest["sectionOrder"] => {
  const normalized: TemplateManifest["sectionOrder"][number][] = [];

  for (const section of sectionOrder ?? []) {
    const value = section.trim().toLowerCase();

    if (value === "education" && !normalized.includes("education")) {
      normalized.push("education");
      continue;
    }

    if ((value === "internship" || value === "experience" || value === "campus") && !normalized.includes("experience")) {
      normalized.push("experience");
      continue;
    }

    if (value === "awards" && !normalized.includes("awards")) {
      normalized.push("awards");
      continue;
    }

    if (value === "skills" && !normalized.includes("skills")) {
      normalized.push("skills");
    }
  }

  for (const required of requiredSectionOrder) {
    if (!normalized.includes(required)) {
      normalized.push(required);
    }
  }

  return normalized as TemplateManifest["sectionOrder"];
};

const normalizeTemplateManifestCandidate = (
  candidate: unknown,
  index: number,
): TemplateManifest | null => {
  const approved = templateManifestSchema.safeParse(candidate);
  if (approved.success) {
    return hydrateTemplateManifestDisplayCopy(toTemplateManifestInput(approved.data));
  }

  const providerCandidate = providerTemplateCandidateSchema.safeParse(candidate);
  if (!providerCandidate.success) {
    return null;
  }

  const provider = providerCandidate.data;
  const experienceSection = provider.sections?.internship ?? provider.sections?.experience;

  return templateManifestSchema.parse({
    version: "v1",
    templateId: fallbackTemplateId(provider.id, index),
    name: provider.label?.trim() || provider.id?.trim() || `模板 ${index + 1}`,
    tone: mapProviderTone(provider.theme),
    page: {
      size: "A4",
      marginPreset: mapProviderMarginPreset(provider.layout, provider.compactionPolicy),
      layout: "single-column",
    },
    theme: {
      fontPair: mapProviderFontPair(provider.fontPairing),
      accentColor: mapProviderAccentColor(provider.colorAccent),
      dividerStyle: mapProviderDividerStyle(provider.theme),
    },
    sectionOrder: normalizeProviderSectionOrder(provider.sectionOrder),
    sections: {
      hero: {
        variant: mapProviderHeroVariant(provider.sections?.profile?.variant),
      },
      education: {
        variant: mapProviderEducationVariant(provider.sections?.education?.variant),
      },
      experience: {
        variant: mapProviderExperienceVariant(
          experienceSection?.variant,
          experienceSection?.showMetrics,
        ),
      },
      awards: {
        variant: mapProviderAwardsVariant(provider.layout, provider.theme),
      },
      skills: {
        variant: mapProviderSkillsVariant(provider.sections?.skills?.variant),
      },
    },
    compactionPolicy: {
      density: mapProviderDensity(provider.compactionPolicy),
      overflowPriority: mapProviderOverflowPriority(provider.compactionPolicy),
    },
  });
};

const nextBaselineReplacement = (
  usedSignatures: Set<string>,
  baselineManifests: readonly TemplateManifest[],
) =>
  baselineManifests.find((manifest) => !usedSignatures.has(createTemplateManifestSignature(manifest)));

export const finalizeTemplateManifestCandidates = (
  candidates: unknown[],
  baselineManifests: readonly TemplateManifest[] = BASELINE_TEMPLATE_MANIFESTS,
  desiredCount = TEMPLATE_CANDIDATE_COUNT,
): TemplateManifest[] => {
  const usedSignatures = new Set<string>();
  const finalized: TemplateManifest[] = [];

  for (const candidate of candidates) {
    if (finalized.length >= desiredCount) {
      break;
    }

    const normalizedCandidate = normalizeTemplateManifestCandidate(candidate, finalized.length);
    if (!normalizedCandidate) {
      continue;
    }
    const signature = createTemplateManifestSignature(normalizedCandidate);

    if (usedSignatures.has(signature)) {
      continue;
    }

    finalized.push(normalizedCandidate);
    usedSignatures.add(signature);
  }

  while (finalized.length < desiredCount) {
    const replacement = nextBaselineReplacement(usedSignatures, baselineManifests);
    if (!replacement) {
      break;
    }

    finalized.push(replacement);
    usedSignatures.add(createTemplateManifestSignature(replacement));
  }

  return finalized;
};

export const resolveTemplateManifestById = (
  templateId?: string,
  candidateManifests: readonly TemplateManifest[] = [],
) =>
  findManifestById(templateId ?? DEFAULT_TEMPLATE_ID, candidateManifests) ??
  getTemplateManifestById(templateId ?? DEFAULT_TEMPLATE_ID) ??
  getTemplateManifestById(DEFAULT_TEMPLATE_ID)!;
