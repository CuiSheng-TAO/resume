import { recomputeWorkspaceData } from "@/lib/resume-document";
import type {
  ExperienceVariantKey,
  ResumeMeasurement,
  WorkspaceData,
} from "@/lib/types";

export type LayoutSuggestion =
  | {
      id: string;
      kind: "switch-variant";
      title: string;
      description: string;
      actionLabel: string;
      experienceId: string;
      nextVariant: ExperienceVariantKey;
    }
  | {
      id: string;
      kind: "tighten-density";
      title: string;
      description: string;
      actionLabel: string;
      nextDensity: "balanced" | "tight";
    };

export type LayoutAdvice = {
  reasons: string[];
  suggestions: LayoutSuggestion[];
  sequence: LayoutSuggestion[];
};

const VARIANT_ORDER: ExperienceVariantKey[] = ["raw", "star", "standard", "compact"];

const nextMoreCompactVariant = (current: ExperienceVariantKey) => {
  const currentIndex = VARIANT_ORDER.indexOf(current);
  if (currentIndex === -1 || currentIndex === VARIANT_ORDER.length - 1) {
    return null;
  }

  return VARIANT_ORDER[currentIndex + 1] ?? null;
};

const withFreshMeta = (workspace: WorkspaceData): WorkspaceData => ({
  ...workspace,
  meta: {
    ...workspace.meta,
    updatedAt: new Date().toISOString(),
  },
});

export const buildLayoutAdvice = (
  workspace: WorkspaceData,
  measurement: ResumeMeasurement | null,
): LayoutAdvice => {
  if (!measurement || measurement.status === "fits") {
    return {
      reasons: [],
      suggestions: [],
      sequence: [],
    };
  }

  const renderState = workspace.renderState ?? {
    density: workspace.layoutPlan.density,
    selectedVariants: { ...workspace.layoutPlan.selectedVariants },
    lockedExperienceIds: [...workspace.draft.lockedExperienceIds],
    hiddenExperienceIds: [...workspace.layoutPlan.hiddenExperienceIds],
    hiddenAwardIds: [...workspace.layoutPlan.hiddenAwardIds],
    hiddenModuleIds: [...workspace.layoutPlan.hiddenModuleIds],
    overflowStatus: workspace.layoutPlan.overflowStatus,
    exportAllowed: workspace.layoutPlan.exportAllowed ?? true,
    blockingReasons: [...(workspace.layoutPlan.blockingReasons ?? [])],
  };
  const reasons = [
    `当前预览超出 ${measurement.overflowPx}px，导出后大概率会分页。`,
    measurement.status === "requires-trim"
      ? "这不是轻微超页，建议优先处理低优先级模块。"
      : "当前是轻微超页，先压缩非锁定经历通常最稳。",
  ];

  if (workspace.layoutPlan.contentBalance === "dense") {
    reasons.push("当前稿件已经处于高密度状态，建议逐项确认删减动作。");
  }

  const suggestions: LayoutSuggestion[] = [];

  const visibleExperiences = workspace.experiences
    .filter((experience) => !renderState.hiddenExperienceIds.includes(experience.id))
    .filter((experience) => !renderState.lockedExperienceIds.includes(experience.id))
    .sort((left, right) => left.priority - right.priority);

  for (const experience of visibleExperiences) {
    const currentVariant = renderState.selectedVariants[experience.id] ?? "standard";
    const nextVariant = nextMoreCompactVariant(currentVariant);

    if (!nextVariant) {
      continue;
    }

    suggestions.push({
      id: `variant:${experience.id}:${nextVariant}`,
      kind: "switch-variant",
      title: `将“${experience.organization}”切到 ${nextVariant} 版本`,
      description: "优先压缩非锁定经历，信息损失最小。",
      actionLabel: "应用建议",
      experienceId: experience.id,
      nextVariant,
    });
  }

  if (renderState.density !== "tight") {
    suggestions.push({
      id: `density:${renderState.density === "airy" ? "balanced" : "tight"}`,
      kind: "tighten-density",
      title: `将密度从 ${renderState.density} 提升一档`,
      description: "先调整版面紧凑度，不直接删内容。",
      actionLabel: "应用建议",
      nextDensity: renderState.density === "airy" ? "balanced" : "tight",
    });
  }

  const limitedSuggestions = suggestions.slice(0, 4);
  const sequence = limitedSuggestions.slice(0, 3);

  return {
    reasons,
    suggestions: limitedSuggestions,
    sequence,
  };
};

export const applyLayoutSuggestion = (
  workspace: WorkspaceData,
  suggestion: LayoutSuggestion,
): WorkspaceData => {
  const renderState = workspace.renderState ?? {
    density: workspace.layoutPlan.density,
    selectedVariants: { ...workspace.layoutPlan.selectedVariants },
    lockedExperienceIds: [...workspace.draft.lockedExperienceIds],
    hiddenExperienceIds: [...workspace.layoutPlan.hiddenExperienceIds],
    hiddenAwardIds: [...workspace.layoutPlan.hiddenAwardIds],
    hiddenModuleIds: [...workspace.layoutPlan.hiddenModuleIds],
    overflowStatus: workspace.layoutPlan.overflowStatus,
    exportAllowed: workspace.layoutPlan.exportAllowed ?? true,
    blockingReasons: [...(workspace.layoutPlan.blockingReasons ?? [])],
  };

  if (suggestion.kind === "switch-variant") {
    return recomputeWorkspaceData(withFreshMeta({
      ...workspace,
      renderState: {
        ...renderState,
        selectedVariants: {
          ...renderState.selectedVariants,
          [suggestion.experienceId]: suggestion.nextVariant,
        },
      },
    }));
  }

  if (suggestion.kind === "tighten-density") {
    return recomputeWorkspaceData(withFreshMeta({
      ...workspace,
      renderState: {
        ...renderState,
        density: suggestion.nextDensity,
      },
    }));
  }

  throw new Error(`Unsupported layout suggestion: ${(suggestion as { kind: string }).kind}`);
};

export const applyLayoutSuggestionSequence = (
  workspace: WorkspaceData,
  suggestions: LayoutSuggestion[],
) => suggestions.reduce((current, suggestion) => applyLayoutSuggestion(current, suggestion), workspace);
