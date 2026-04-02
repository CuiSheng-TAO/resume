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

const splitIntoSentences = (text: string): string[] => {
  const normalized = text.replace(/\s+/g, "");
  return normalized
    .split(/[。！？!?;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

const VERB_UPGRADES: [RegExp, string][] = [
  [/^做了/, "完成"],
  [/^做过/, "完成"],
  [/^帮助/, "协助"],
  [/^帮/, "协助"],
  [/^学了/, "掌握"],
  [/^学会了/, "掌握"],
  [/^用了/, "运用"],
  [/^写了/, "撰写"],
  [/^跟了/, "跟进"],
  [/^看了/, "分析"],
  [/^搞了/, "完成"],
  [/^搞定/, "完成"],
  [/^弄了/, "完成"],
];

const FILLER_PATTERNS = [
  /^我(在[^，,。]*?)?(?=帮|做|写|学|用|跟|看|搞|弄|负责|参与|完成|推进|协助|支持|组织)/,
  /^主要是/,
  /^然后/,
  /^还有就是/,
  /^就是/,
  /^其实/,
  /^基本上/,
];

const strengthenBullet = (sentence: string): string => {
  let result = sentence;
  for (const pattern of FILLER_PATTERNS) {
    result = result.replace(pattern, "");
  }
  for (const [pattern, replacement] of VERB_UPGRADES) {
    if (pattern.test(result)) {
      result = result.replace(pattern, replacement);
      break;
    }
  }
  return result;
};

const deduplicateBullets = (bullets: string[]): string[] => {
  const kept: string[] = [];
  for (const bullet of bullets) {
    const subsumedIndex = kept.findIndex((existing) => {
      const shorter = existing.length < bullet.length ? existing : bullet;
      const longer = existing.length < bullet.length ? bullet : existing;
      return longer.includes(shorter);
    });
    if (subsumedIndex === -1) {
      kept.push(bullet);
    } else if (bullet.length > kept[subsumedIndex].length) {
      kept[subsumedIndex] = bullet;
    }
  }
  return kept;
};

export const rewriteExperienceFallback = ({
  narrative,
  role,
  targetRole,
}: RewriteInput): ExperienceRewriteSuggestion => {
  const sentences = splitIntoSentences(narrative);
  if (sentences.length === 0) {
    return {
      suggestedBullets: [],
      variants: deriveExperienceVariants([]),
      rationale: "请先输入经历描述。",
    };
  }

  const strengthened = sentences.map(strengthenBullet).filter(Boolean);
  const deduplicated = deduplicateBullets(strengthened);

  const withMetrics = deduplicated.filter((b) => /\d/.test(b));
  const withoutMetrics = deduplicated.filter((b) => !/\d/.test(b));
  const ordered = [...withMetrics, ...withoutMetrics];

  const suggestedBullets = normalizeExperienceBullets(
    ordered.length > 0 ? ordered.slice(0, 3) : [narrative.replace(/\s+/g, "")],
  );

  const hasMetrics = withMetrics.length > 0;
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
  text,
}: {
  entryMode: "guided" | "paste";
  text: string;
}) => createBaselineContentDocumentFromPasteText(text);

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
