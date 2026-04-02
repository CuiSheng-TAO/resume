import { normalizeExperienceBullets } from "@/lib/experience";
import type { TemplateManifest } from "@/lib/template-manifest";
import type {
  EducationAsset,
  EducationHighlight,
  ExperienceAsset,
  WorkspaceData,
} from "@/lib/types";

export type FlagshipHeaderItem = {
  label: string;
  value: string;
  english?: boolean;
};

export type FlagshipExperienceEntry = {
  id: string;
  organization: string;
  organizationNote?: string;
  role: string;
  dateRange: string;
  bullets: string[];
};

export type FlagshipReferenceModel = {
  fullName: string;
  headerVariant: "photo-present" | "photo-absent";
  photoSrc?: string;
  websiteUrl?: string;
  websiteLabel?: string;
  headerItems: FlagshipHeaderItem[];
  compactProfileNote?: string;
  education: Array<{
    id: string;
    school: string;
    degree: string;
    dateRange: string;
    tag?: string;
  }>;
  educationHighlights: EducationHighlight[];
  internshipExperiences: FlagshipExperienceEntry[];
  campusExperiences: FlagshipExperienceEntry[];
  awards: string[];
  awardRows: string[][];
  skills: string[];
};

export const FLAGSHIP_REFERENCE_TEMPLATE_MANIFEST: TemplateManifest = {
  version: "v1",
  templateId: "flagship-reference",
  name: "Flagship Reference",
  displayName: "稳妥通用版",
  description: "先把姓名、教育和经历都讲清楚，适合大多数校招简历。",
  bestFor: "适合先稳稳投递",
  tone: "academic",
  page: {
    size: "A4",
    marginPreset: "balanced",
    layout: "single-column",
  },
  theme: {
    fontPair: "songti-sans",
    accentColor: "navy",
    dividerStyle: "line",
  },
  sectionOrder: ["education", "experience", "awards", "skills"],
  sections: {
    hero: {
      variant: "name-left-photo-right",
    },
    education: {
      variant: "highlight-strip",
    },
    experience: {
      variant: "stacked-bullets",
    },
    awards: {
      variant: "two-column-table",
    },
    skills: {
      variant: "inline-tags",
    },
  },
  compactionPolicy: {
    density: "airy",
    overflowPriority: ["awards", "skills", "experience"],
  },
};

export const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");

export const sanitizeHref = (url: string) => {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^mailto:/i.test(trimmed)) {
    return trimmed;
  }
  return "";
};

const normalizeHighlights = (highlights?: EducationHighlight[]) =>
  (highlights ?? []).filter((item) => item.label.trim() && item.value.trim());

const PRESENT_TIME_SCORE = 9999_12;

const toSortableYearMonth = (value: string) => {
  const normalized = value.trim().replaceAll("/", ".").replaceAll("-", ".").replaceAll("年", ".").replaceAll("月", "");
  const match = normalized.match(/(20\d{2}|19\d{2})(?:\.(\d{1,2}))?/);

  if (!match) {
    return -1;
  }

  const year = Number.parseInt(match[1] ?? "", 10);
  const month = Number.parseInt(match[2] ?? "12", 10);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return -1;
  }

  return year * 100 + Math.min(Math.max(month, 1), 12);
};

const getEducationDateScores = (education: EducationAsset) => {
  if (/(至今|现在|present|current)/i.test(education.dateRange)) {
    return {
      end: PRESENT_TIME_SCORE,
      start: toSortableYearMonth(education.dateRange),
    };
  }

  const parts = education.dateRange
    .split(/\s*[~\-—–到至]+\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { end: -1, start: -1 };
  }

  const start = toSortableYearMonth(parts[0] ?? "");
  const end = toSortableYearMonth(parts.at(-1) ?? "");

  return {
    end,
    start,
  };
};

export const sortEducationByRecency = (education: EducationAsset[]) =>
  [...education].sort((left, right) => {
    const leftScores = getEducationDateScores(left);
    const rightScores = getEducationDateScores(right);

    if (rightScores.end !== leftScores.end) {
      return rightScores.end - leftScores.end;
    }

    if (rightScores.start !== leftScores.start) {
      return rightScores.start - leftScores.start;
    }

    return right.id.localeCompare(left.id);
  });

