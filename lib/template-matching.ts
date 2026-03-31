import type { ResumeContentDocument } from "@/lib/resume-document";
import { TEMPLATE_FAMILY_LIBRARY } from "@/lib/template-library";
import type { CuratedTemplateManifest, TemplateManifest } from "@/lib/template-types";

type TemplateMatchingContentInput = {
  [key: string]: unknown;
  profile?: {
    [key: string]: unknown;
    fullName?: string;
    targetRole?: string;
    phone?: string;
    email?: string;
    location?: string;
    summary?: string;
    preferredLocation?: string;
    compactProfileNote?: string;
    photo?: unknown;
  };
  education?: Array<Record<string, unknown>>;
  experiences?: Array<Record<string, unknown>>;
  awards?: Array<Record<string, unknown>>;
  skills?: unknown[];
  intake?: {
    mode?: string;
    turns?: Array<Record<string, unknown>>;
  };
  meta?: Record<string, unknown>;
};

type ContentFeatures = {
  educationCount: number;
  educationHighlightCount: number;
  experienceCount: number;
  awardCount: number;
  skillsCount: number;
  bulletCount: number;
  metricCount: number;
  text: string;
  isAcademicTarget: boolean;
  isMetricTarget: boolean;
  isSkillsScreenTarget: boolean;
  isDense: boolean;
  isSparse: boolean;
};

type DiversityComparableTemplate = Pick<
  TemplateManifest,
  "templateId" | "familyId" | "sections" | "compactionPolicy"
>;

const ACADEMIC_KEYWORDS = [
  "academic",
  "gpa",
  "phd",
  "research",
  "thesis",
  "paper",
  "科研",
  "研究",
  "学术",
  "课题",
  "论文",
  "保研",
  "奖学金",
];

const METRIC_KEYWORDS = [
  "analytics",
  "conversion",
  "growth",
  "kpi",
  "roi",
  "sales",
  "sql",
  "运营",
  "增长",
  "转化",
  "投放",
  "数据",
  "分析",
  "销售",
  "漏斗",
];

const SKILLS_SCREEN_KEYWORDS = [
  "designer",
  "engineer",
  "frontend",
  "product",
  "ui",
  "ux",
  "工程师",
  "开发",
  "前端",
  "后端",
  "算法",
  "产品",
  "设计",
  "测试",
];

const countKeywordMatches = (text: string, keywords: readonly string[]) =>
  keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);

