"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { createAnalyticsEvent } from "@/lib/analytics";
import {
  buildFallbackInterviewNext,
  buildFallbackTemplateCandidates,
  extractContentFallback,
} from "@/lib/ai-fallback";
import {
  buildExperienceNarrative,
  deriveExperienceVariants,
  extractExperienceMetrics,
  normalizeExperienceBullets,
  type ExperienceRewriteSuggestion,
} from "@/lib/experience";
import { exportResumeHtml, printToPdf } from "@/lib/export";
import {
  assessIntakeProgress,
  listMissingCoreAreas,
  type IntakeQuestionFocus,
  type IntakeProgress,
  type IntakeQuestionPlan,
} from "@/lib/intake-engine";
import { rankAdditionalTemplateLibrary } from "@/lib/template-matching";
import {
  applyLayoutSuggestion,
  applyLayoutSuggestionSequence,
  buildLayoutAdvice,
  type LayoutSuggestion,
} from "@/lib/layout-advice";
import { deriveVisualContentBalance } from "@/lib/layout-measure";
import { TEMPLATE_FAMILY_SUMMARIES } from "@/lib/template-library";
import {
  createBaselineContentDocumentFromGuidedAnswers,
  createWorkspaceDataBridge,
  deriveInitialRenderState,
  deriveInitialTemplateSession,
  recomputeWorkspaceData,
  type ResumeContentDocument,
} from "@/lib/resume-document";
import { clearWorkspace, loadWorkspace, saveWorkspace } from "@/lib/storage";
import {
  finalizeTemplateManifestCandidates,
  resolveTemplateManifestById,
  TEMPLATE_CANDIDATE_COUNT,
  type TemplateManifest,
} from "@/lib/template-manifest";
import type { ExperienceVariant, HeroVariant, TemplateFamilyId } from "@/lib/template-types";
import type {
  EducationAsset,
  ExperienceAsset,
  ExperienceSection,
  GuidedAnswers,
  ResumeMeasurement,
  WorkspaceData,
} from "@/lib/types";

import { PhotoUploader } from "./photo-uploader";
import { LayoutAdvicePanel } from "./layout-advice-panel";
import { ResumePreview } from "./resume-preview";

type Stage = "landing" | "guided" | "paste" | "editor";
type MobilePanel = "editor" | "preview";
type EditorFlowMode = "starter" | "strengthening" | "review";
type ExperienceSuggestionState = {
  status: "idle" | "generating" | "ready" | "apply_failed";
  suggestion?: ExperienceRewriteSuggestion;
  mode?: "anthropic" | "fallback" | "rate_limited";
  message?: string;
};
type TemplateCandidateSourceMode =
  | "baseline"
  | "loading"
  | "anthropic"
  | "fallback"
  | "rate_limited";
type TemplateCandidateState = {
  mode: TemplateCandidateSourceMode;
  message?: string;
};
type FollowUpTarget = {
  kind: "education" | "experience";
  itemId: string;
  label: string;
};
type StrengtheningSectionKey = "education" | "internship" | "campus" | "adjustments";

const DEFAULT_GUIDED: GuidedAnswers = {
  fullName: "",
  targetRole: "",
  phone: "",
  email: "",
  location: "",
  education: {
    school: "",
    degree: "",
    dateRange: "",
  },
  topExperience: {
    organization: "",
    role: "",
    dateRange: "",
    narrative: "",
  },
  skills: [],
};

type GuidedQuestion = {
  key: IntakeQuestionFocus;
  prompt: string;
  note: string;
  placeholder: string;
  multiline?: boolean;
  helperLines?: string[];
  getHelperStatus?: (value: string) => {
    recognized: string[];
    missing: string[];
  };
  getValue: (answers: GuidedAnswers) => string;
  apply: (answers: GuidedAnswers, value: string) => GuidedAnswers;
};

const stripKnownLabels = (value: string) =>
  value
    .replace(/^(姓名|电话|手机号|邮箱|所在地|地点|学校|专业|时间|岗位|角色|组织|公司|经历|技能)[:：]\s*/i, "")
    .trim();

const buildGuidedHelperStatus = (entries: Array<{ label: string; value: string }>) => ({
  recognized: entries.filter((entry) => entry.value).map((entry) => entry.label),
  missing: entries.filter((entry) => !entry.value).map((entry) => entry.label),
});

const createSingleFieldHelperStatus = (label: string) => (value: string) =>
  buildGuidedHelperStatus([{ label, value: value.trim() }]);

const parseOrderedStructuredAnswer = <T extends string>(value: string, fieldOrder: readonly T[]) => {
  const byLine = value.split(/\r?\n/);
  if (byLine.length >= 2) {
    const parsed = {} as Record<T, string>;
    fieldOrder.forEach((field, index) => {
      parsed[field] = stripKnownLabels(byLine[index]?.trim() ?? "");
    });
    return parsed;
  }

  const bySeparator = value.split(/\s*(?:\/|\||｜)\s*/);
  if (bySeparator.length >= 2) {
    const parsed = {} as Record<T, string>;
    fieldOrder.forEach((field, index) => {
      parsed[field] = stripKnownLabels(bySeparator[index]?.trim() ?? "");
    });
    return parsed;
  }

  return null;
};

const CONTACT_FIELD_ORDER = ["phone", "email", "location"] as const;
const EDUCATION_FIELD_ORDER = ["school", "degree", "dateRange"] as const;
const EXPERIENCE_META_FIELD_ORDER = ["organization", "role", "dateRange"] as const;

const mapContactLabelToField = (label: string) => {
  if (label === "电话" || label === "手机号") {
    return "phone" as const;
  }
  if (label === "邮箱") {
    return "email" as const;
  }
  return "location" as const;
};

const parseStructuredContactAnswer = (segments: string[]) => {
  const parsed = {
    phone: "",
    email: "",
    location: "",
  };

  segments.forEach((segment, index) => {
    const fallbackField = CONTACT_FIELD_ORDER[index];
    if (!fallbackField) {
      return;
    }

    const trimmedSegment = segment.trim();
    const labeledMatch = trimmedSegment.match(/^(电话|手机号|邮箱|所在地|地点)[:：]\s*(.*)$/i);

    if (labeledMatch) {
      parsed[mapContactLabelToField(labeledMatch[1])] = labeledMatch[2]?.trim() ?? "";
      return;
    }

    parsed[fallbackField] = stripKnownLabels(trimmedSegment);
  });

  return parsed;
};

const parseContactAnswer = (value: string) => {
  const byLine = value.split(/\r?\n/);
  if (byLine.length >= 2) {
    return parseStructuredContactAnswer(byLine);
  }

  const bySeparator = value.split(/\s*(?:\/|\||｜)\s*/);
  if (bySeparator.length >= 2) {
    return parseStructuredContactAnswer(bySeparator);
  }

  const phone = value.match(/1\d{10}/)?.[0] ?? "";
  const email = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const location =
    value.match(/(?:所在地|地点)[:：]\s*([^\n]+)/)?.[1]?.trim() ??
    value
      .replace(phone, "")
      .replace(email, "")
      .replace(/(电话|手机号|邮箱|所在地|地点)[:：]/g, "")
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .at(-1) ??
    "";

  return { phone, email, location };
};

const getContactHelperStatus = (value: string) => {
  const parsed = parseContactAnswer(value);
  return buildGuidedHelperStatus([
    { label: "电话", value: parsed.phone },
    { label: "邮箱", value: parsed.email },
    { label: "所在地", value: parsed.location },
  ]);
};

const parseEducationAnswer = (value: string) => {
  const structured = parseOrderedStructuredAnswer(value, EDUCATION_FIELD_ORDER);

  if (structured) {
    return structured;
  }

  const dateRange = value.match(/\d{4}[./-]\d{2}\s*[-~至]\s*\d{4}[./-]\d{2}/)?.[0] ?? "";
  const cleaned = value.replace(dateRange, "").trim();
  const school = cleaned.split(/\s+/)[0] ?? "";
  const degree = cleaned.replace(school, "").trim();

  return { school, degree, dateRange };
};

const getEducationHelperStatus = (value: string) => {
  const parsed = parseEducationAnswer(value);
  return buildGuidedHelperStatus([
    { label: "学校", value: parsed.school },
    { label: "专业", value: parsed.degree },
    { label: "时间", value: parsed.dateRange },
  ]);
};

const parseExperienceMetaAnswer = (value: string) => {
  const structured = parseOrderedStructuredAnswer(value, EXPERIENCE_META_FIELD_ORDER);

  if (structured) {
    return structured;
  }

  const dateRange = value.match(/\d{4}[./-]\d{2}\s*[-~至]\s*\d{4}[./-]\d{2}/)?.[0] ?? "";
  const cleaned = value.replace(dateRange, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);

  return {
    organization: parts[0] ?? "",
    role: parts.slice(1).join(" "),
    dateRange,
  };
};

const getExperienceMetaHelperStatus = (value: string) => {
  const parsed = parseExperienceMetaAnswer(value);
  return buildGuidedHelperStatus([
    { label: "组织 / 公司", value: parsed.organization },
    { label: "岗位", value: parsed.role },
    { label: "时间", value: parsed.dateRange },
  ]);
};

const createLocalId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const createEmptyEducation = (): EducationAsset => ({
  id: createLocalId("edu"),
  school: "",
  degree: "",
  dateRange: "",
  tag: "",
  highlights: [],
});

const createEmptyExperience = (section: ExperienceSection): ExperienceAsset => ({
  id: createLocalId("exp"),
  section,
  organization: "",
  organizationNote: "",
  role: "",
  dateRange: "",
  priority: section === "internship" ? 60 : 40,
  locked: false,
  rawNarrative: "",
  bullets: [""],
  linkUrl: "",
  metrics: [],
  tags: [],
  variants: deriveExperienceVariants([]),
});

const experienceHasMetric = (experience: ExperienceAsset) => {
  if ((experience.metrics ?? []).length > 0) {
    return true;
  }

  const searchableText = [
    experience.rawNarrative,
    ...(experience.bullets ?? []),
    ...Object.values(experience.variants ?? {}),
  ].join(" ");

  return /\d/.test(searchableText);
};

const educationHasSignal = (education: EducationAsset) =>
  (education.highlights ?? []).some((highlight) => Boolean(highlight.value?.trim()));

const buildRecognizedContactSummary = (profile: ResumeContentDocument["profile"]) => {
  const recognized: string[] = [];

  if (profile.phone.trim()) {
    recognized.push("电话");
  }

  if (profile.email.trim()) {
    recognized.push("邮箱");
  }

  if (profile.location.trim()) {
    recognized.push("所在地");
  }

  return recognized.length > 0 ? recognized.join("、") : "还没识别到";
};

const buildExperienceCountSummary = (contentDocument: ResumeContentDocument) => {
  const internshipCount = contentDocument.experiences.filter(
    (experience) => (experience.section ?? "internship") === "internship",
  ).length;
  const campusCount = contentDocument.experiences.filter(
    (experience) => experience.section === "campus",
  ).length;
  const totalCount = internshipCount + campusCount;

  if (totalCount === 0) {
    return "还没识别到";
  }

  if (internshipCount > 0 && campusCount > 0) {
    return `已识别 ${totalCount} 段（实习 ${internshipCount}，在校 ${campusCount}）`;
  }

  if (internshipCount > 0) {
    return `已识别 ${internshipCount} 段实习`;
  }

  return `已识别 ${campusCount} 段在校经历`;
};

const buildPasteRecognitionSummary = (contentDocument: ResumeContentDocument) => [
  {
    label: "姓名",
    value: contentDocument.profile.fullName.trim() || "还没识别到",
  },
  {
    label: "目标岗位",
    value: contentDocument.profile.targetRole.trim() || "还没识别到",
  },
  {
    label: "联系方式",
    value: buildRecognizedContactSummary(contentDocument.profile),
  },
  {
    label: "教育经历",
    value:
      contentDocument.education.length > 0
        ? `已识别 ${contentDocument.education.length} 段`
        : "还没识别到",
  },
  {
    label: "经历",
    value: buildExperienceCountSummary(contentDocument),
  },
];

const resolveFollowUpTarget = ({
  activeEducationId,
  activeExperienceId,
  question,
  workspace,
}: {
  activeEducationId: string | null;
  activeExperienceId: string | null;
  question: IntakeQuestionPlan;
  workspace: WorkspaceData;
}): FollowUpTarget | null => {
  if (question.focus === "experience-metrics") {
    const unresolvedExperiences = workspace.experiences.filter(
      (experience) => !experienceHasMetric(experience),
    );
    const targetExperience =
      unresolvedExperiences.find((experience) => experience.id === activeExperienceId) ??
      unresolvedExperiences[0] ??
      workspace.experiences.find((experience) => experience.id === activeExperienceId) ??
      workspace.experiences[0];

    if (!targetExperience) {
      return null;
    }

    const sectionExperiences = workspace.experiences.filter(
      (experience) =>
        (experience.section ?? "internship") === (targetExperience.section ?? "internship"),
    );
    const sectionIndex = sectionExperiences.findIndex(
      (experience) => experience.id === targetExperience.id,
    );
    const labelPrefix =
      (targetExperience.section ?? "internship") === "campus" ? "在校经历" : "实习";

    return {
      kind: "experience",
      itemId: targetExperience.id,
      label: `${labelPrefix} ${sectionIndex + 1}`,
    };
  }

  if (question.focus === "education-signals") {
    const unresolvedEducation = workspace.education.filter(
      (education) => !educationHasSignal(education),
    );
    const targetEducation =
      unresolvedEducation.find((education) => education.id === activeEducationId) ??
      unresolvedEducation[0] ??
      workspace.education.find((education) => education.id === activeEducationId) ??
      workspace.education[0];

    if (!targetEducation) {
      return null;
    }

    const educationIndex = workspace.education.findIndex(
      (education) => education.id === targetEducation.id,
    );

    return {
      kind: "education",
      itemId: targetEducation.id,
      label: `教育 ${educationIndex + 1}`,
    };
  }

  return null;
};

const GUIDED_QUESTION_MAP: Record<
  "full-name" | "target-role" | "contact" | "education" | "experience-basics",
  GuidedQuestion
