import type { ResumeContentDocument } from "@/lib/resume-document";
import { TEMPLATE_FAMILY_LIBRARY } from "@/lib/template-library";
import type { CuratedTemplateManifest } from "@/lib/template-types";

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
    const directMetrics = item.metrics.length;
    const inferredMetrics = [
      item.rawNarrative,
      ...(item.bullets ?? []),
    ].reduce((total, segment) => total + (segment.match(/\d+(?:\.\d+)?%?/g)?.length ?? 0), 0);

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
  content: ResumeContentDocument,
  template: CuratedTemplateManifest,
) => {
  const features = extractContentFeatures(content);

  return (
    scoreFamilyFit(features, template) +
    scoreSectionOrderFit(features, template) +
    scoreVariantFit(features, template) +
    scoreDensityFit(features, template) +
    scoreRoleSignals(features, template)
  );
};

export const shortlistTemplateLibrary = (
  content: ResumeContentDocument,
  count = 6,
): CuratedTemplateManifest[] =>
  [...TEMPLATE_FAMILY_LIBRARY]
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
    })
    .slice(0, Math.max(count, 0))
    .map(({ template }) => template);