const normalizeBullets = (experience: ExperienceAsset, content: string) => {
  // Prefer variant content — it contains variant-specific bullet selection/ordering
  const variantBullets = normalizeExperienceBullets(content);
  if (variantBullets.length > 0) {
    return variantBullets;
  }

  // Fallback to canonical bullets if variant content is empty
  return normalizeExperienceBullets(experience.bullets ?? []);
};

const getVariantContent = (workspace: WorkspaceData, experience: ExperienceAsset) => {
  const variant =
    workspace.layoutPlan.selectedVariants[experience.id] ??
    workspace.draft.selectedVariants[experience.id] ??
    "standard";

  return experience.variants[variant] ?? experience.variants.standard ?? experience.rawNarrative;
};

export const getPhotoSource = (workspace: WorkspaceData) =>
  workspace.profile.photo?.processedDataUrl ??
  workspace.profile.photo?.previewDataUrl ??
  workspace.profile.photo?.dataUrl;

export const buildEducationSummaryLine = (education: EducationAsset[]) => {
  const items = sortEducationByRecency(education).flatMap((item) => normalizeHighlights(item.highlights));
  if (items.length === 0) {
    return "";
  }

  return items
    .map((item) => `${escapeHtml(item.label)}：<span class="resume-text-strong">${escapeHtml(item.value)}</span>`)
    .join('<span class="resume-divider">//</span>');
};

export const buildFlagshipReferenceModel = (workspace: WorkspaceData): FlagshipReferenceModel => {
  const orderedEducation = sortEducationByRecency(workspace.education);
  const visibleExperiences = workspace.experiences.filter(
    (experience) => !workspace.layoutPlan.hiddenExperienceIds.includes(experience.id),
  );
  const internshipExperiences = visibleExperiences.filter(
    (experience) => (experience.section ?? "internship") === "internship",
  );
  const campusExperiences = visibleExperiences.filter(
    (experience) => experience.section === "campus",
  );
  const photoSrc = getPhotoSource(workspace);
  const visibleAwards = workspace.awards.filter(
    (award) => !workspace.layoutPlan.hiddenAwardIds.includes(award.id),
  );
  const awardRows: string[][] = [];

  for (let index = 0; index < visibleAwards.length; index += 2) {
    awardRows.push(visibleAwards.slice(index, index + 2).map((award) => award.title));
  }

  const mapExperience = (experience: ExperienceAsset): FlagshipExperienceEntry => {
    const content = getVariantContent(workspace, experience);

    return {
      id: experience.id,
      organization: experience.organization,
      organizationNote: experience.organizationNote,
      role: experience.role,
      dateRange: experience.dateRange,
      bullets: normalizeBullets(experience, content),
    };
  };

  return {
    fullName: workspace.profile.fullName,
    headerVariant: photoSrc ? "photo-present" : "photo-absent",
    photoSrc: photoSrc ?? undefined,
    websiteUrl: workspace.profile.websiteUrl,
    websiteLabel: workspace.profile.websiteLabel,
    compactProfileNote: workspace.profile.compactProfileNote,
    headerItems: [
      { label: "电话", value: workspace.profile.phone, english: true },
      { label: "邮箱", value: workspace.profile.email, english: true },
      { label: "政治面貌", value: workspace.profile.politicalStatus ?? "" },
      {
        label: "期望地点",
        value: workspace.profile.preferredLocation || workspace.profile.location,
      },
    ].filter((item) => item.value.trim()),
    education: orderedEducation.map((item) => ({
      id: item.id,
      school: item.school,
      degree: item.degree,
      dateRange: item.dateRange,
      tag: item.tag,
    })),
    educationHighlights: orderedEducation.flatMap((item) => normalizeHighlights(item.highlights)),
    internshipExperiences: internshipExperiences.map(mapExperience),
    campusExperiences: campusExperiences.map(mapExperience),
    awards: visibleAwards.map((award) => award.title),
    awardRows,
    skills: workspace.skills,
  };
};
