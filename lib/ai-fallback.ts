import {
  deriveExperienceVariants,
  normalizeExperienceBullets,
  type ExperienceRewriteSuggestion,
} from "@/lib/experience";
import {
  BASELINE_TEMPLATE_MANIFESTS,
  type TemplateManifest,
} from "@/lib/template-manifest";
import {
  planNextIntakeQuestion,
  type IntakeQuestionPlan,
} from "@/lib/intake-engine";
import { createBaselineContentDocumentFromPasteText } from "@/lib/resume-document";
import type { WorkspaceData } from "@/lib/types";
import type { ResumeContentDocument } from "@/lib/resume-document";

type RewriteInput = {
  organization: string;
  role: string;
  narrative: string;
  targetRole?: string;
};

export const rewriteExperienceFallback = ({
  narrative,
  role,
  targetRole,
}: RewriteInput): ExperienceRewriteSuggestion => {
  const normalizedNarrative = narrative.replace(/\s+/g, "");
  const clauses = normalizedNarrative
    .split(/[，；。！？]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const hasMetrics = /\d/.test(normalizedNarrative);

  const resultClause = clauses.filter((item) => /\d/.test(item)).join("，");
  let suggestedBullets = normalizeExperienceBullets(
    hasMetrics
      ? [normalizedNarrative, resultClause]
      : [normalizedNarrative || clauses[0]],
  );

  if (suggestedBullets.length === 0) {
    suggestedBullets = normalizeExperienceBullets([normalizedNarrative]);
  }

  const followUpPrompt = hasMetrics
    ? undefined
    : `建议再补 1 个数字结果或${role || targetRole || "岗位"}中的关键难点，会更像正式简历。`;

  return {
    suggestedBullets,
    variants: deriveExperienceVariants(suggestedBullets),
    rationale: hasMetrics
      ? "已优先突出动作、结果和可量化信息。"
      : "已先按现有事实整理成更像简历的表达，没有补造任何数字。",
    followUpPrompt,
  };
};

const FALLBACK_QUESTIONS = [
  "这段经历里，最想让面试官记住的结果是什么？",
  "如果只能保留一个数字，你最想保留哪一个？",
  "这段经历最能体现你判断力的地方是什么？",
];

export const buildFallbackIntakeTurn = (questionIndex: number, latestAnswer?: string) => ({
  nextQuestion: FALLBACK_QUESTIONS[questionIndex] ?? FALLBACK_QUESTIONS[FALLBACK_QUESTIONS.length - 1],
  suggestion: latestAnswer ? `我先记下这一点：${latestAnswer}` : "我们先从最有代表性的经历开始。",
});

export const extractContentFallback = ({
  entryMode,
  text,
}: {
  entryMode: "guided" | "paste";
  text: string;
}) => {
  if (entryMode === "guided") {
    return createBaselineContentDocumentFromPasteText(text);
  }

  return createBaselineContentDocumentFromPasteText(text);
};

export const buildFallbackInterviewNext = ({
  contentDocument,
  hasDraft,
}: {
  contentDocument: ResumeContentDocument;
  hasDraft: boolean;
}) =>
  planNextIntakeQuestion(contentDocument, { hasDraft });

export const buildFallbackRebalance = (workspace: WorkspaceData) => ({
  layoutPlan: workspace.layoutPlan,
  message: "已按本地规则重新平衡一页内容。",
});

export const buildFallbackTemplateCandidates = (): TemplateManifest[] =>
  BASELINE_TEMPLATE_MANIFESTS.map((manifest) => ({ ...manifest }));