const normalizeSignal = (value: string | undefined) => value?.trim().toLowerCase() ?? "";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeContentDocument = (content: TemplateMatchingContentInput): ResumeContentDocument => {
  const profile = isRecord(content.profile) ? content.profile : {};
  const education = Array.isArray(content.education) ? content.education : [];
  const experiences = Array.isArray(content.experiences) ? content.experiences : [];
  const awards = Array.isArray(content.awards) ? content.awards : [];
  const skills = Array.isArray(content.skills)
    ? content.skills.filter((skill): skill is string => typeof skill === "string")
    : [];

  return {
    profile: {
      fullName: typeof profile.fullName === "string" ? profile.fullName : "",
      targetRole: typeof profile.targetRole === "string" ? profile.targetRole : "",
      phone: typeof profile.phone === "string" ? profile.phone : "",
      email: typeof profile.email === "string" ? profile.email : "",
      location: typeof profile.location === "string" ? profile.location : "",
      summary: typeof profile.summary === "string" ? profile.summary : "",
      preferredLocation:
        typeof profile.preferredLocation === "string" ? profile.preferredLocation : undefined,
      compactProfileNote:
        typeof profile.compactProfileNote === "string" ? profile.compactProfileNote : undefined,
      photo: null,
    },
    education: education
      .filter(isRecord)
      .map((item, index) => ({
        id: typeof item.id === "string" ? item.id : `education-${index + 1}`,
        school: typeof item.school === "string" ? item.school : "",
        degree: typeof item.degree === "string" ? item.degree : "",
        dateRange: typeof item.dateRange === "string" ? item.dateRange : "",
        tag: typeof item.tag === "string" ? item.tag : undefined,
        highlights: Array.isArray(item.highlights)
          ? item.highlights.filter(isRecord).map((highlight) => ({
              label: typeof highlight.label === "string" ? highlight.label : "",
              value: typeof highlight.value === "string" ? highlight.value : "",
            }))
          : [],
      })),
    experiences: experiences
      .filter(isRecord)
      .map((item, index) => ({
        id: typeof item.id === "string" ? item.id : `experience-${index + 1}`,
        section: item.section === "campus" || item.section === "internship" ? item.section : undefined,
        organization: typeof item.organization === "string" ? item.organization : "",
        organizationNote: typeof item.organizationNote === "string" ? item.organizationNote : undefined,
        role: typeof item.role === "string" ? item.role : "",
        dateRange: typeof item.dateRange === "string" ? item.dateRange : "",
        priority: typeof item.priority === "number" ? item.priority : 0,
        locked: typeof item.locked === "boolean" ? item.locked : false,
        rawNarrative: typeof item.rawNarrative === "string" ? item.rawNarrative : "",
        bullets: Array.isArray(item.bullets)
          ? item.bullets.filter((bullet): bullet is string => typeof bullet === "string")
          : [],
        linkUrl: typeof item.linkUrl === "string" ? item.linkUrl : undefined,
        metrics: Array.isArray(item.metrics)
          ? item.metrics.filter((metric): metric is string => typeof metric === "string")
          : [],
        tags: Array.isArray(item.tags)
          ? item.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
        variants: {
          raw: isRecord(item.variants) && typeof item.variants.raw === "string" ? item.variants.raw : "",
          star: isRecord(item.variants) && typeof item.variants.star === "string" ? item.variants.star : "",
          standard:
            isRecord(item.variants) && typeof item.variants.standard === "string"
              ? item.variants.standard
              : "",
          compact:
            isRecord(item.variants) && typeof item.variants.compact === "string"
              ? item.variants.compact
              : "",
        },
      })),
    awards: awards
      .filter(isRecord)
      .map((item, index) => ({
        id: typeof item.id === "string" ? item.id : `award-${index + 1}`,
        title: typeof item.title === "string" ? item.title : "",
        priority: typeof item.priority === "number" ? item.priority : 0,
      })),
    skills,
    intake: {
      mode: content.intake?.mode === "guided" ? "guided" : "paste",
      turns: Array.isArray(content.intake?.turns)
        ? content.intake.turns.filter(isRecord).map((turn, index) => ({
            id: typeof turn.id === "string" ? turn.id : `turn-${index + 1}`,
            speaker: turn.speaker === "assistant" ? "assistant" : "user",
            content: typeof turn.content === "string" ? turn.content : "",
          }))
        : [],
    },
    meta: {
      language: "zh-CN",
      targetAudience: "campus-recruiting",
      completeness: "baseline",
      evidenceStrength: "mixed",
    },
  };
};