> = {
  "full-name": {
    key: "full-name",
    prompt: "我们先从你是谁开始。",
    note: "写下简历上要展示的姓名。",
    placeholder: "例如：陈星野",
    helperLines: ["填写项：姓名"],
    getHelperStatus: createSingleFieldHelperStatus("姓名"),
    getValue: (answers) => answers.fullName,
    apply: (answers, value) => ({ ...answers, fullName: value.trim() }),
  },
  "target-role": {
    key: "target-role",
    prompt: "你最想投的岗位是什么？",
    note: "先只写一个最想争取的方向，方便系统收束表达。",
    placeholder: "例如：招聘实习生",
    helperLines: ["填写项：目标岗位"],
    getHelperStatus: createSingleFieldHelperStatus("目标岗位"),
    getValue: (answers) => answers.targetRole,
    apply: (answers, value) => ({ ...answers, targetRole: value.trim() }),
  },
  contact: {
    key: "contact",
    prompt: "把电话、邮箱、所在地一次告诉我。",
    note: "推荐分 3 行填写，也可以用 / 分隔。",
    placeholder: "13800001234\nchenxingye@example.com\n杭州",
    multiline: true,
    helperLines: ["第 1 行：电话", "第 2 行：邮箱", "第 3 行：所在地"],
    getHelperStatus: getContactHelperStatus,
    getValue: (answers) => [answers.phone, answers.email, answers.location].filter(Boolean).join("\n"),
    apply: (answers, value) => ({
      ...answers,
      ...parseContactAnswer(value),
    }),
  },
  education: {
    key: "education",
    prompt: "学校、专业、时间怎么写？",
    note: "推荐分 3 行填写，也可以写成“学校 / 专业 / 时间”。",
    placeholder: "华东师范大学\n人力资源管理\n2022.09-2026.06",
    multiline: true,
    helperLines: [
      "第 1 行：学校",
      "第 2 行：专业",
      "第 3 行：时间",
      "如果还有第二段教育，先填时间最近的一段；起稿后点“新增教育背景”继续补。",
    ],
    getHelperStatus: getEducationHelperStatus,
    getValue: (answers) =>
      [
        answers.education.school,
        answers.education.degree,
        answers.education.dateRange,
      ]
        .filter(Boolean)
        .join("\n"),
    apply: (answers, value) => ({
      ...answers,
      education: parseEducationAnswer(value),
    }),
  },
  "experience-basics": {
    key: "experience-basics",
    prompt: "最重要的一段经历，是在哪里做什么？",
    note: "写组织、岗位、时间，先把骨架立起来。",
    placeholder: "星桥科技\n招聘运营实习生\n2025.10-2026.02",
    multiline: true,
    helperLines: ["第 1 行：组织 / 公司", "第 2 行：岗位", "第 3 行：时间"],
    getHelperStatus: getExperienceMetaHelperStatus,
    getValue: (answers) =>
      [
        answers.topExperience.organization,
        answers.topExperience.role,
        answers.topExperience.dateRange,
      ]
        .filter(Boolean)
        .join("\n"),
    apply: (answers, value) => ({
      ...answers,
      topExperience: {
        ...answers.topExperience,
        ...parseExperienceMetaAnswer(value),
      },
    }),
  },
};

const GUIDED_CORE_ORDER = [
  "full-name",
  "target-role",
  "contact",
  "education",
  "experience-basics",
] as const;

type GuidedCoreFocus = (typeof GUIDED_CORE_ORDER)[number];

const GUIDED_FOCUS_LABELS: Record<GuidedCoreFocus, string> = {
  "full-name": "姓名",
  "target-role": "目标岗位",
  contact: "联系方式",
  education: "教育信息",
  "experience-basics": "经历骨架",
};

const DENSITY_LABELS = {
  airy: "舒展",
  balanced: "均衡",
  tight: "紧凑",
} as const;

const CONTENT_BALANCE_LABELS = {
  sparse: "偏少",
  balanced: "适中",
  dense: "偏满",
} as const;

const TEMPLATE_HERO_LABELS = {
  "classic-banner": "标题更醒目",
  "name-left-photo-right": "信息分布稳",
  "centered-name-minimal": "版头更轻简",
  "split-meta-band": "上下分区更清楚",
  "stacked-profile-card": "档案卡更完整",
} as const satisfies Record<HeroVariant, string>;

const TEMPLATE_EXPERIENCE_LABELS = {
  "stacked-bullets": "经历按条展开",
  "metric-first": "结果放得更前",
  "compact-cards": "经历更紧凑",
  "role-first": "角色切换更清楚",
  "result-callout": "结果摘要更醒目",
} as const satisfies Record<ExperienceVariant, string>;

const TEMPLATE_DENSITY_LABELS = {
  airy: "版面更舒展",
  balanced: "版面更均衡",
  tight: "版面更紧凑",
} as const;

const OVERFLOW_STATUS_LABELS = {
  fits: "通过",
  overflow: "超出",
  "requires-trim": "需删减",
} as const;

const buildTemplateCardHighlights = (manifest: TemplateManifest) =>
  manifest.previewHighlights?.length
    ? manifest.previewHighlights
    : [
        TEMPLATE_HERO_LABELS[manifest.sections.hero.variant],
        TEMPLATE_EXPERIENCE_LABELS[manifest.sections.experience.variant],
        TEMPLATE_DENSITY_LABELS[manifest.compactionPolicy.density],
      ];

const buildTemplatePreviewSectionVariant = (
  manifest: TemplateManifest,
  section: "education" | "experience" | "awards" | "skills",
) => {
  switch (section) {
    case "education":
      return manifest.sections.education.variant;
    case "experience":
      return manifest.sections.experience.variant;
    case "awards":
      return manifest.sections.awards.variant;
    case "skills":
      return manifest.sections.skills.variant;
    default:
      return "";
  }
};

const renderTemplatePreviewDefaultLines = () => (
  <span className="template-card-preview-section-lines">
    <span className="template-card-preview-line template-card-preview-line-strong" />
    <span className="template-card-preview-line" />
    <span className="template-card-preview-line template-card-preview-line-short" />
  </span>
);

const renderTemplatePreviewSectionBody = (
  section: "education" | "experience" | "awards" | "skills",
  variant: string,
) => {
  if (section === "education") {
    if (variant === "signal-grid") {
      return (
        <>
          <span className="template-card-preview-section-bar" />
          <span
            className="template-card-preview-signal-grid"
            data-testid="template-preview-education-signal-grid"
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <span className="template-card-preview-signal-cell" key={`signal-cell-${index}`} />
            ))}
          </span>
          <span className="template-card-preview-section-lines">
            <span className="template-card-preview-line template-card-preview-line-strong" />
            <span className="template-card-preview-line template-card-preview-line-short" />
          </span>
        </>
      );
    }

    if (variant === "school-emphasis") {
      return (
        <>
          <span className="template-card-preview-section-bar" />
          <span
            className="template-card-preview-school-stack"
            data-testid="template-preview-education-school-emphasis"
          >
            <span className="template-card-preview-school-line" />
            <span className="template-card-preview-school-detail-row">
              <span className="template-card-preview-school-date" />
              <span className="template-card-preview-school-detail" />
            </span>
          </span>
        </>
      );
    }

    if (variant === "highlight-strip") {
      return (
        <>
          <span className="template-card-preview-section-bar" />
          <span
            className="template-card-preview-highlight-strip"
            data-testid="template-preview-education-highlight-strip"
          />
          {renderTemplatePreviewDefaultLines()}
        </>
      );
    }

    return (
      <>
        <span className="template-card-preview-section-bar" />
        <span
          className="template-card-preview-compact-rows"
          data-testid="template-preview-education-compact-rows"
        >
          <span className="template-card-preview-row-date" />
          <span className="template-card-preview-row-main" />
        </span>
        {renderTemplatePreviewDefaultLines()}
      </>
    );
  }

  if (section === "awards") {
    if (variant === "two-column-table") {
      return (
        <>
          <span className="template-card-preview-section-bar" />
          <span
            className="template-card-preview-awards-grid"
            data-testid="template-preview-awards-two-column-table"
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <span className="template-card-preview-awards-cell" key={`awards-cell-${index}`} />
            ))}
          </span>
        </>
      );
    }

    if (variant === "pill-row") {
      return (
        <>
          <span className="template-card-preview-section-bar" />
          <span
            className="template-card-preview-pill-row"
            data-testid="template-preview-awards-pill-row"
          >
            {Array.from({ length: 3 }).map((_, index) => (
              <span className="template-card-preview-pill" key={`award-pill-${index}`} />
            ))}
          </span>
        </>
      );
    }

    return (
      <>
        <span className="template-card-preview-section-bar" />
        <span
          className="template-card-preview-inline-list"
          data-testid="template-preview-awards-inline-list"
        >
          <span className="template-card-preview-line template-card-preview-line-strong" />
          <span className="template-card-preview-line template-card-preview-line-short" />
        </span>
      </>
    );
  }

  if (section === "skills") {
    if (variant === "grouped-chips") {
      return (
        <>
          <span className="template-card-preview-section-bar" />
          <span
            className="template-card-preview-chip-cluster"
            data-testid="template-preview-skills-grouped-chips"
          >
            {Array.from({ length: 2 }).map((_, groupIndex) => (
              <span className="template-card-preview-chip-group" key={`chip-group-${groupIndex}`}>
                <span className="template-card-preview-chip-group-label" />
                <span className="template-card-preview-chip-group-row">
                  <span className="template-card-preview-chip" />
                  <span className="template-card-preview-chip" />
                </span>
              </span>
            ))}
          </span>
        </>
      );
    }

    if (variant === "label-columns") {
      return (
        <>
          <span className="template-card-preview-section-bar" />
          <span
            className="template-card-preview-label-columns"
            data-testid="template-preview-skills-label-columns"
          >
            {Array.from({ length: 2 }).map((_, columnIndex) => (
              <span className="template-card-preview-label-column" key={`label-column-${columnIndex}`}>
                <span className="template-card-preview-label-heading" />
                <span className="template-card-preview-label-line" />
              </span>
            ))}
          </span>
        </>
      );
    }

    return (
      <>
        <span className="template-card-preview-section-bar" />
        <span
          className="template-card-preview-tag-row"
          data-testid="template-preview-skills-inline-tags"
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <span className="template-card-preview-pill template-card-preview-pill--small" key={`tag-${index}`} />
          ))}
        </span>
      </>
    );
  }

  return (
    <>
      <span className="template-card-preview-section-bar" />
      {renderTemplatePreviewDefaultLines()}
    </>
  );
};

const renderTemplateCardPreview = (manifest: TemplateManifest) => (
  <span
    aria-hidden="true"
    className={`template-card-preview template-card-preview--${manifest.theme.accentColor}`}
    data-density={manifest.compactionPolicy.density}
    data-experience-variant={manifest.sections.experience.variant}
    data-hero-variant={manifest.sections.hero.variant}
    data-testid={`template-preview-${manifest.templateId}`}
  >
    <span className="template-card-preview-paper">
      <span className={`template-card-preview-hero template-card-preview-hero--${manifest.sections.hero.variant}`}>
        <span className="template-card-preview-band" />
        <span className="template-card-preview-hero-row">
          <span className="template-card-preview-hero-main">
            <span className="template-card-preview-title" />
            <span className="template-card-preview-meta" />
            <span className="template-card-preview-meta template-card-preview-meta-short" />
          </span>
          <span className="template-card-preview-photo" />
        </span>
      </span>
      <span className={`template-card-preview-body template-card-preview-body--${manifest.compactionPolicy.density}`}>
        {manifest.sectionOrder.map((section) => (
          <span
            className={`template-card-preview-section template-card-preview-section--${section} template-card-preview-section-style--${buildTemplatePreviewSectionVariant(manifest, section)}`}
            key={`${manifest.templateId}-${section}`}
          >
            {renderTemplatePreviewSectionBody(
              section,
              buildTemplatePreviewSectionVariant(manifest, section),
            )}
          </span>
        ))}
      </span>
    </span>
  </span>
);

const EDUCATION_HIGHLIGHT_FIELDS = [
  { label: "加权平均分", placeholder: "例如：93.11" },
  { label: "综合排名", placeholder: "例如：3/89" },
  { label: "英语六级", placeholder: "例如：571分" },
  { label: "六级口语", placeholder: "例如：良好" },
  { label: "普通话等级", placeholder: "例如：一乙" },
] as const;

const getEducationHighlightValue = (education: EducationAsset, label: string) =>
  education.highlights?.find((item) => item.label === label)?.value ?? "";

const upsertEducationHighlights = (
  highlights: EducationAsset["highlights"],
  label: string,
  value: string,
) => {
  const trimmed = value.trim();
  const highlightMap = new Map((highlights ?? []).map((item) => [item.label, item.value]));

  if (trimmed) {
    highlightMap.set(label, trimmed);
  } else {
    highlightMap.delete(label);
  }

  const knownLabels = new Set<string>(EDUCATION_HIGHLIGHT_FIELDS.map((item) => item.label));
  const orderedKnown = EDUCATION_HIGHLIGHT_FIELDS.flatMap((item) => {
    const nextValue = highlightMap.get(item.label);
    return nextValue ? [{ label: item.label, value: nextValue }] : [];
  });
  const remaining = [...highlightMap.entries()]
    .filter(([itemLabel]) => !knownLabels.has(itemLabel))
    .map(([itemLabel, itemValue]) => ({ label: itemLabel, value: itemValue }));

  return [...orderedKnown, ...remaining];
};