const collectContentText = (content: ResumeContentDocument) =>
  [
    content.profile.targetRole,
    content.profile.summary,
    content.profile.compactProfileNote,
    ...content.education.flatMap((item) => [
      item.school,
      item.degree,
      item.dateRange,
      item.tag,
      ...(item.highlights ?? []).flatMap((highlight) => [highlight.label, highlight.value]),
    ]),
    ...content.experiences.flatMap((item) => [
      item.organization,
      item.organizationNote,
      item.role,
      item.dateRange,
      item.rawNarrative,
      ...(item.bullets ?? []),
      ...item.metrics,
      ...item.tags,
    ]),
    ...content.awards.map((item) => item.title),
    ...content.skills,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const extractContentFeatures = (content: ResumeContentDocument): ContentFeatures => {
  const text = collectContentText(content);
  const educationHighlightCount = content.education.reduce(
    (count, item) => count + (item.highlights?.length ?? 0),
    0,
  );
  const bulletCount = content.experiences.reduce(
    (count, item) => count + (item.bullets?.length ?? 0),
    0,
  );
  const metricCount = content.experiences.reduce((count, item) => {
    const directMetrics = new Set(
      item.metrics.map((metric) => normalizeSignal(metric)).filter(Boolean),
    ).size;
    const inferredMetrics = new Set(
      [...new Set([item.rawNarrative, ...(item.bullets ?? [])].map((segment) => normalizeSignal(segment)).filter(Boolean))]
        .flatMap((segment) => segment.match(/\d+(?:\.\d+)?%?/g) ?? [])
        .map((metric) => normalizeSignal(metric))
        .filter(Boolean),
    ).size;

    return count + Math.max(directMetrics, inferredMetrics);
  }, 0);
  const volumeScore =
    content.education.length * 2 +
    educationHighlightCount +
    content.experiences.length * 3 +
    bulletCount +
    content.awards.length * 2 +
    content.skills.length;

  return {
    educationCount: content.education.length,
    educationHighlightCount,
    experienceCount: content.experiences.length,
    awardCount: content.awards.length,
    skillsCount: content.skills.length,
    bulletCount,
    metricCount,
    text,
    isAcademicTarget: countKeywordMatches(text, ACADEMIC_KEYWORDS) > 0,
    isMetricTarget: metricCount >= 2 || countKeywordMatches(text, METRIC_KEYWORDS) >= 2,
    isSkillsScreenTarget:
      content.skills.length >= 6 || countKeywordMatches(text, SKILLS_SCREEN_KEYWORDS) >= 1,
    isDense: volumeScore >= 14,
    isSparse: volumeScore <= 6,
  };
};

const scoreFamilyFit = (features: ContentFeatures, template: CuratedTemplateManifest) => {
  switch (template.familyId) {
    case "highlight-forward":
      return features.isMetricTarget ? 22 : features.metricCount > 0 ? 8 : -4;
    case "calm-academic":
      return features.isAcademicTarget ? 24 : features.educationHighlightCount > 0 ? 8 : -6;
    case "modern-clean":
      return features.isDense || features.isSkillsScreenTarget ? 14 : 4;
    case "warm-professional":
      return features.isAcademicTarget || features.isMetricTarget ? 8 : 16;
    default:
      return 0;
  }
};

const scoreSectionOrderFit = (features: ContentFeatures, template: CuratedTemplateManifest) => {
  const [firstSection] = template.sectionOrder;

  if (firstSection === "experience") {
    return features.experienceCount > 0 ? 10 + Math.min(features.metricCount, 3) * 2 : 0;
  }

  if (firstSection === "education") {
    return (
      (features.educationCount > 0 ? 8 : 0) +
      (features.isAcademicTarget ? 6 : 0) +
      (features.educationHighlightCount > 0 ? 3 : 0)
    );
  }

  if (firstSection === "skills") {
    return features.isSkillsScreenTarget ? 14 : features.skillsCount >= 4 ? 6 : -3;
  }

  return 0;
};

const scoreVariantFit = (features: ContentFeatures, template: CuratedTemplateManifest) => {
  let score = 0;

  if (template.sections.education.variant === "school-emphasis") {
    score += features.isAcademicTarget ? 10 : 3;
    score += features.educationHighlightCount > 0 ? 6 : 0;
  }

  if (template.sections.education.variant === "signal-grid") {
    score += features.educationHighlightCount > 0 ? 12 : 0;
    score += features.isAcademicTarget ? 6 : 0;
  }

  if (template.sections.education.variant === "compact-rows") {
    score += features.isDense ? 6 : 1;
  }

  if (template.sections.experience.variant === "metric-first") {
    score += features.metricCount >= 2 ? 16 : features.metricCount > 0 ? 8 : -2;
  }

  if (template.sections.experience.variant === "result-callout") {
    score += features.metricCount >= 2 ? 18 : features.metricCount > 0 ? 9 : 0;
  }

  if (template.sections.experience.variant === "compact-cards") {
    score += features.isDense ? 11 : 3;
  }

  if (template.sections.experience.variant === "role-first") {
    score += features.experienceCount > 0 ? 8 : 0;
    score += features.isAcademicTarget ? 2 : 4;
  }

  if (template.sections.experience.variant === "stacked-bullets") {
    score += features.isAcademicTarget ? 8 : 4;
    score += features.bulletCount >= 2 ? 4 : 1;
  }

  if (template.sections.skills.variant === "label-columns") {
    score += features.skillsCount >= 4 ? 8 : 2;
  }

  if (template.sections.skills.variant === "grouped-chips") {
    score += features.skillsCount >= 4 ? 7 : 2;
  }

  if (template.sections.skills.variant === "inline-tags") {
    score += features.skillsCount <= 4 ? 4 : 1;
  }

  if (template.sections.awards.variant === "two-column-table") {
    score += features.awardCount > 0 ? 8 : 1;
    score += features.isAcademicTarget ? 4 : 0;
  }

  if (template.sections.awards.variant === "pill-row") {
    score += features.isMetricTarget ? 6 : 2;
  }

  if (template.sections.awards.variant === "inline-list") {
    score += features.awardCount === 0 ? 4 : 1;
  }

  if (template.sections.hero.variant === "classic-banner") {
    score += features.isMetricTarget ? 14 : features.metricCount > 0 ? 8 : 0;
  }

  if (template.sections.hero.variant === "centered-name-minimal") {
    score += features.isAcademicTarget ? 5 : 2;
    score += features.isSparse ? 4 : 0;
  }

  if (template.sections.hero.variant === "stacked-profile-card") {
    score += features.isSkillsScreenTarget ? 7 : 2;
  }

  return score;
};

const scoreDensityFit = (features: ContentFeatures, template: CuratedTemplateManifest) => {
  if (template.compactionPolicy.density === "tight") {
    return features.isDense ? 10 : features.isSparse ? -4 : 3;
  }

  if (template.compactionPolicy.density === "airy") {
    return features.isAcademicTarget || features.isSparse ? 8 : 2;
  }

  return 6;
};

const scoreRoleSignals = (features: ContentFeatures, template: CuratedTemplateManifest) => {
  const boosts: Partial<Record<CuratedTemplateManifest["templateId"], number>> = {};

  if (features.isMetricTarget) {
    boosts["highlight-metrics"] = 14;
    boosts["classic-banner"] = 10;
    boosts["highlight-top-block"] = 7;
  }

  if (features.isAcademicTarget) {
    boosts["academic-ledger"] = 14;
    boosts["academic-signals"] = 11;
    boosts["academic-timeline"] = 9;
  }

  if (features.isSkillsScreenTarget) {
    boosts["highlight-top-block"] = (boosts["highlight-top-block"] ?? 0) + 8;
    boosts["modern-balanced"] = 6;
    boosts["modern-minimal"] = 5;
  }

  if (features.isDense) {
    boosts["compact-elegance"] = (boosts["compact-elegance"] ?? 0) + 10;
    boosts["academic-compact"] = (boosts["academic-compact"] ?? 0) + 8;
  }

  if (features.isSparse) {
    boosts["flagship-reference"] = 6;
    boosts["modern-minimal"] = (boosts["modern-minimal"] ?? 0) + 4;
  }

  return boosts[template.templateId] ?? 0;
};

export const scoreTemplateFit = (
  content: TemplateMatchingContentInput,
  template: CuratedTemplateManifest,
) => {
  const features = extractContentFeatures(normalizeContentDocument(content));

  return (
    scoreFamilyFit(features, template) +
    scoreSectionOrderFit(features, template) +
    scoreVariantFit(features, template) +
    scoreDensityFit(features, template) +
    scoreRoleSignals(features, template)
  );
};

const scoreTemplateDiversity = (
  template: CuratedTemplateManifest,
  selectedTemplates: DiversityComparableTemplate[],
) => {
  if (selectedTemplates.length === 0) {
    return 0;
  }

  let penalty = 0;

  for (const selectedTemplate of selectedTemplates) {
    if (selectedTemplate.familyId === template.familyId) {
      penalty += 14;
    }

    if (selectedTemplate.sections.hero.variant === template.sections.hero.variant) {
      penalty += 8;
    }

    if (selectedTemplate.sections.experience.variant === template.sections.experience.variant) {
      penalty += 6;
    }

    if (selectedTemplate.sections.education.variant === template.sections.education.variant) {
      penalty += 4;
    }

    if (selectedTemplate.compactionPolicy.density === template.compactionPolicy.density) {
      penalty += 2;
    }
  }

  const usesNewFamily = selectedTemplates.every(
    (selectedTemplate) => selectedTemplate.familyId !== template.familyId,
  );

  return (usesNewFamily ? 5 : 0) - penalty;
};

export const shortlistTemplateLibrary = (
  content: TemplateMatchingContentInput,
  count = 6,
): CuratedTemplateManifest[] => {
  const scoredTemplates = [...TEMPLATE_FAMILY_LIBRARY]
    .map((template, index) => ({
      template,
      index,
      score: scoreTemplateFit(content, template),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    });
  const limit = Math.max(count, 0);

  if (limit === 0) {
    return [];
  }

  const selectedTemplates: CuratedTemplateManifest[] = [];
  const remainingTemplates = [...scoredTemplates];

  while (selectedTemplates.length < limit && remainingTemplates.length > 0) {
    const nextSelection = remainingTemplates
      .map((candidate) => ({
        ...candidate,
        adjustedScore: candidate.score + scoreTemplateDiversity(candidate.template, selectedTemplates),
      }))
      .sort((left, right) => {
        if (right.adjustedScore !== left.adjustedScore) {
          return right.adjustedScore - left.adjustedScore;
        }

        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.index - right.index;
      })[0];

    if (!nextSelection) {
      break;
    }

    selectedTemplates.push(nextSelection.template);
    const nextIndex = remainingTemplates.findIndex(
      (candidate) => candidate.template.templateId === nextSelection.template.templateId,
    );

    if (nextIndex >= 0) {
      remainingTemplates.splice(nextIndex, 1);
    } else {
      break;
    }
  }

  return selectedTemplates;
};

export const rankAdditionalTemplateLibrary = (
  content: TemplateMatchingContentInput,
  recommendedTemplates: readonly DiversityComparableTemplate[],
): CuratedTemplateManifest[] => {
  const coveredFamilyIds = new Set(
    recommendedTemplates
      .map((template) => template.familyId)
      .filter((familyId): familyId is NonNullable<typeof familyId> => Boolean(familyId)),
  );
  const recommendedTemplateIds = new Set(
    recommendedTemplates.map((template) => template.templateId),
  );
  const scoredTemplates = [...TEMPLATE_FAMILY_LIBRARY]
    .filter((template) => !recommendedTemplateIds.has(template.templateId))
    .map((template, index) => ({
      template,
      index,
      score: scoreTemplateFit(content, template),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    });

  const orderedTemplates: CuratedTemplateManifest[] = [];
  const selectedTemplates = [...recommendedTemplates];
  const remainingTemplates = [...scoredTemplates];

  while (remainingTemplates.length > 0) {
    const uncoveredFamilyTemplates = remainingTemplates.filter(
      (candidate) => !coveredFamilyIds.has(candidate.template.familyId),
    );
    const candidatePool =
      uncoveredFamilyTemplates.length > 0 ? uncoveredFamilyTemplates : remainingTemplates;
    const nextSelection = candidatePool
      .map((candidate) => ({
        ...candidate,
        adjustedScore: candidate.score + scoreTemplateDiversity(candidate.template, selectedTemplates),
      }))
      .sort((left, right) => {
        if (right.adjustedScore !== left.adjustedScore) {
          return right.adjustedScore - left.adjustedScore;
        }

        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.index - right.index;
      })[0];

    if (!nextSelection) {
      break;
    }

    orderedTemplates.push(nextSelection.template);
    selectedTemplates.push(nextSelection.template);
    if (nextSelection.template.familyId) {
      coveredFamilyIds.add(nextSelection.template.familyId);
    }

    const nextIndex = remainingTemplates.findIndex(
      (candidate) => candidate.template.templateId === nextSelection.template.templateId,
    );

    if (nextIndex >= 0) {
      remainingTemplates.splice(nextIndex, 1);
    } else {
      break;
    }
  }

  return orderedTemplates;
};