const downloadTextFile = (filename: string, content: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const recomputeWorkspace = (workspace: WorkspaceData): WorkspaceData => ({
  ...recomputeWorkspaceData({
    ...workspace,
    meta: {
      ...workspace.meta,
      updatedAt: new Date().toISOString(),
    },
  }),
});

const createWorkspaceFromContentDocument = (
  contentDocument: ResumeContentDocument,
): WorkspaceData => {
  const templateSession = deriveInitialTemplateSession();
  const renderState = deriveInitialRenderState(contentDocument);
  const updatedAt = new Date().toISOString();

  return createWorkspaceDataBridge(
    {
      contentDocument,
      templateSession,
      renderState,
      meta: {
        updatedAt,
        firstDraftAt: updatedAt,
      },
    },
    {
      rebalance: true,
    },
  );
};

const buildGuidedAnswersFromContentDocument = (
  contentDocument: ResumeContentDocument,
): GuidedAnswers => {
  const education = contentDocument.education[0];
  const topExperience = contentDocument.experiences[0];

  return {
    fullName: contentDocument.profile.fullName ?? "",
    targetRole: contentDocument.profile.targetRole ?? "",
    phone: contentDocument.profile.phone ?? "",
    email: contentDocument.profile.email ?? "",
    location: contentDocument.profile.location ?? "",
    education: {
      school: education?.school ?? "",
      degree: education?.degree ?? "",
      dateRange: education?.dateRange ?? "",
    },
    topExperience: {
      organization: topExperience?.organization ?? "",
      role: topExperience?.role ?? "",
      dateRange: topExperience?.dateRange ?? "",
      narrative: topExperience?.rawNarrative ?? (topExperience?.bullets ?? []).join("\n"),
    },
    skills: [...contentDocument.skills],
  };
};

const mergeGuidedAnswersIntoContentDocument = (
  contentDocument: ResumeContentDocument,
  answers: GuidedAnswers,
): ResumeContentDocument => {
  const guidedSeed = createBaselineContentDocumentFromGuidedAnswers(answers);
  const hasEducationAnswer = Boolean(
    answers.education.school || answers.education.degree || answers.education.dateRange,
  );
  const hasExperienceAnswer = Boolean(
    answers.topExperience.organization || answers.topExperience.role || answers.topExperience.dateRange,
  );
  const hasNarrativeAnswer = Boolean(answers.topExperience.narrative.trim());

  return {
    ...contentDocument,
    profile: {
      ...contentDocument.profile,
      fullName: answers.fullName || contentDocument.profile.fullName,
      targetRole: answers.targetRole || contentDocument.profile.targetRole,
      phone: answers.phone || contentDocument.profile.phone,
      email: answers.email || contentDocument.profile.email,
      location: answers.location || contentDocument.profile.location,
      preferredLocation: answers.location || contentDocument.profile.preferredLocation,
      summary: guidedSeed.profile.summary,
      compactProfileNote: guidedSeed.profile.compactProfileNote,
    },
    education:
      contentDocument.education.length > 0
        ? contentDocument.education.map((education, index) =>
            index === 0
              ? {
                  ...education,
                  school: answers.education.school || education.school,
                  degree: answers.education.degree || education.degree,
                  dateRange: answers.education.dateRange || education.dateRange,
                }
              : education,
          )
        : hasEducationAnswer
          ? guidedSeed.education
          : [],
    experiences:
      contentDocument.experiences.length > 0
        ? contentDocument.experiences.map((experience, index) =>
            index === 0
              ? {
                  ...experience,
                  organization: answers.topExperience.organization || experience.organization,
                  role: answers.topExperience.role || experience.role,
                  dateRange: answers.topExperience.dateRange || experience.dateRange,
                  rawNarrative: hasNarrativeAnswer
                    ? guidedSeed.experiences[0]?.rawNarrative ?? experience.rawNarrative
                    : experience.rawNarrative,
                  bullets: hasNarrativeAnswer
                    ? guidedSeed.experiences[0]?.bullets ?? experience.bullets
                    : experience.bullets,
                  metrics: hasNarrativeAnswer
                    ? guidedSeed.experiences[0]?.metrics ?? experience.metrics
                    : experience.metrics,
                  variants: hasNarrativeAnswer
                    ? guidedSeed.experiences[0]?.variants ?? experience.variants
                    : experience.variants,
                }
              : experience,
          )
        : hasExperienceAnswer
          ? guidedSeed.experiences
          : [],
    awards: [...contentDocument.awards],
    skills:
      answers.skills.length > 0
        ? [...new Set([...contentDocument.skills, ...answers.skills])]
        : [...contentDocument.skills],
    intake: {
      ...contentDocument.intake,
      mode: "paste",
      turns: [...contentDocument.intake.turns],
    },
    meta: {
      ...contentDocument.meta,
    },
  };
};

const applyTemplateCandidatesToWorkspace = (
  workspace: WorkspaceData,
  candidateManifests: TemplateManifest[],
  nextSelectedTemplateId?: string,
): WorkspaceData => {
  const selectedManifest =
    candidateManifests.find((manifest) => manifest.templateId === nextSelectedTemplateId) ??
    candidateManifests[0];

  if (!selectedManifest) {
    return workspace;
  }

  return {
    ...workspace,
    templateSession: {
      ...workspace.templateSession!,
      candidateManifests,
      candidateTemplateIds: candidateManifests.map((manifest) => manifest.templateId),
      selectedTemplateId: selectedManifest.templateId,
      moduleOrder: ["profile", ...selectedManifest.sectionOrder],
    },
    renderState: {
      ...workspace.renderState!,
      density: selectedManifest.compactionPolicy.density,
    },
  };
};

const promoteTemplateIntoCandidates = (
  candidateManifests: readonly TemplateManifest[],
  templateId: string,
) => {
  const promotedManifest = resolveTemplateManifestById(templateId, candidateManifests);

  return [
    promotedManifest,
    ...candidateManifests.filter((manifest) => manifest.templateId !== promotedManifest.templateId),
  ].slice(0, TEMPLATE_CANDIDATE_COUNT);
};

const createTemplateCandidateRefreshSignature = (contentDocument: ResumeContentDocument) =>
  JSON.stringify({
    profile: {
      fullName: contentDocument.profile.fullName,
      targetRole: contentDocument.profile.targetRole,
      phone: contentDocument.profile.phone,
      email: contentDocument.profile.email,
      location: contentDocument.profile.location,
      preferredLocation: contentDocument.profile.preferredLocation,
      summary: contentDocument.profile.summary,
      compactProfileNote: contentDocument.profile.compactProfileNote,
    },
    education: contentDocument.education.map((item) => ({
      school: item.school,
      degree: item.degree,
      dateRange: item.dateRange,
      tag: item.tag ?? "",
      highlights: (item.highlights ?? []).map((highlight) => ({
        label: highlight.label,
        value: highlight.value,
      })),
    })),
    experiences: contentDocument.experiences.map((item) => ({
      section: item.section ?? "internship",
      organization: item.organization,
      organizationNote: item.organizationNote ?? "",
      role: item.role,
      dateRange: item.dateRange,
      bullets: item.bullets ?? [],
      rawNarrative: item.rawNarrative,
      tags: item.tags ?? [],
    })),
    awards: contentDocument.awards.map((item) => ({
      title: item.title,
      priority: item.priority,
    })),
    skills: contentDocument.skills,
  });

export function ResumeStudio() {
  const [stage, setStage] = useState<Stage>("landing");
  const [editorFlowMode, setEditorFlowMode] = useState<EditorFlowMode>("review");
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [templateCandidateState, setTemplateCandidateState] =
    useState<TemplateCandidateState | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [isPasteGenerating, setIsPasteGenerating] = useState(false);
  const [activeEntryMode, setActiveEntryMode] = useState<"guided" | "paste">("guided");
  const [guidedSourceContentDocument, setGuidedSourceContentDocument] =
    useState<ResumeContentDocument | null>(null);
  const [guidedAnswers, setGuidedAnswers] = useState<GuidedAnswers>(DEFAULT_GUIDED);
  const [guidedQuestionOrder, setGuidedQuestionOrder] = useState<GuidedCoreFocus[]>([
    GUIDED_CORE_ORDER[0],
  ]);
  const [guidedStepIndex, setGuidedStepIndex] = useState(0);
  const [guidedDraftAnswer, setGuidedDraftAnswer] = useState("");
  const [guidedRefinementHint, setGuidedRefinementHint] = useState<string | null>(null);
  const [intakeFollowUpQuestion, setIntakeFollowUpQuestion] = useState<IntakeQuestionPlan | null>(
    null,
  );
  const [followUpDraftAnswer, setFollowUpDraftAnswer] = useState("");
  const [showStarterTemplateOptions, setShowStarterTemplateOptions] = useState(false);
  const [showAdditionalTemplateOptions, setShowAdditionalTemplateOptions] = useState(false);
  const [expandedAdditionalTemplateFamilies, setExpandedAdditionalTemplateFamilies] = useState<
    Partial<Record<TemplateFamilyId, boolean>>
  >({});
  const [activeEducationId, setActiveEducationId] = useState<string | null>(null);
  const [activeExperienceId, setActiveExperienceId] = useState<string | null>(null);
  const [expandedStrengtheningSections, setExpandedStrengtheningSections] = useState<
    Partial<Record<StrengtheningSectionKey, boolean>>
  >({});
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("editor");
  const [previewMeasurement, setPreviewMeasurement] = useState<ResumeMeasurement | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [starterExportLockSignature, setStarterExportLockSignature] = useState<string | null>(null);
  const [experienceBulletDrafts, setExperienceBulletDrafts] = useState<Record<string, string>>({});
  const [experienceSuggestions, setExperienceSuggestions] = useState<
    Record<string, ExperienceSuggestionState>
  >({});
  const statusSectionRef = useRef<HTMLElement | null>(null);
  const educationSectionRef = useRef<HTMLElement | null>(null);
  const experienceSectionRef = useRef<HTMLElement | null>(null);
  const campusSectionRef = useRef<HTMLElement | null>(null);
  const templateGenerationRequestIdRef = useRef(0);
  const templateRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTemplateRefreshSignatureRef = useRef<string | null>(null);
  const initialRestoreLockedRef = useRef(false);
  const followUpSubmissionInFlightRef = useRef(false);

  const trackEvent = async (name: string, payload: Record<string, unknown>) => {
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createAnalyticsEvent(name, payload)),
      });
    } catch {
      // Fire-and-forget analytics.
    }
  };

  useEffect(() => {
    startTransition(() => {
      loadWorkspace().then((stored) => {
        if (!stored || initialRestoreLockedRef.current) {
          return;
        }

        setWorkspace(recomputeWorkspace(stored));
        setEditorFlowMode("review");
        setShowAdditionalTemplateOptions(false);
        setStage("editor");
      });
    });
  }, []);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    void saveWorkspace(workspace);
  }, [workspace]);

  useEffect(() => {
    return () => {
      if (templateRefreshTimerRef.current) {
        clearTimeout(templateRefreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setFollowUpDraftAnswer("");
  }, [intakeFollowUpQuestion?.question]);

  useEffect(() => {
    setExpandedStrengtheningSections({});
  }, [editorFlowMode, intakeFollowUpQuestion?.question]);

  useEffect(() => {
    if (!showAdditionalTemplateOptions) {
      setExpandedAdditionalTemplateFamilies({});
    }
  }, [showAdditionalTemplateOptions]);

  useEffect(() => {
    if (
      editorFlowMode !== "strengthening" ||
      !workspace?.contentDocument ||
      !intakeFollowUpQuestion ||
      followUpSubmissionInFlightRef.current
    ) {
      return;
    }

    const progress = assessIntakeProgress(workspace.contentDocument, { hasDraft: true });
    if (progress.weakAreas.includes(intakeFollowUpQuestion.focus)) {
      return;
    }

    const nextQuestion = buildFallbackInterviewNext({
      contentDocument: workspace.contentDocument,
      hasDraft: true,
    });

    if (!nextQuestion) {
      setIntakeFollowUpQuestion(null);
      setEditorFlowMode("review");
      setStatusMessage("这一条已经补到当前卡片了。");
      return;
    }

    setIntakeFollowUpQuestion(nextQuestion);
    setEditorFlowMode("review");
    setStatusMessage("这一条已经补到当前草稿里了。");
  }, [editorFlowMode, intakeFollowUpQuestion, workspace]);

  const internshipExperiences =
    workspace?.experiences.filter((experience) => (experience.section ?? "internship") === "internship") ??
    [];
  const campusExperiences =
    workspace?.experiences.filter((experience) => experience.section === "campus") ?? [];
  const followUpTarget =
    workspace && intakeFollowUpQuestion
      ? resolveFollowUpTarget({
          activeEducationId,
          activeExperienceId,
          question: intakeFollowUpQuestion,
          workspace,
        })
      : null;
  const focusedStrengtheningSection: StrengtheningSectionKey | null =
    editorFlowMode !== "strengthening" || !intakeFollowUpQuestion
      ? null
      : intakeFollowUpQuestion.focus === "education-signals"
        ? "education"
        : intakeFollowUpQuestion.focus === "experience-metrics"
          ? (
              workspace?.experiences.find((experience) => experience.id === followUpTarget?.itemId)
                ?.section ?? "internship"
            ) === "campus"
            ? "campus"
            : "internship"
          : null;
  const guidedQuestionFocus = guidedQuestionOrder[guidedStepIndex] ?? GUIDED_CORE_ORDER[0];
  const guidedQuestion = GUIDED_QUESTION_MAP[guidedQuestionFocus];
  const guidedCommittedAnswers = guidedQuestion.apply(guidedAnswers, guidedDraftAnswer);
  const guidedActionWillCreateDraft = assessIntakeProgress(
    activeEntryMode === "paste" && guidedSourceContentDocument
      ? mergeGuidedAnswersIntoContentDocument(guidedSourceContentDocument, guidedCommittedAnswers)
      : createBaselineContentDocumentFromGuidedAnswers(guidedCommittedAnswers),
    {
      hasDraft: false,
    },
  ).minimumDraftReady;
  const guidedHelperStatus = guidedQuestion.getHelperStatus?.(guidedDraftAnswer) ?? null;
  const guidedHelperBlock =
    guidedQuestion.helperLines?.length || guidedHelperStatus ? (
      <div className="guided-helper-block">
        {guidedQuestion.helperLines?.length ? (
          <div className="guided-helper-lines">
            {guidedQuestion.helperLines.map((line) => (
              <p key={line} className="field-helper-copy">
                {line}
              </p>
            ))}
          </div>
        ) : null}
        {guidedHelperStatus ? (
          <div className="guided-helper-status">
            {guidedHelperStatus.recognized.length ? (
              <span className="field-helper-inline">
                已识别：{guidedHelperStatus.recognized.join("、")}
              </span>
            ) : null}
            {guidedHelperStatus.missing.length ? (
              <span className="field-helper-inline">
                待补：{guidedHelperStatus.missing.join("、")}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : null;

  const updateWorkspace = (updater: (current: WorkspaceData) => WorkspaceData) => {
    setWorkspace((current) => {
      if (!current) {
        return current;
      }

      return recomputeWorkspace(updater(current));
    });
  };

  const resetEditorState = () => {
    setMobilePanel("editor");
    setPreviewMeasurement(null);
    setExperienceBulletDrafts({});
    setExperienceSuggestions({});
    setExpandedStrengtheningSections({});
    setShowStarterTemplateOptions(false);
  };

  const createGuidedContentDocument = (answers: GuidedAnswers) =>
    activeEntryMode === "paste" && guidedSourceContentDocument
      ? mergeGuidedAnswersIntoContentDocument(guidedSourceContentDocument, answers)
      : createBaselineContentDocumentFromGuidedAnswers(answers);

  const requestInterviewQuestion = async (
    contentDocument: ResumeContentDocument,
    hasDraft: boolean,
  ) => {
    try {
      const response = await fetch("/api/ai/interview-next", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentDocument,
          hasDraft,
        }),
      });
      const payload = (await response.json()) as Partial<IntakeQuestionPlan> & {
        nextQuestion?: null;
      };

      if (response.ok && "nextQuestion" in payload && payload.nextQuestion === null) {
        return null;
      }

      if (
        response.ok &&
        payload.question &&
        payload.reason &&
        payload.suggestion &&
        payload.focus &&
        payload.stage
      ) {
        return payload as IntakeQuestionPlan;
      }
    } catch {
      // Fall through to local fallback.
    }

    return buildFallbackInterviewNext({
      contentDocument,
      hasDraft,
    });
  };

  const requestExtractedContent = async (text: string) => {
    try {
      const response = await fetch("/api/ai/extract-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entryMode: "paste",
          text,
        }),
      });
      const payload = (await response.json()) as {
        contentDocument?: ResumeContentDocument;
        intake?: IntakeProgress;
      };

      if (response.ok && payload.contentDocument && payload.intake) {
        return {
          contentDocument: payload.contentDocument,
          intake: payload.intake,
        };
      }
    } catch {
      // Fall through to local extraction.
    }

    const contentDocument = extractContentFallback({
      entryMode: "paste",
      text,
    });
    return {
      contentDocument,
      intake: assessIntakeProgress(contentDocument, { hasDraft: false }),
    };
  };

  const requestTemplateCandidates = useCallback(async (
    contentDocument: ResumeContentDocument,
  ): Promise<{
    candidates: TemplateManifest[];
    state: TemplateCandidateState;
  }> => {
    try {
      const response = await fetch("/api/ai/generate-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentDocument,
          targetRole: contentDocument.profile.targetRole,
        }),
      });
      const payload = (await response.json()) as {
        mode?: TemplateCandidateSourceMode;
        message?: string;
        candidates?: unknown[];
      };

      if (response.ok && Array.isArray(payload.candidates)) {
        return {
          candidates: finalizeTemplateManifestCandidates(payload.candidates),
          state: {
            mode: payload.mode ?? "fallback",
            message: payload.mode === "rate_limited" ? payload.message : undefined,
          },
        };
      }

      if (payload.mode === "rate_limited") {
        return {
          candidates: buildFallbackTemplateCandidates(),
          state: {
            mode: "rate_limited",
            message: payload.message,
          },
        };
      }
    } catch {
      // Fall through to baseline candidates.
    }

    return {
      candidates: buildFallbackTemplateCandidates(),
      state: {
        mode: "fallback",
        message: undefined,
      },
    };
  }, []);

  const scheduleTemplateCandidateRefresh = useCallback((
    contentDocument: ResumeContentDocument,
    requestStartSelectedTemplateId?: string,
    options?: {
      debounceMs?: number;
      signature?: string;
    },
  ) => {
    const signature =
      options?.signature ?? createTemplateCandidateRefreshSignature(contentDocument);
    const runRefresh = () => {
      const requestId = templateGenerationRequestIdRef.current + 1;
      templateGenerationRequestIdRef.current = requestId;
      lastTemplateRefreshSignatureRef.current = signature;
      setTemplateCandidateState({
        mode: "loading",
      });

      void requestTemplateCandidates(contentDocument).then(({ candidates, state }) => {
        if (templateGenerationRequestIdRef.current !== requestId) {
          return;
        }

        setTemplateCandidateState(state);
        setWorkspace((current) => {
          if (!current || templateGenerationRequestIdRef.current !== requestId) {
            return current;
          }

          const currentSelectedTemplateId = current.templateSession?.selectedTemplateId;
          const selectionChangedDuringRequest =
            Boolean(requestStartSelectedTemplateId) &&
            currentSelectedTemplateId !== requestStartSelectedTemplateId;
          const currentSelectionExistsInCandidates = candidates.some(
            (manifest) => manifest.templateId === currentSelectedTemplateId,
          );

          if (selectionChangedDuringRequest && !currentSelectionExistsInCandidates) {
            return current;
          }

          return recomputeWorkspace(
            applyTemplateCandidatesToWorkspace(
              current,
              candidates,
              currentSelectedTemplateId,
            ),
          );
        });
      });
    };

    if (templateRefreshTimerRef.current) {
      clearTimeout(templateRefreshTimerRef.current);
      templateRefreshTimerRef.current = null;
    }

    if (options?.debounceMs && options.debounceMs > 0) {
      templateRefreshTimerRef.current = setTimeout(() => {
        templateRefreshTimerRef.current = null;
        runRefresh();
      }, options.debounceMs);
      return;
    }

    runRefresh();
  }, [requestTemplateCandidates]);

  useEffect(() => {
    if (stage !== "editor" || !workspace?.contentDocument) {
      if (templateRefreshTimerRef.current) {
        clearTimeout(templateRefreshTimerRef.current);
        templateRefreshTimerRef.current = null;
      }
      return;
    }

    const signature = createTemplateCandidateRefreshSignature(workspace.contentDocument);
    if (lastTemplateRefreshSignatureRef.current === signature) {
      return;
    }

    scheduleTemplateCandidateRefresh(
      workspace.contentDocument,
      workspace.templateSession?.selectedTemplateId,
      {
        debounceMs: 400,
        signature,
      },
    );
  }, [
    stage,
    workspace?.contentDocument,
    workspace?.templateSession?.selectedTemplateId,
    scheduleTemplateCandidateRefresh,
  ]);

  useEffect(() => {
    if (!starterExportLockSignature || !workspace?.contentDocument) {
      return;
    }

    const nextSignature = createTemplateCandidateRefreshSignature(workspace.contentDocument);
    if (nextSignature !== starterExportLockSignature) {
      setStarterExportLockSignature(null);
    }
  }, [starterExportLockSignature, workspace?.contentDocument]);

  const moveToGuidedQuestion = (
    nextFocus: GuidedCoreFocus,
    answers: GuidedAnswers,
  ) => {
    const nextQuestion = GUIDED_QUESTION_MAP[nextFocus];
    const baseOrder = guidedQuestionOrder.slice(0, guidedStepIndex + 1);
    const existingIndex = baseOrder.indexOf(nextFocus);
    const nextIndex = existingIndex >= 0 ? existingIndex : baseOrder.length;

    setGuidedQuestionOrder(existingIndex >= 0 ? baseOrder : [...baseOrder, nextFocus]);
    setGuidedStepIndex(nextIndex);
    setGuidedDraftAnswer(nextQuestion.getValue(answers));
    setGuidedRefinementHint(
      nextFocus === guidedQuestionFocus
        ? `这一项还需要更具体一点，先把${GUIDED_FOCUS_LABELS[nextFocus]}写准。`
        : null,
    );
  };

  const getExperienceBulletDraftValue = (experience: ExperienceAsset) =>
    experienceBulletDrafts[experience.id] ?? (experience.bullets ?? []).join("\n");

  const handleEnterGuided = () => {
    initialRestoreLockedRef.current = true;
    setIsPasteGenerating(false);
    setTemplateCandidateState(null);
    setActiveEntryMode("guided");
    setEditorFlowMode("review");
    setGuidedSourceContentDocument(null);
    setGuidedAnswers(DEFAULT_GUIDED);
    setGuidedQuestionOrder([GUIDED_CORE_ORDER[0]]);
    setGuidedStepIndex(0);
    setGuidedDraftAnswer(GUIDED_QUESTION_MAP["full-name"].getValue(DEFAULT_GUIDED));
    setGuidedRefinementHint(null);
    setIntakeFollowUpQuestion(null);
    setActiveEducationId(null);
    setActiveExperienceId(null);
    setShowAdditionalTemplateOptions(false);
    setStarterExportLockSignature(null);
    resetEditorState();
    setStatusMessage(null);
    setStage("guided");
  };

  const handleEnterPaste = () => {
    initialRestoreLockedRef.current = true;
    setIsPasteGenerating(false);
    setTemplateCandidateState(null);
    setActiveEntryMode("paste");
    setEditorFlowMode("review");
    setActiveEducationId(null);
    setActiveExperienceId(null);
    setGuidedRefinementHint(null);
    setShowAdditionalTemplateOptions(false);
    setStarterExportLockSignature(null);
    setStage("paste");
  };

  const handleReturnToPasteSource = () => {
    initialRestoreLockedRef.current = true;
    setIsPasteGenerating(false);
    if (templateRefreshTimerRef.current) {
      clearTimeout(templateRefreshTimerRef.current);
      templateRefreshTimerRef.current = null;
    }
    templateGenerationRequestIdRef.current += 1;
    lastTemplateRefreshSignatureRef.current = null;
    setTemplateCandidateState(null);
    setActiveEntryMode("paste");
    setWorkspace(null);
    setEditorFlowMode("review");
    setGuidedSourceContentDocument(null);
    setGuidedRefinementHint(null);
    setIntakeFollowUpQuestion(null);
    setActiveEducationId(null);
    setActiveExperienceId(null);
    setShowStarterTemplateOptions(false);
    setShowAdditionalTemplateOptions(false);
    setStarterExportLockSignature(null);
    resetEditorState();
    setStatusMessage(null);
    setStage("paste");
    void clearWorkspace();
  };

  const handleStartStrengthening = async () => {
    if (!workspace?.contentDocument) {
      return;
    }

    const nextQuestion = await requestInterviewQuestion(workspace.contentDocument, true);
    setIntakeFollowUpQuestion(nextQuestion);

    if (nextQuestion) {
      setShowStarterTemplateOptions(false);
      setShowAdditionalTemplateOptions(false);
      setEditorFlowMode("strengthening");
      setStatusMessage("先继续把这版补顺，再回头整体看看。");
      return;
    }

    setStarterExportLockSignature(null);
    setEditorFlowMode("review");
    setStatusMessage("这版已经没有必须继续补的缺口了。");
  };

  const handleResumeStrengthening = () => {
    if (!intakeFollowUpQuestion) {
      return;
    }

    setMobilePanel("editor");
    setShowStarterTemplateOptions(false);
    setShowAdditionalTemplateOptions(false);
    setEditorFlowMode("strengthening");
    setStatusMessage("继续补下一条最值得补的信息。");
  };

  const handlePreviewCurrentDraft = () => {
    setMobilePanel("preview");
    setStatusMessage("先整体看一眼这版；如果还想继续补，再点“继续补下一条”。");
  };

  const handleGuidedNext = () => {
    const committedAnswers = guidedQuestion.apply(guidedAnswers, guidedDraftAnswer);
    setGuidedAnswers(committedAnswers);

    const contentDocument = createGuidedContentDocument(committedAnswers);
    const progress = assessIntakeProgress(contentDocument, {
      hasDraft: false,
    });

    if (progress.minimumDraftReady) {
      const nextWorkspace = createWorkspaceFromContentDocument(contentDocument);
      const nextProgress = assessIntakeProgress(contentDocument, { hasDraft: true });
      setWorkspace(nextWorkspace);
      setTemplateCandidateState({
        mode: "baseline",
      });
      setIntakeFollowUpQuestion(null);
      setEditorFlowMode(nextProgress.weakAreas.length > 0 ? "starter" : "review");
      setStarterExportLockSignature(
        nextProgress.weakAreas.length > 0
          ? createTemplateCandidateRefreshSignature(contentDocument)
          : null,
      );
      scheduleTemplateCandidateRefresh(
        contentDocument,
        nextWorkspace.templateSession?.selectedTemplateId,
      );
      setGuidedSourceContentDocument(null);
      setGuidedRefinementHint(null);
      setShowAdditionalTemplateOptions(false);
      resetEditorState();
      setStage("editor");
      setStatusMessage("已根据引导问答整理出第一版简历。");
      void trackEvent("draft_created", {
        entryMode: activeEntryMode,
        density: nextWorkspace.layoutPlan.density,
        hiddenExperienceIds: nextWorkspace.layoutPlan.hiddenExperienceIds,
      });
      return;
    }

    const nextFocus = (listMissingCoreAreas(contentDocument)[0] ??
      GUIDED_CORE_ORDER.find((focus) => !guidedQuestionOrder.includes(focus))) as
      | GuidedCoreFocus
      | undefined;
    if (nextFocus) {
      moveToGuidedQuestion(nextFocus, committedAnswers);
    }
  };

  const handleGuidedBack = () => {
    const committedAnswers = guidedQuestion.apply(guidedAnswers, guidedDraftAnswer);
    setGuidedAnswers(committedAnswers);

    if (guidedStepIndex === 0) {
      setStage("landing");
      setGuidedDraftAnswer("");
      setGuidedRefinementHint(null);
      return;
    }

    const previousIndex = guidedStepIndex - 1;
    const previousFocus = guidedQuestionOrder[previousIndex] ?? GUIDED_CORE_ORDER[0];
    setGuidedStepIndex(previousIndex);
    setGuidedDraftAnswer(GUIDED_QUESTION_MAP[previousFocus].getValue(committedAnswers));
    setGuidedRefinementHint(null);
  };

  const handleGenerateFromPaste = async () => {
    if (!pasteText.trim() || isPasteGenerating) {
      return;
    }

    setIsPasteGenerating(true);

    try {
      const { contentDocument, intake } = await requestExtractedContent(pasteText);
      setActiveEntryMode("paste");

      if (!intake.minimumDraftReady) {
        const nextFocus = (listMissingCoreAreas(contentDocument)[0] ??
          GUIDED_CORE_ORDER[0]) as GuidedCoreFocus;
        const nextGuidedAnswers = buildGuidedAnswersFromContentDocument(contentDocument);
        setWorkspace(null);
        setIntakeFollowUpQuestion(null);
        setGuidedSourceContentDocument(contentDocument);
        setGuidedAnswers(nextGuidedAnswers);
        setGuidedQuestionOrder([nextFocus]);
        setGuidedStepIndex(0);
        setGuidedDraftAnswer(GUIDED_QUESTION_MAP[nextFocus].getValue(nextGuidedAnswers));
        setGuidedRefinementHint(null);
        setShowAdditionalTemplateOptions(false);
        setStarterExportLockSignature(null);
        resetEditorState();
        setStage("guided");
        setStatusMessage("已先抽取可用信息，继续补齐后再整理骨架。");
        return;
      }

      const next = createWorkspaceFromContentDocument(contentDocument);
      const nextProgress = assessIntakeProgress(contentDocument, { hasDraft: true });
      setWorkspace(next);
      setTemplateCandidateState({
        mode: "baseline",
      });
      setIntakeFollowUpQuestion(null);
      setEditorFlowMode(nextProgress.weakAreas.length > 0 ? "starter" : "review");
      setStarterExportLockSignature(
        nextProgress.weakAreas.length > 0
          ? createTemplateCandidateRefreshSignature(contentDocument)
          : null,
      );
      scheduleTemplateCandidateRefresh(contentDocument, next.templateSession?.selectedTemplateId);
      setGuidedRefinementHint(null);
      setShowAdditionalTemplateOptions(false);
      resetEditorState();
      setStage("editor");
      setStatusMessage("已从现有材料整理出第一版简历。");
      void trackEvent("draft_created", {
        entryMode: "paste",
        density: next.layoutPlan.density,
        hiddenExperienceIds: next.layoutPlan.hiddenExperienceIds,
      });
    } finally {
      setIsPasteGenerating(false);
    }
  };

  const applyFollowUpAnswerToWorkspace = (
    currentWorkspace: WorkspaceData,
    question: IntakeQuestionPlan,
    target: FollowUpTarget | null,
    answer: string,
  ): WorkspaceData => {
    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      return currentWorkspace;
    }

    if (question.focus === "experience-metrics") {
      const targetExperience =
        currentWorkspace.experiences.find((experience) => experience.id === target?.itemId) ??
        currentWorkspace.experiences[0];
      if (!targetExperience) {
        return currentWorkspace;
      }

      const bullets = normalizeExperienceBullets([
        ...(targetExperience.bullets ?? []),
        trimmedAnswer,
      ]);

      return {
        ...currentWorkspace,
        experiences: currentWorkspace.experiences.map((experience) =>
          experience.id === targetExperience.id
            ? {
                ...experience,
                bullets,
                rawNarrative: buildExperienceNarrative(bullets),
                metrics: extractExperienceMetrics(bullets),
                variants: deriveExperienceVariants(bullets),
              }
            : experience,
        ),
      };
    }

    if (question.focus === "skills-specificity") {
      const nextSkills = trimmedAnswer
        .split(/[、,/，\n]/)
        .map((item) => item.trim())
        .filter(Boolean);

      return {
        ...currentWorkspace,
        skills: [...new Set([...currentWorkspace.skills, ...nextSkills])],
      };
    }

    if (question.focus === "education-signals") {
      const targetEducation =
        currentWorkspace.education.find((education) => education.id === target?.itemId) ??
        currentWorkspace.education[0];
      if (!targetEducation) {
        return currentWorkspace;
      }

      return {
        ...currentWorkspace,
        education: currentWorkspace.education.map((education) =>
          education.id === targetEducation.id
            ? {
                ...education,
                highlights: upsertEducationHighlights(
                  education.highlights,
                  "补充亮点",
                  trimmedAnswer,
                ),
              }
            : education,
        ),
      };
    }

    return currentWorkspace;
  };

  const handleSubmitFollowUpAnswer = async () => {
    if (!workspace || !intakeFollowUpQuestion || !followUpDraftAnswer.trim()) {
      return;
    }

    followUpSubmissionInFlightRef.current = true;

    try {
      const nextWorkspace = recomputeWorkspace(
        applyFollowUpAnswerToWorkspace(
          workspace,
          intakeFollowUpQuestion,
          followUpTarget,
          followUpDraftAnswer,
        ),
      );
      const nextContentDocument = nextWorkspace.contentDocument;

      setWorkspace(nextWorkspace);

      if (!nextContentDocument) {
        setIntakeFollowUpQuestion(null);
        return;
      }

      const progress = assessIntakeProgress(nextContentDocument, { hasDraft: true });
      if (progress.weakAreas.length === 0) {
        setIntakeFollowUpQuestion(null);
        setEditorFlowMode("review");
        setStatusMessage("这版的薄弱项已经补得更完整了。");
        return;
      }

      setIntakeFollowUpQuestion(await requestInterviewQuestion(nextContentDocument, true));
      setEditorFlowMode("review");
      setStatusMessage("已先把这一条写进当前草稿。");
    } finally {
      followUpSubmissionInFlightRef.current = false;
    }
  };

  const handlePhotoChange = (photo: NonNullable<WorkspaceData["profile"]["photo"]>) => {
    updateWorkspace((current) => ({
      ...current,
      profile: {
        ...current.profile,
        photo,
      },
    }));
    setStatusMessage("证件照已更新，成品版式已同步刷新。");
  };

  const clearExperienceSuggestion = (experienceId: string) => {
    setExperienceSuggestions((current) => {
      if (!current[experienceId]) {
        return current;
      }

      const next = { ...current };
      delete next[experienceId];
      return next;
    });
  };

  const handleEducationChange = (
    educationId: string,
    field: keyof Pick<EducationAsset, "school" | "degree" | "dateRange" | "tag">,
    value: string,
  ) => {
    setActiveEducationId(educationId);
    updateWorkspace((current) => ({
      ...current,
      education: current.education.map((item) =>
        item.id === educationId ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const handleEducationHighlightChange = (
    educationId: string,
    label: string,
    value: string,
  ) => {
    setActiveEducationId(educationId);
    updateWorkspace((current) => ({
      ...current,
      education: current.education.map((item) =>
        item.id === educationId
          ? {
              ...item,
              highlights: upsertEducationHighlights(item.highlights, label, value),
            }
          : item,
      ),
    }));
  };

  const handleAddEducation = () => {
    const nextEducation = createEmptyEducation();
    setActiveEducationId(nextEducation.id);
    updateWorkspace((current) => ({
      ...current,
      education: [...current.education, nextEducation],
    }));
    setStatusMessage("已新增一条教育背景。");
  };

  const handleRemoveEducation = (educationId: string) => {
    if (activeEducationId === educationId) {
      setActiveEducationId(null);
    }
    updateWorkspace((current) => ({
      ...current,
      education: current.education.filter((item) => item.id !== educationId),
    }));
    setStatusMessage("已删除这条教育背景。");
  };

  const handleExperienceFieldChange = (
    experienceId: string,
    field:
      | "organization"
      | "organizationNote"
      | "role"
      | "dateRange"
      | "linkUrl",
    value: string,
  ) => {
    setActiveExperienceId(experienceId);
    clearExperienceSuggestion(experienceId);
    updateWorkspace((current) => ({
      ...current,
      experiences: current.experiences.map((experience) =>
        experience.id === experienceId ? { ...experience, [field]: value } : experience,
      ),
    }));
  };

  const handleExperienceBulletsChange = (experienceId: string, value: string) => {
    setActiveExperienceId(experienceId);
    setExperienceBulletDrafts((current) => ({
      ...current,
      [experienceId]: value,
    }));

    const bullets = normalizeExperienceBullets(value);
    const metrics = extractExperienceMetrics(bullets);
    const variants = deriveExperienceVariants(bullets);

    clearExperienceSuggestion(experienceId);

    updateWorkspace((current) => ({
      ...current,
      experiences: current.experiences.map((experience) =>
        experience.id === experienceId
          ? {
              ...experience,
              bullets,
              rawNarrative: buildExperienceNarrative(bullets),
              metrics,
              variants,
            }
          : experience,
      ),
      renderState: {
        ...current.renderState!,
        selectedVariants: {
          ...current.renderState!.selectedVariants,
          [experienceId]: "standard",
        },
      },
    }));
  };

  const handleExperienceBulletsBlur = (experienceId: string) => {
    setExperienceBulletDrafts((current) => {
      const rawValue = current[experienceId];
      if (rawValue === undefined) {
        return current;
      }

      const normalized = normalizeExperienceBullets(rawValue).join("\n");
      const next = { ...current };

      if (!normalized) {
        next[experienceId] = "";
        return next;
      }

      if (next[experienceId] === normalized) {
        delete next[experienceId];
        return next;
      }

      next[experienceId] = normalized;
      return next;
    });
  };

  const handleAddExperience = (section: ExperienceSection) => {
    const nextExperience = createEmptyExperience(section);
    setActiveExperienceId(nextExperience.id);
    updateWorkspace((current) => ({
      ...current,
      experiences: [...current.experiences, nextExperience],
      renderState: {
        ...current.renderState!,
        selectedVariants: {
          ...current.renderState!.selectedVariants,
          [nextExperience.id]: "standard",
        },
      },
    }));
    setStatusMessage(`已新增一条${section === "internship" ? "实习经历" : "在校经历"}。`);
  };

  const handleRemoveExperience = (experienceId: string) => {
    if (activeExperienceId === experienceId) {
      setActiveExperienceId(null);
    }
    updateWorkspace((current) => {
      const nextSelectedVariants = { ...current.renderState!.selectedVariants };
      delete nextSelectedVariants[experienceId];

      return {
        ...current,
        experiences: current.experiences.filter((experience) => experience.id !== experienceId),
        renderState: {
          ...current.renderState!,
          selectedVariants: nextSelectedVariants,
          hiddenExperienceIds: current.renderState!.hiddenExperienceIds.filter((id) => id !== experienceId),
          lockedExperienceIds: current.renderState!.lockedExperienceIds.filter((id) => id !== experienceId),
        },
      };
    });
    setExperienceBulletDrafts((current) => {
      const next = { ...current };
      delete next[experienceId];
      return next;
    });
    clearExperienceSuggestion(experienceId);
    setStatusMessage("已删除这条经历。");
  };

  const handleAiRewrite = async (experienceId: string) => {
    const experience = workspace?.experiences.find((item) => item.id === experienceId);
    if (!experience) {
      return;
    }

    setExperienceSuggestions((current) => ({
      ...current,
      [experienceId]: {
        status: "generating",
      },
    }));
    setStatusMessage("正在整理更顺的写法...");
    try {
      const response = await fetch("/api/ai/rewrite-experience", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetRole: workspace?.profile.targetRole,
          experience,
        }),
      });

      const payload = (await response.json()) as {
        suggestedBullets?: string[];
        variants?: ExperienceAsset["variants"];
        rationale?: string;
        followUpPrompt?: string;
        message?: string;
        mode?: "anthropic" | "fallback" | "rate_limited";
      };

      if (!response.ok || !payload.suggestedBullets || payload.suggestedBullets.length === 0) {
        throw new Error(payload.message ?? "这次没整理出建议稿，请稍后再试。");
      }

      const suggestedBullets = normalizeExperienceBullets(payload.suggestedBullets);

      setExperienceSuggestions((current) => ({
        ...current,
        [experienceId]: {
          status: "ready",
          suggestion: {
            suggestedBullets,
            variants:
              payload.variants ?? deriveExperienceVariants(suggestedBullets),
            rationale: payload.rationale,
            followUpPrompt: payload.followUpPrompt,
          },
          mode: payload.mode,
        },
      }));
      setStatusMessage(
        payload.mode === "fallback"
          ? "建议稿已准备好，确认后再应用到经历要点。"
          : "建议稿已生成，可以确认后应用到经历要点。",
      );
    } catch (error) {
      setExperienceSuggestions((current) => ({
        ...current,
        [experienceId]: {
          status: "apply_failed",
          message: error instanceof Error ? error.message : "这次没整理出建议稿，请稍后再试。",
        },
      }));
      setStatusMessage(error instanceof Error ? error.message : "这次没整理出建议稿，请稍后再试。");
    }
  };

  const handleApplyAiSuggestion = (experienceId: string) => {
    const suggestion = experienceSuggestions[experienceId]?.suggestion;
    if (!suggestion) {
      return;
    }

    const bullets = normalizeExperienceBullets(suggestion.suggestedBullets);
    setActiveExperienceId(experienceId);
    updateWorkspace((current) => ({
      ...current,
      experiences: current.experiences.map((experience) =>
        experience.id === experienceId
          ? {
              ...experience,
              bullets,
              rawNarrative: buildExperienceNarrative(bullets),
              metrics: extractExperienceMetrics(bullets),
              variants: suggestion.variants,
            }
          : experience,
      ),
      renderState: {
        ...current.renderState!,
        selectedVariants: {
          ...current.renderState!.selectedVariants,
          [experienceId]: "standard",
        },
      },
    }));
    setExperienceBulletDrafts((current) => {
      const next = { ...current };
      delete next[experienceId];
      return next;
    });
    clearExperienceSuggestion(experienceId);
    setStatusMessage("建议稿已应用到经历要点。");
  };

  const handleExportHtml = () => {
    if (!workspace) {
      return;
    }

    downloadTextFile("resume.html", exportResumeHtml(workspace), "text/html;charset=utf-8");
    void trackEvent("export_clicked", {
      exportType: "html",
      density: workspace.layoutPlan.density,
      hiddenExperienceIds: workspace.layoutPlan.hiddenExperienceIds,
    });
  };

  const handlePrintPdf = () => {
    if (!workspace) {
      return;
    }

    try {
      printToPdf(workspace);
      void trackEvent("export_clicked", {
        exportType: "pdf",
        density: workspace.layoutPlan.density,
        hiddenExperienceIds: workspace.layoutPlan.hiddenExperienceIds,
      });
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "打印 PDF 失败，请稍后再试。");
    }
  };

  const handleTemplateSwitch = (templateId: string) => {
    updateWorkspace((current) =>
      applyTemplateCandidatesToWorkspace(
        current,
        current.templateSession?.candidateManifests ?? buildFallbackTemplateCandidates(),
        templateId,
      ),
    );
    setStatusMessage("已换成另一种版式，内容没有变。");
  };

  const handleAdditionalTemplatePromote = (templateId: string) => {
    updateWorkspace((current) =>
      applyTemplateCandidatesToWorkspace(
        current,
        promoteTemplateIntoCandidates(
          current.templateSession?.candidateManifests ?? buildFallbackTemplateCandidates(),
          templateId,
        ),
        templateId,
      ),
    );
    setStatusMessage("已把这套版式放进推荐位，方便继续比较。");
  };

  const templateCandidateNote =
    templateCandidateState?.mode === "anthropic"
      ? "已根据当前内容整理出一组更贴近这版简历的版式候选。"
      : templateCandidateState?.mode === "loading"
        ? "正在根据当前内容刷新版式候选；现在先看这一组更贴近这版内容的方案。"
        : templateCandidateState?.mode === "fallback" ||
            templateCandidateState?.mode === "baseline"
          ? "已先给你几种版式候选，先看看哪套更适合这版内容。"
          : templateCandidateState?.mode === "rate_limited"
            ? templateCandidateState.message ?? "当前请求较多，先看这一组更贴近这版内容的版式候选。"
            : null;

  const exportBlocked = !workspace;
  const starterExportBlocked =
    exportBlocked || editorFlowMode === "starter" || Boolean(starterExportLockSignature);
  const starterBlockCopy =
    activeEntryMode === "paste"
      ? "旧材料已经整理成第一版简历，现在可以继续完善。"
      : "现在已经有第一版简历，可以继续完善。";
  const templateBlockCopy =
    editorFlowMode === "starter"
      ? "这里先给你 3 种版式，先看哪种更适合你的内容；切换不会改动你的内容。"
      : "先把内容补顺；需要时再看看哪套版式更适合这版简历。切换版式不会改动你的内容。";
  const pasteRecognitionSummary =
    activeEntryMode === "paste" && workspace?.contentDocument
      ? buildPasteRecognitionSummary(workspace.contentDocument)
      : null;
  const guidedPreviewAnswers = guidedQuestion.apply(guidedAnswers, guidedDraftAnswer);
  const guidedPreviewWorkspace =
    stage === "guided"
      ? createWorkspaceFromContentDocument(createGuidedContentDocument(guidedPreviewAnswers))
      : null;
  const layoutAdvice = workspace ? buildLayoutAdvice(workspace, previewMeasurement) : null;

  const handleApplyLayoutSuggestion = (suggestion: LayoutSuggestion) => {
    setPreviewMeasurement(null);
    updateWorkspace((current) => applyLayoutSuggestion(current, suggestion));
    setStatusMessage(`已应用建议：${suggestion.title}`);
  };

  const handleApplyLayoutSuggestionSequence = (suggestions: LayoutSuggestion[]) => {
    if (suggestions.length === 0) {
      return;
    }

    setPreviewMeasurement(null);
    updateWorkspace((current) => applyLayoutSuggestionSequence(current, suggestions));
    setStatusMessage(`已按预演顺序应用 ${suggestions.length} 条建议。`);
  };

  const describeDensity = (density: WorkspaceData["layoutPlan"]["density"]) =>
    DENSITY_LABELS[density];

  const describeContentBalance = (contentBalance: WorkspaceData["layoutPlan"]["contentBalance"]) =>
    CONTENT_BALANCE_LABELS[contentBalance];

  const describeOverflowStatus = (status: WorkspaceData["layoutPlan"]["overflowStatus"]) =>
    OVERFLOW_STATUS_LABELS[status];

  const buildStatusCard = (
    currentWorkspace: WorkspaceData,
    measurement: ResumeMeasurement | null,
  ) => {
    const visualContentBalance = deriveVisualContentBalance(
      measurement,
      currentWorkspace.layoutPlan.contentBalance,
    );
    const previewNeedsTrim = measurement ? measurement.status !== "fits" : false;
    const needsTrim =
      currentWorkspace.layoutPlan.exportAllowed === false ||
      currentWorkspace.layoutPlan.overflowStatus !== "fits" ||
      previewNeedsTrim;

    if (needsTrim) {
      return {
        badge: "已超出一页",
        tone: "danger" as const,
        summary: "已超出一页",
        reason:
          measurement && measurement.status !== "fits"
            ? `当前预览约超出 ${measurement.overflowPx}px，导出后会分页。`
            : currentWorkspace.layoutPlan.blockingReasons?.[0] ??
          (previewNeedsTrim
            ? "当前预览已经超出一页，直接导出会破坏版面。"
            : "当前版本已超出一页，导出后会分页。"),
        next: "建议先精简 1 段经历、删掉 1 处次要信息，或把过长要点改短一点。",
      };
    }

    if (visualContentBalance === "sparse") {
      return {
        badge: "建议补强",
        tone: "warn" as const,
        summary: "可以导出，但建议先补强",
        reason: "这一版版面已经稳定，但内容偏少，导出后会显得有些空。",
        next: "建议先补：教育亮点 / 1 条量化结果 / 更完整的技能关键词。",
      };
    }

    if (visualContentBalance === "dense") {
      return {
        badge: "建议压缩",
        tone: "warn" as const,
        summary: "可以导出，但略显拥挤",
        reason: "这一版已经控制在一页内，但信息偏满，打印后会显得有点挤。",
        next: "建议先压缩 1 段经历，或删掉 1 处次要信息。",
      };
    }

    return {
      badge: "可直接导出",
      tone: "ready" as const,
      summary: "可以直接导出",
      reason: "这一版已经单页且信息完整，版面和内容都比较稳。",
      next: "下一步：导出 HTML，或直接打印 PDF。",
    };
  };

  const scrollToSection = (section: "education" | "experience" | "status") => {
    const scrollIntoView = (target: HTMLElement | null) => {
      if (typeof target?.scrollIntoView === "function") {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    };

    if (section === "education") {
      if (!educationSectionRef.current && editorFlowMode === "strengthening") {
        flushSync(() => expandStrengtheningSection("education"));
      }

      scrollIntoView(educationSectionRef.current);
      return;
    }

    if (section === "experience") {
      const experienceSectionKey: StrengtheningSectionKey =
        focusedStrengtheningSection === "campus"
          ? "campus"
          : internshipExperiences.length > 0
            ? "internship"
            : "campus";

      if (
        experienceSectionKey === "campus" &&
        !campusSectionRef.current &&
        editorFlowMode === "strengthening"
      ) {
        flushSync(() => expandStrengtheningSection("campus"));
      }

      if (
        experienceSectionKey === "internship" &&
        !experienceSectionRef.current &&
        editorFlowMode === "strengthening"
      ) {
        flushSync(() => expandStrengtheningSection("internship"));
      }

      scrollIntoView(
        experienceSectionKey === "campus"
          ? campusSectionRef.current
          : experienceSectionRef.current,
      );
      return;
    }

    scrollIntoView(statusSectionRef.current);
  };

  const previewSummary = workspace
    ? `当前为${describeDensity(workspace.layoutPlan.density)}单页，内容${describeContentBalance(
        deriveVisualContentBalance(previewMeasurement, workspace.layoutPlan.contentBalance),
      )}。${
        previewMeasurement && previewMeasurement.status !== "fits"
          ? " 当前预览已超出一页，导出后会分页。"
          : ""
      }`
    : "";
  const statusCard = workspace ? buildStatusCard(workspace, previewMeasurement) : null;
  const shouldShowStarterPreview =
    editorFlowMode === "starter" || Boolean(starterExportLockSignature);
  const shouldShowStatusSection = editorFlowMode === "review" && !starterExportLockSignature;
  const shouldShowTemplateToggle = editorFlowMode === "strengthening";
  const shouldShowCollapsedTemplateToggle =
    editorFlowMode === "strengthening" && !showStarterTemplateOptions;
  const shouldShowTemplateButtons =
    editorFlowMode !== "strengthening" || showStarterTemplateOptions;
  const templateToggleLabel =
    editorFlowMode === "strengthening" ? "需要时再看版式" : "先看版式选项";
  const recommendedTemplateManifests = workspace?.templateSession?.candidateManifests ?? [];
  const additionalTemplateManifests =
    editorFlowMode === "strengthening" || !workspace?.contentDocument
      ? []
      : rankAdditionalTemplateLibrary(
          workspace.contentDocument,
          recommendedTemplateManifests,
        );
  const additionalTemplateGroups = additionalTemplateManifests.reduce<
    Array<{
      familyId: TemplateFamilyId;
      familyLabel: string;
      templates: typeof additionalTemplateManifests;
    }>
  >((groups, manifest) => {
    const currentGroup = groups.find((group) => group.familyId === manifest.familyId);

    if (currentGroup) {
      currentGroup.templates.push(manifest);
      return groups;
    }

    groups.push({
      familyId: manifest.familyId,
      familyLabel: manifest.familyLabel,
      templates: [manifest],
    });

    return groups;
  }, []);
  const isStrengtheningSectionExpanded = (section: StrengtheningSectionKey) =>
    editorFlowMode !== "strengthening" ||
    focusedStrengtheningSection === section ||
    Boolean(expandedStrengtheningSections[section]);
  const expandStrengtheningSection = (section: StrengtheningSectionKey) => {
    setExpandedStrengtheningSections((current) => ({
      ...current,
      [section]: true,
    }));
  };
  const toggleStrengtheningSection = (section: StrengtheningSectionKey) => {
    setExpandedStrengtheningSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };
  const renderCollapsedEditorSection = ({
    kicker,
    title,
    actionLabel,
    copy,
    onExpand,
  }: {
    kicker: string;
    title: string;
    actionLabel: string;
    copy: string;
    onExpand: () => void;
  }) => (
    <section className="studio-block">
      <div className="block-heading">
        <div>
          <p className="block-kicker">{kicker}</p>
          <h3>{title}</h3>
        </div>
        <button className="secondary-button" onClick={onExpand} type="button">
          {actionLabel}
        </button>
      </div>
      <p className="block-copy">{copy}</p>
    </section>
  );

  const renderExperienceSuggestion = (experience: ExperienceAsset) => {
    const suggestionState = experienceSuggestions[experience.id];
    if (!suggestionState || suggestionState.status === "idle") {
      return null;
    }

    if (suggestionState.status === "generating") {
      return (
        <div className="editor-ai-panel">
          <p className="inline-note">正在整理建议稿...</p>
        </div>
      );
    }

    if (suggestionState.status === "apply_failed") {
      return (
        <div className="editor-ai-panel">
          <p className="inline-warning">{suggestionState.message ?? "这次没整理出建议稿，请稍后再试。"}</p>
        </div>
      );
    }

    const suggestion = suggestionState.suggestion;
    if (!suggestion) {
      return null;
    }

    return (
      <div className="editor-ai-panel">
          <div className="editor-ai-header">
            <span>建议稿</span>
        </div>
        {suggestionState.mode === "fallback" ? (
          <p className="inline-note">已先按你现有的事实整理出一版建议。</p>
        ) : null}
        {suggestion.rationale ? <p className="inline-note">{suggestion.rationale}</p> : null}
        <div className="suggested-bullets">
          {suggestion.suggestedBullets.map((bullet, index) => (
            <p key={`${experience.id}-suggestion-${index}`}>
              {index + 1}. {bullet}
            </p>
          ))}
        </div>
        {suggestion.followUpPrompt ? <p className="inline-note">{suggestion.followUpPrompt}</p> : null}
        <div className="entry-actions">
          <button
            className="primary-button"
            onClick={() => handleApplyAiSuggestion(experience.id)}
            type="button"
          >
            应用到经历要点
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="studio-root">
      <section className="hero-strip">
        <div className="hero-brand">
          <div className="hero-title-lockup">
            <h1>把你的第一版简历先做出来</h1>
            <p className="hero-subtitle">Siamese Dream</p>
          </div>
          <p className="hero-note">先填写基本信息，再慢慢完善成可投递的一版。</p>
        </div>
      </section>

      {stage === "editor" && workspace ? (
        <div className="mobile-preview-toggle" role="tablist" aria-label="移动端面板切换">
          <button
            aria-pressed={mobilePanel === "editor"}
            className={mobilePanel === "editor" ? "chip active" : "chip"}
            onClick={() => setMobilePanel("editor")}
            type="button"
          >
            编辑面板
          </button>
          <button
            aria-pressed={mobilePanel === "preview"}
            className={mobilePanel === "preview" ? "chip active" : "chip"}
            onClick={() => setMobilePanel("preview")}
            type="button"
          >
            预览简历
          </button>
        </div>
      ) : null}

      <section
        className={`studio-shell ${stage === "editor" ? `mobile-panel-${mobilePanel}` : ""}`.trim()}
      >
        <div className="studio-left studio-panel studio-panel-editor">
          {stage === "landing" ? (
            <section className="landing-panel">
              <div className="landing-copy">
                <p className="block-kicker">开始</p>
                <h2>先填基本信息，我们先整理出第一版简历。</h2>
                <p>
                  这不是一个空白编辑器，而是一个会提问、会整理、会陪你慢慢补好的简历助手。
                </p>
              </div>
              <div className="entry-actions">
                <button className="primary-button" onClick={handleEnterGuided} type="button">
                  从零开始
                </button>
                <button className="secondary-button" onClick={handleEnterPaste} type="button">
                  导入旧材料
                </button>
              </div>
            </section>
          ) : null}

          {stage === "paste" ? (
            <section className="studio-block">
              <div className="block-heading">
                <div>
                  <p className="block-kicker">导入</p>
                  <h3>导入旧材料，先整理第一版</h3>
                </div>
              </div>
              <label className="field">
                <span>粘贴现有简历或自我介绍</span>
                <textarea
                  aria-label="粘贴现有简历或自我介绍"
                  disabled={isPasteGenerating}
                  onChange={(event) => setPasteText(event.target.value)}
                  placeholder="把旧简历、自我介绍或项目经历贴进来，我们先整理出第一版，再带你继续完善。"
                  rows={11}
                  value={pasteText}
                />
              </label>
              <div className="entry-actions">
                <button
                  className="primary-button"
                  disabled={!pasteText.trim() || isPasteGenerating}
                  onClick={handleGenerateFromPaste}
                  type="button"
                >
                  {isPasteGenerating ? "整理中..." : "整理并起稿"}
                </button>
                <button
                  className="text-button"
                  disabled={isPasteGenerating}
                  onClick={() => setStage("landing")}
                  type="button"
                >
                  返回
                </button>
              </div>
            </section>
          ) : null}

          {stage === "guided" ? (
            <section className="studio-block">
              <div className="block-heading">
                <div>
                  <p className="block-kicker">引导</p>
                  <h3>回答当前最关键的问题</h3>
                </div>
                <span className="block-status">
                  第 {guidedStepIndex + 1} 题
                </span>
              </div>
              <p className="guided-prompt">{guidedQuestion.prompt}</p>
              <p className="block-copy">{guidedQuestion.note}</p>
              {activeEntryMode === "paste" && guidedSourceContentDocument ? (
                <p className="inline-note">刚刚导入的内容已经保留，现在只补还缺的关键信息。</p>
              ) : null}
              <div className="guided-grid">
                <label className="field">
                  <span>当前回答</span>
                  {guidedQuestion.multiline ? (
                    <>
                      <textarea
                        aria-label="当前回答"
                        onChange={(event) => setGuidedDraftAnswer(event.target.value)}
                        placeholder={guidedQuestion.placeholder}
                        rows={6}
                        value={guidedDraftAnswer}
                      />
                      {guidedHelperBlock}
                    </>
                  ) : (
                    <>
                      <input
                        aria-label="当前回答"
                        onChange={(event) => setGuidedDraftAnswer(event.target.value)}
                        placeholder={guidedQuestion.placeholder}
                        value={guidedDraftAnswer}
                      />
                      {guidedHelperBlock}
                    </>
                  )}
                </label>
              </div>
              {guidedRefinementHint ? <p className="inline-note">{guidedRefinementHint}</p> : null}
              <div className="entry-actions">
                <button className="primary-button" onClick={handleGuidedNext} type="button">
                  {guidedActionWillCreateDraft ? "生成第一版简历" : "下一题"}
                </button>
                <button className="text-button" onClick={handleGuidedBack} type="button">
                  {guidedStepIndex === 0 ? "返回" : "上一题"}
                </button>
              </div>
            </section>
          ) : null}

          {stage === "editor" && workspace ? (
            <>
              {editorFlowMode === "starter" ? (
                <section className="studio-block">
                  <div className="block-heading">
                    <div>
                      <p className="block-kicker">第一版</p>
                      <h3>第一版简历已经出来了</h3>
                    </div>
                    <span className="block-status">第一版已就绪</span>
                  </div>
                  <p className="block-copy">{starterBlockCopy}</p>
                  {pasteRecognitionSummary ? (
                    <div className="starter-summary-card">
                      <div className="starter-summary-heading">
                        <div>
                          <p className="block-kicker">识别结果</p>
                          <h4>我先从原文里整理到这些</h4>
                        </div>
                        <button
                          className="text-button"
                          onClick={handleReturnToPasteSource}
                          type="button"
                        >
                          返回修改原文
                        </button>
                      </div>
                      <p className="starter-summary-copy">
                        你先扫一眼；如果有识别错的，回到原文改一下再重新整理。
                      </p>
                      <dl className="starter-summary-grid">
                        {pasteRecognitionSummary.map((item) => (
                          <div className="starter-summary-item" key={item.label}>
                            <dt>{item.label}</dt>
                            <dd>{item.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ) : null}
                  <p className="inline-note">
                    这是第一版，建议先补 1 条关键信息，再决定要不要导出。
                  </p>
                  <p className="inline-note">
                    如果你已经知道还缺第二段教育或经历，可以直接从下面继续加。
                  </p>
                  {statusMessage ? <p className="inline-note">{statusMessage}</p> : null}
                  <div className="entry-actions">
                    <button className="primary-button" onClick={handleStartStrengthening} type="button">
                      继续完善这版
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        handleAddEducation();
                        scrollToSection("education");
                      }}
                      type="button"
                    >
                      再加一段教育
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        handleAddExperience("internship");
                        scrollToSection("experience");
                      }}
                      type="button"
                    >
                      再加一段实习
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        handleAddExperience("campus");
                        scrollToSection("experience");
                      }}
                      type="button"
                    >
                      再加一段在校经历
                    </button>
                  </div>
                </section>
              ) : null}

              {editorFlowMode === "strengthening" && intakeFollowUpQuestion ? (
                <section className="studio-block">
                  <div className="block-heading">
                    <div>
                      <p className="block-kicker">下一步</p>
                      <h3>再补 1 条关键信息</h3>
                    </div>
                    <span className="block-status">正在补强</span>
                  </div>
                  <p className="guided-prompt">{intakeFollowUpQuestion.question}</p>
                  <p className="block-copy">{intakeFollowUpQuestion.reason}</p>
                  <p className="inline-note">{intakeFollowUpQuestion.suggestion}</p>
                  {followUpTarget ? (
                    <p className="inline-note">这条会补到：{followUpTarget.label}</p>
                  ) : null}
                  <label className="field">
                    <span>把这条信息补上</span>
                    <textarea
                      aria-label="把这条信息补上"
                      onChange={(event) => setFollowUpDraftAnswer(event.target.value)}
                      placeholder="直接写事实即可，例如：推进 13 位候选人进入终面，促成 5 人入职。"
                      rows={4}
                      value={followUpDraftAnswer}
                    />
                  </label>
                  <div className="entry-actions">
                    <button
                      className="primary-button"
                      disabled={!followUpDraftAnswer.trim()}
                      onClick={handleSubmitFollowUpAnswer}
                      type="button"
                    >
                      补上这一条
                    </button>
                  </div>
                </section>
              ) : null}

              {editorFlowMode === "review" && intakeFollowUpQuestion ? (
                <section className="studio-block">
                  <div className="block-heading">
                    <div>
                      <p className="block-kicker">完善</p>
                      <h3>刚完善了 1 条</h3>
                    </div>
                    <span className="block-status ready">已记录</span>
                  </div>
                  <p className="block-copy">这一条已经写进草稿里了。先整体看一眼，再决定要不要继续补下一条。</p>
                  {followUpTarget ? (
                    <p className="inline-note">下一条会补到：{followUpTarget.label}</p>
                  ) : null}
                  <p className="inline-note">下一条建议：{intakeFollowUpQuestion.question}</p>
                  <div className="entry-actions">
                    <button className="primary-button" onClick={handleResumeStrengthening} type="button">
                      继续补下一条
                    </button>
                    <button className="secondary-button" onClick={handlePreviewCurrentDraft} type="button">
                      先看看现在这版
                    </button>
                  </div>
                </section>
              ) : null}

              {shouldShowStatusSection ? (
                <section className="studio-block">
                <div className="inline-guidance">
                  <span className="inline-guidance-label">现在最值得做的是：</span>
                  <button
                    className="inline-guidance-link"
                    onClick={() => scrollToSection("education")}
                    type="button"
                  >
                    补教育加分项
                  </button>
                  <span className="inline-guidance-divider">/</span>
                  <button
                    className="inline-guidance-link"
                    onClick={() => scrollToSection("experience")}
                    type="button"
                  >
                    把经历写得更像简历
                  </button>
                  <span className="inline-guidance-divider">/</span>
                  <button
                    className="inline-guidance-link"
                    onClick={() => scrollToSection("status")}
                    type="button"
                  >
                    {previewMeasurement && previewMeasurement.status !== "fits"
                      ? "先处理超页"
                      : "看看能不能放进一页"}
                  </button>
                </div>
              </section>
              ) : null}

              {shouldShowCollapsedTemplateToggle ? (
                <section className="studio-block">
                  <div className="entry-actions">
                    <button
                      className="secondary-button"
                      onClick={() => setShowStarterTemplateOptions(true)}
                      type="button"
                    >
                      {templateToggleLabel}
                    </button>
                  </div>
                </section>
              ) : (
                <section className="studio-block">
                  <div className="block-heading">
                    <div>
                      <p className="block-kicker">版式</p>
                      <h3>看看哪套版式更适合这版简历</h3>
                    </div>
                    <span className="block-status">
                      {(workspace.templateSession?.candidateManifests ?? []).length} 套候选
                    </span>
                  </div>
                  <p className="block-copy">{templateBlockCopy}</p>
                  {templateCandidateNote ? <p className="inline-note">{templateCandidateNote}</p> : null}
                  {templateCandidateState?.message && templateCandidateState.mode === "rate_limited" ? (
                    <p className="inline-note">{templateCandidateState.message}</p>
                  ) : null}
                  {shouldShowTemplateToggle ? (
                    <div className="entry-actions">
                      <button
                        className="secondary-button"
                        onClick={() =>
                          setShowStarterTemplateOptions((current) => !current)
                        }
                        type="button"
                      >
                        {templateToggleLabel}
                      </button>
                    </div>
                  ) : null}
                  {shouldShowTemplateButtons ? (
                    <>
                      <div className="template-card-grid" data-testid="recommended-template-options">
                        {recommendedTemplateManifests.map((manifest) => {
                          const cardHighlights = buildTemplateCardHighlights(manifest);
                          const accessibilityDescription = [
                            manifest.familyLabel,
                            manifest.bestFor,
                            manifest.fitSummary,
                            cardHighlights.join("，"),
                          ]
                            .filter(Boolean)
                            .join("。");
                          const descriptionId = `template-card-description-${manifest.templateId}`;

                          return (
                            <button
                              key={manifest.templateId}
                              aria-describedby={descriptionId}
                              aria-label={manifest.displayName}
                              aria-pressed={workspace.templateSession?.selectedTemplateId === manifest.templateId}
                              className={
                                workspace.templateSession?.selectedTemplateId === manifest.templateId
                                  ? "template-card template-card-selected"
                                  : "template-card"
                              }
                              onClick={() => handleTemplateSwitch(manifest.templateId)}
                              type="button"
                            >
                              <span className="sr-only" id={descriptionId}>
                                {accessibilityDescription}
                              </span>
                              {renderTemplateCardPreview(manifest)}
                              <span className="template-card-family">{manifest.familyLabel}</span>
                              <span className="template-card-name">{manifest.displayName}</span>
                              <span className="template-card-description">{manifest.description}</span>
                              <span className="template-card-best-for">{manifest.bestFor}</span>
                              <span className="template-card-fit">{manifest.fitSummary}</span>
                              <span className="template-card-tags">
                                {cardHighlights.map((highlight) => (
                                  <span className="template-card-tag" key={`${manifest.templateId}-${highlight}`}>
                                    {highlight}
                                  </span>
                                ))}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {additionalTemplateManifests.length > 0 ? (
                        <div className="template-library-panel">
                          <div className="entry-actions">
                            <button
                              aria-controls="more-template-options"
                              aria-expanded={showAdditionalTemplateOptions}
                              className="secondary-button"
                              onClick={() => setShowAdditionalTemplateOptions((current) => !current)}
                              type="button"
                            >
                              {showAdditionalTemplateOptions ? "收起更多版式" : "看看更多版式"}
                            </button>
                          </div>
                          {showAdditionalTemplateOptions ? (
                            <div
                              className="template-library-expanded"
                              data-testid="more-template-options"
                              id="more-template-options"
                            >
                              <p className="inline-note">
                                这里再给你几种不同路数的版式。点中后会直接替换进上面的推荐位。
                              </p>
                              <div className="template-library-groups">
                                {additionalTemplateGroups.map((group) => {
                                  const isFamilyExpanded =
                                    expandedAdditionalTemplateFamilies[group.familyId] === true;
                                  const visibleTemplates = isFamilyExpanded
                                    ? group.templates
                                    : group.templates.slice(0, 2);

                                  return (
                                    <section className="template-family-group" key={group.familyId}>
                                      <div className="template-family-group-header">
                                        <div className="template-family-group-title">
                                          <h4>{group.familyLabel}</h4>
                                          <p className="template-family-group-description">
                                            {TEMPLATE_FAMILY_SUMMARIES[group.familyId]}
                                          </p>
                                        </div>
                                        <span>{group.templates.length} 套</span>
                                      </div>
                                      <div className="template-card-grid template-card-grid-secondary">
                                        {visibleTemplates.map((manifest) => {
                                        const cardHighlights = buildTemplateCardHighlights(manifest);
                                        const accessibilityDescription = [
                                          manifest.familyLabel,
                                          manifest.bestFor,
                                          manifest.fitSummary,
                                          cardHighlights.join("，"),
                                        ]
                                          .filter(Boolean)
                                          .join("。");
                                        const descriptionId = `template-card-description-${manifest.templateId}`;

                                        return (
                                          <button
                                            key={manifest.templateId}
                                            aria-describedby={descriptionId}
                                            aria-label={manifest.displayName}
                                            aria-pressed={false}
                                            className="template-card"
                                            onClick={() => handleAdditionalTemplatePromote(manifest.templateId)}
                                            type="button"
                                          >
                                            <span className="sr-only" id={descriptionId}>
                                              {accessibilityDescription}
                                            </span>
                                            {renderTemplateCardPreview(manifest)}
                                            <span className="template-card-family">{manifest.familyLabel}</span>
                                            <span className="template-card-name">{manifest.displayName}</span>
                                            <span className="template-card-description">{manifest.description}</span>
                                            <span className="template-card-best-for">{manifest.bestFor}</span>
                                            <span className="template-card-fit">{manifest.fitSummary}</span>
                                            <span className="template-card-tags">
                                              {cardHighlights.map((highlight) => (
                                                <span className="template-card-tag" key={`${manifest.templateId}-${highlight}`}>
                                                  {highlight}
                                                </span>
                                              ))}
                                            </span>
                                          </button>
                                        );
                                        })}
                                      </div>
                                      {group.templates.length > 2 ? (
                                        <div className="template-family-group-actions">
                                          <button
                                            className="text-button"
                                            onClick={() =>
                                              setExpandedAdditionalTemplateFamilies((current) => ({
                                                ...current,
                                                [group.familyId]: !isFamilyExpanded,
                                              }))
                                            }
                                            type="button"
                                          >
                                            {isFamilyExpanded
                                              ? "收起本组"
                                              : "展开本组更多"}
                                          </button>
                                        </div>
                                      ) : null}
                                    </section>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </section>
              )}

              {shouldShowStatusSection ? (
                <section className="studio-block" ref={statusSectionRef}>
                  <div className="block-heading">
                    <div>
                      <p className="block-kicker">建议</p>
                      <h3>下一步建议</h3>
                    </div>
                    {statusCard ? (
                      <span className={`block-status ${statusCard.tone}`}>{statusCard.badge}</span>
                    ) : null}
                  </div>
                  {statusCard ? <p className="status-card-summary">{statusCard.summary}</p> : null}
                  {statusCard ? <p className="status-card-reason">{statusCard.reason}</p> : null}
                  {statusCard ? <p className="status-card-next">{statusCard.next}</p> : null}
                  {statusMessage ? <p className="inline-note">{statusMessage}</p> : null}
                </section>
              ) : null}

              {isStrengtheningSectionExpanded("education") ? (
                <section className="studio-block" ref={educationSectionRef}>
                  <div className="block-heading">
                    <div>
                      <p className="block-kicker">教育</p>
                      <h3>教育背景</h3>
                    </div>
                    <button className="secondary-button" onClick={handleAddEducation} type="button">
                      新增教育背景
                    </button>
                  </div>
                  <p className="block-copy">
                    当前共有 {workspace.education.length} 段教育，后面继续补也不会覆盖前面内容。
                  </p>
                  <div className="stacked-editor">
                    {workspace.education.map((item, index) => (
                      <article className="editor-card" key={item.id}>
                        <div className="editor-card-header">
                          <strong>教育 {index + 1}</strong>
                          {workspace.education.length > 1 ? (
                            <button
                              className="text-button"
                              onClick={() => handleRemoveEducation(item.id)}
                              type="button"
                            >
                              删除
                            </button>
                          ) : null}
                        </div>
                        <div className="editor-grid editor-grid-two">
                          <label className="field">
                            <span>学校</span>
                            <input
                              aria-label="学校"
                              onChange={(event) =>
                                handleEducationChange(item.id, "school", event.target.value)
                              }
                              value={item.school}
                            />
                          </label>
                          <label className="field">
                            <span>专业/学历</span>
                            <input
                              onChange={(event) =>
                                handleEducationChange(item.id, "degree", event.target.value)
                              }
                              value={item.degree}
                            />
                          </label>
                          <label className="field">
                            <span>时间</span>
                            <input
                              onChange={(event) =>
                                handleEducationChange(item.id, "dateRange", event.target.value)
                              }
                              value={item.dateRange}
                            />
                          </label>
                          <label className="field">
                            <span>标签（可选）</span>
                            <input
                              onChange={(event) =>
                                handleEducationChange(item.id, "tag", event.target.value)
                              }
                              placeholder="例如：保研"
                              value={item.tag ?? ""}
                            />
                          </label>
                        </div>
                        <div className="education-highlights-block">
                          <div className="field-label-row">
                            <span>教育亮点（可选）</span>
                          </div>
                          <p className="field-helper-copy">系统会自动隐藏空字段，不会占位。</p>
                          <div className="editor-grid editor-grid-two">
                            {EDUCATION_HIGHLIGHT_FIELDS.map((field) => (
                              <label className="field" key={`${item.id}:${field.label}`}>
                                <span>{field.label}</span>
                                <input
                                  aria-label={field.label}
                                  onChange={(event) =>
                                    handleEducationHighlightChange(
                                      item.id,
                                      field.label,
                                      event.target.value,
                                    )
                                  }
                                  placeholder={field.placeholder}
                                  value={getEducationHighlightValue(item, field.label)}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : (
                renderCollapsedEditorSection({
                  kicker: "教育",
                  title: "教育背景",
                  actionLabel: "展开教育背景",
                  copy: `当前 ${workspace.education.length} 段教育，先把顶部这条补完；需要时再展开细改。`,
                  onExpand: () => expandStrengtheningSection("education"),
                })
              )}

              {isStrengtheningSectionExpanded("internship") ? (
                <section className="studio-block" ref={experienceSectionRef}>
                  <div className="block-heading">
                    <div>
                      <p className="block-kicker">实习</p>
                      <h3>实习经历</h3>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => handleAddExperience("internship")}
                      type="button"
                    >
                      新增实习经历
                    </button>
                  </div>
                  <p className="block-copy">
                    当前共有 {internshipExperiences.length} 段实习，后面继续补也不会覆盖前面内容。
                  </p>
                  <div className="stacked-editor">
                    {internshipExperiences.map((experience, index) => (
                      <article className="editor-card" key={experience.id}>
                        <div className="editor-card-header">
                          <strong>实习 {index + 1}</strong>
                          <div className="editor-card-actions">
                            <button
                              className="text-button"
                              disabled={experienceSuggestions[experience.id]?.status === "generating"}
                              onClick={() => handleAiRewrite(experience.id)}
                              type="button"
                            >
                              {experienceSuggestions[experience.id]?.status === "generating"
                                ? "润色中..."
                                : "帮我润色"}
                            </button>
                            {internshipExperiences.length > 1 ? (
                              <button
                                className="text-button"
                                onClick={() => handleRemoveExperience(experience.id)}
                                type="button"
                              >
                                删除
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="editor-grid editor-grid-two">
                          <label className="field">
                            <span>公司/组织</span>
                            <input
                              aria-label="公司/组织"
                              onChange={(event) =>
                                handleExperienceFieldChange(
                                  experience.id,
                                  "organization",
                                  event.target.value,
                                )
                              }
                              value={experience.organization}
                            />
                          </label>
                          <label className="field">
                            <span>岗位/身份</span>
                            <input
                              onChange={(event) =>
                                handleExperienceFieldChange(experience.id, "role", event.target.value)
                              }
                              value={experience.role}
                            />
                          </label>
                          <label className="field">
                            <span>时间</span>
                            <input
                              onChange={(event) =>
                                handleExperienceFieldChange(
                                  experience.id,
                                  "dateRange",
                                  event.target.value,
                                )
                              }
                              value={experience.dateRange}
                            />
                          </label>
                          <label className="field">
                            <span>补充说明（可选）</span>
                            <input
                              onChange={(event) =>
                                handleExperienceFieldChange(
                                  experience.id,
                                  "organizationNote",
                                  event.target.value,
                                )
                              }
                              placeholder="例如：蚂蚁集团投资"
                              value={experience.organizationNote ?? ""}
                            />
                          </label>
                        </div>
                        <label className="field">
                          <div className="field-label-row">
                            <span>经历要点</span>
                            <span className="field-helper-inline">按 Enter 换行，一行一条</span>
                          </div>
                          <p className="field-helper-copy">系统会自动拆成多条经历要点并同步预览</p>
                          <textarea
                            aria-label="经历要点"
                            onBlur={() => handleExperienceBulletsBlur(experience.id)}
                            onChange={(event) =>
                              handleExperienceBulletsChange(experience.id, event.target.value)
                            }
                            placeholder={"例如：推进 8 个岗位招聘流程\n协调候选人与面试官排期并跟进结果"}
                            rows={4}
                            value={getExperienceBulletDraftValue(experience)}
                          />
                        </label>
                        {renderExperienceSuggestion(experience)}
                      </article>
                    ))}
                  </div>
                </section>
              ) : (
                renderCollapsedEditorSection({
                  kicker: "实习",
                  title: "实习经历",
                  actionLabel: "展开实习经历",
                  copy:
                    internshipExperiences.length > 0
                      ? `当前 ${internshipExperiences.length} 段实习，先把顶部这条补完；需要时再展开细改。`
                      : "当前还没有实习经历，需要时再展开补充。",
                  onExpand: () => expandStrengtheningSection("internship"),
                })
              )}

              {isStrengtheningSectionExpanded("campus") ? (
                <section className="studio-block" ref={campusSectionRef}>
                  <div className="block-heading">
                    <div>
                      <p className="block-kicker">在校</p>
                      <h3>在校经历</h3>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => handleAddExperience("campus")}
                      type="button"
                    >
                      新增在校经历
                    </button>
                  </div>
                  <p className="block-copy">
                    当前共有 {campusExperiences.length} 段在校经历，后面继续补也不会覆盖前面内容。
                  </p>
                  <div className="stacked-editor">
                    {campusExperiences.length === 0 ? (
                      <p className="inline-note">还没有在校经历，可以继续补充。</p>
                    ) : null}
                    {campusExperiences.map((experience, index) => (
                      <article className="editor-card" key={experience.id}>
                        <div className="editor-card-header">
                          <strong>在校经历 {index + 1}</strong>
                          <div className="editor-card-actions">
                            <button
                              className="text-button"
                              disabled={experienceSuggestions[experience.id]?.status === "generating"}
                              onClick={() => handleAiRewrite(experience.id)}
                              type="button"
                            >
                              {experienceSuggestions[experience.id]?.status === "generating"
                                ? "润色中..."
                                : "帮我润色"}
                            </button>
                            <button
                              className="text-button"
                              onClick={() => handleRemoveExperience(experience.id)}
                              type="button"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                        <div className="editor-grid editor-grid-two">
                          <label className="field">
                            <span>公司/组织</span>
                            <input
                              aria-label="公司/组织"
                              onChange={(event) =>
                                handleExperienceFieldChange(
                                  experience.id,
                                  "organization",
                                  event.target.value,
                                )
                              }
                              value={experience.organization}
                            />
                          </label>
                          <label className="field">
                            <span>岗位/身份</span>
                            <input
                              onChange={(event) =>
                                handleExperienceFieldChange(experience.id, "role", event.target.value)
                              }
                              value={experience.role}
                            />
                          </label>
                          <label className="field">
                            <span>时间</span>
                            <input
                              onChange={(event) =>
                                handleExperienceFieldChange(
                                  experience.id,
                                  "dateRange",
                                  event.target.value,
                                )
                              }
                              value={experience.dateRange}
                            />
                          </label>
                          <label className="field">
                            <span>补充说明（可选）</span>
                            <input
                              onChange={(event) =>
                                handleExperienceFieldChange(
                                  experience.id,
                                  "organizationNote",
                                  event.target.value,
                                )
                              }
                              value={experience.organizationNote ?? ""}
                            />
                          </label>
                        </div>
                        <label className="field">
                          <div className="field-label-row">
                            <span>经历要点</span>
                            <span className="field-helper-inline">按 Enter 换行，一行一条</span>
                          </div>
                          <p className="field-helper-copy">系统会自动拆成多条经历要点并同步预览</p>
                          <textarea
                            aria-label="经历要点"
                            onBlur={() => handleExperienceBulletsBlur(experience.id)}
                            onChange={(event) =>
                              handleExperienceBulletsChange(experience.id, event.target.value)
                            }
                            placeholder={"例如：组织学院活动并协调分工\n复盘报名与到场数据，形成优化建议"}
                            rows={4}
                            value={getExperienceBulletDraftValue(experience)}
                          />
                        </label>
                        {renderExperienceSuggestion(experience)}
                      </article>
                    ))}
                  </div>
                </section>
              ) : (
                renderCollapsedEditorSection({
                  kicker: "在校",
                  title: "在校经历",
                  actionLabel: "展开在校经历",
                  copy:
                    campusExperiences.length > 0
                      ? `当前 ${campusExperiences.length} 段在校经历，先把顶部这条补完；需要时再展开细改。`
                      : "当前还没有在校经历，需要时再展开补充。",
                  onExpand: () => expandStrengtheningSection("campus"),
                })
              )}

              {editorFlowMode === "strengthening" ? (
                <>
                  {renderCollapsedEditorSection({
                    kicker: "更多",
                    title: "更多调整",
                    actionLabel: expandedStrengtheningSections.adjustments
                      ? "收起更多调整"
                      : "展开更多调整",
                    copy: "证件照和版面建议先收在这里，避免打断当前补强。",
                    onExpand: () => toggleStrengtheningSection("adjustments"),
                  })}
                  {expandedStrengtheningSections.adjustments ? (
                    <>
                      <PhotoUploader onPhotoChange={handlePhotoChange} photo={workspace.profile.photo} />
                      {layoutAdvice ? (
                        <LayoutAdvicePanel
                          advice={layoutAdvice}
                          onApply={handleApplyLayoutSuggestion}
                          onApplySequence={handleApplyLayoutSuggestionSequence}
                        />
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <PhotoUploader onPhotoChange={handlePhotoChange} photo={workspace.profile.photo} />

                  {layoutAdvice ? (
                    <LayoutAdvicePanel
                      advice={layoutAdvice}
                      onApply={handleApplyLayoutSuggestion}
                      onApplySequence={handleApplyLayoutSuggestionSequence}
                    />
                  ) : null}
                </>
              )}

            </>
          ) : null}
        </div>

        <div
          className={`studio-right studio-panel studio-panel-preview ${
            stage === "editor" ? "studio-right-sticky" : ""
          }`.trim()}
        >
          {stage === "editor" && workspace ? (
            <section className="preview-rail">
                <div className="preview-header">
                  <div>
                  <p className="block-kicker">预览</p>
                  <h3>{shouldShowStarterPreview ? "第一版预览" : "简历预览"}</h3>
                  </div>
                </div>
              <p className="preview-summary">{previewSummary}</p>
              <div className="preview-sheet-wrap">
                <ResumePreview onMeasurementChange={setPreviewMeasurement} workspace={workspace} />
              </div>
              <div className="preview-actions-card">
                  <div className="preview-actions-header">
                    <div>
                      <p className="block-kicker">导出</p>
                      <h4 className="preview-actions-title">导出与打印</h4>
                    </div>
                    {editorFlowMode !== "starter" && previewMeasurement && previewMeasurement.status !== "fits" ? (
                      <span className="block-status warn">已超出一页</span>
                    ) : null}
                  </div>
                  <p className="preview-actions-copy">
                    {starterExportLockSignature
                      ? editorFlowMode === "starter"
                        ? "这还是第一版，建议先补 1 条关键信息后再导出。"
                        : "这还是第一版，建议先补完当前这一条再导出。"
                      : previewMeasurement && previewMeasurement.status !== "fits"
                      ? "当前版本已超出一页，导出后会分页。"
                      : "先确认右侧是一页，再导出 PDF。"}
                  </p>
                  <div className="preview-actions-grid">
                    <button
                      className="secondary-button preview-action-button"
                      disabled={starterExportBlocked}
                      onClick={handleExportHtml}
                      type="button"
                    >
                      导出网页版
                    </button>
                    <button
                      className="primary-button preview-action-button"
                      disabled={starterExportBlocked}
                      onClick={handlePrintPdf}
                      type="button"
                    >
                      导出 PDF
                    </button>
                  </div>
                </div>
            </section>
          ) : stage === "guided" && guidedPreviewWorkspace ? (
            <section className="preview-rail">
              <div className="preview-header">
                <div>
                  <p className="block-kicker">预览</p>
                  <h3>实时预览</h3>
                </div>
              </div>
              <p className="preview-summary">
                当前为{describeDensity(guidedPreviewWorkspace.layoutPlan.density)}草稿，内容
                {describeContentBalance(
                  deriveVisualContentBalance(
                    previewMeasurement,
                    guidedPreviewWorkspace.layoutPlan.contentBalance,
                  ),
                )}
                。
              </p>
              <div className="preview-sheet-wrap">
                <ResumePreview
                  onMeasurementChange={setPreviewMeasurement}
                  workspace={guidedPreviewWorkspace}
                />
              </div>
            </section>
          ) : (
            <div className="preview-empty">
              <p className="block-kicker">预览</p>
              <h3>第一版预览会先出现在这里</h3>
              <p>
                先从左边开始。我们会先整理出第一版简历，再陪你继续完善。
              </p>
            </div>
          )}
        </div>
      </section>

    </main>
  );
}
