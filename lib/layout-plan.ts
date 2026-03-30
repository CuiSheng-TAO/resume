import { resolveTemplateManifestById, type TemplateManifest } from "@/lib/template-manifest";
import type {
  ContentBalance,
  DensityMode,
  ExperienceAsset,
  ExperienceVariantKey,
  LayoutPlan,
  ResumeModuleKey,
  WorkspaceData,
} from "@/lib/types";

const DENSITY_BUDGETS: Record<DensityMode, number> = {
  airy: 22,
  balanced: 24,
  tight: 26,
};

const MARGIN_BUDGET_ADJUSTMENTS: Record<TemplateManifest["page"]["marginPreset"], number> = {
  airy: -2,
  balanced: 0,
  tight: 2,
};

const VARIANT_COSTS: Record<ExperienceVariantKey, number> = {
  raw: 7,
  star: 6,
  standard: 5,
  compact: 4,
};

const VARIANT_ORDER: ExperienceVariantKey[] = ["raw", "star", "standard", "compact"];
const DENSITY_ORDER: DensityMode[] = ["airy", "balanced", "tight"];
const MODULE_ORDER: ResumeModuleKey[] = ["profile", "education", "experience", "awards", "skills"];
const SUMMARY_LINE_COST = 3;
const SPARSE_THRESHOLD = 19;

type BalanceState = {
  density: DensityMode;
  selectedVariants: Record<string, ExperienceVariantKey>;
  hiddenExperienceIds: string[];
  hiddenAwardIds: string[];
  hiddenModuleIds: ResumeModuleKey[];
  steps: string[];
};

const getExperiencePriorityScore = (experience: ExperienceAsset) =>
  experience.priority + experience.metrics.length * 5 + (experience.locked ? 100 : 0);

const nextVariant = (current: ExperienceVariantKey): ExperienceVariantKey | null => {
  const index = VARIANT_ORDER.indexOf(current);
  if (index === -1 || index === VARIANT_ORDER.length - 1) {
    return null;
  }

  return VARIANT_ORDER[index + 1] ?? null;
};

const previousVariant = (current: ExperienceVariantKey): ExperienceVariantKey | null => {
  const index = VARIANT_ORDER.indexOf(current);
  if (index <= 0) {
    return null;
  }

  return VARIANT_ORDER[index - 1] ?? null;
};

const getDensityIndex = (density: DensityMode) => DENSITY_ORDER.indexOf(density);

const maxDensity = (left: DensityMode, right: DensityMode): DensityMode =>
  getDensityIndex(left) >= getDensityIndex(right) ? left : right;

const getDensityBudget = (manifest: TemplateManifest, density: DensityMode) =>
  DENSITY_BUDGETS[density] + MARGIN_BUDGET_ADJUSTMENTS[manifest.page.marginPreset];

const resolveManifest = (workspace: WorkspaceData) =>
  resolveTemplateManifestById(
    workspace.templateSession?.selectedTemplateId ?? workspace.layoutPlan.templateMode,
    workspace.templateSession?.candidateManifests,
  );

const resolveSelectedVariants = (workspace: WorkspaceData) => {
  const visibleExperienceIdSet = new Set(workspace.experiences.map((experience) => experience.id));
  const source = workspace.renderState?.selectedVariants ?? workspace.draft.selectedVariants;

  return Object.fromEntries(
    Object.entries(source)
      .filter(([experienceId]) => visibleExperienceIdSet.has(experienceId))
      .map(([experienceId, variant]) => [experienceId, variant]),
  ) as Record<string, ExperienceVariantKey>;
};

const resolveRequestedHiddenModuleIds = (workspace: WorkspaceData) =>
  MODULE_ORDER.filter((moduleId) => workspace.renderState?.hiddenModuleIds.includes(moduleId));

const deriveHiddenModuleIds = (
  workspace: WorkspaceData,
  hiddenExperienceIds: string[],
  hiddenAwardIds: string[],
  requestedHiddenModuleIds: ResumeModuleKey[],
) => {
  const hiddenModuleIds = new Set<ResumeModuleKey>(requestedHiddenModuleIds);

  if (workspace.education.length === 0) {
    hiddenModuleIds.add("education");
  }

  if (
    workspace.experiences.filter((experience) => !hiddenExperienceIds.includes(experience.id)).length === 0
  ) {
    hiddenModuleIds.add("experience");
  }

  if (workspace.awards.filter((award) => !hiddenAwardIds.includes(award.id)).length === 0) {
    hiddenModuleIds.add("awards");
  }

  if (workspace.skills.length === 0) {
    hiddenModuleIds.add("skills");
  }

  return MODULE_ORDER.filter((moduleId) => hiddenModuleIds.has(moduleId));
};

const resolveVisibleSectionOrder = (
  workspace: WorkspaceData,
  manifest: TemplateManifest,
  hiddenModuleIds: ResumeModuleKey[],
) => {
  const allowedSections = manifest.sectionOrder.filter(
    (section, index, list) => list.indexOf(section) === index,
  );
  const moduleOrder = workspace.templateSession?.moduleOrder ?? MODULE_ORDER;
  const orderedFromSession = moduleOrder.filter(
    (moduleId): moduleId is Exclude<ResumeModuleKey, "profile"> =>
      moduleId !== "profile" && allowedSections.includes(moduleId),
  );
  const mergedOrder = [
    ...orderedFromSession,
    ...allowedSections.filter((section) => !orderedFromSession.includes(section)),
  ];
  const hiddenModuleIdSet = new Set(hiddenModuleIds);

  return mergedOrder.filter((section) => !hiddenModuleIdSet.has(section));
};

const estimateLineCount = (
  workspace: WorkspaceData,
  manifest: TemplateManifest,
  state: BalanceState,
) => {
  const hiddenModuleIds = deriveHiddenModuleIds(
    workspace,
    state.hiddenExperienceIds,
    state.hiddenAwardIds,
    state.hiddenModuleIds,
  );
  let total = hiddenModuleIds.includes("profile") ? 0 : workspace.profile.photo ? 7 : 5;

  for (const section of resolveVisibleSectionOrder(workspace, manifest, hiddenModuleIds)) {
    if (section === "education" && workspace.education.length > 0) {
      total += 4;
      continue;
    }

    if (section === "experience") {
      for (const experience of workspace.experiences) {
        if (state.hiddenExperienceIds.includes(experience.id)) {
          continue;
        }

        total += state.selectedVariants[experience.id] ? VARIANT_COSTS[state.selectedVariants[experience.id]!] : VARIANT_COSTS.standard;
      }
      continue;
    }

    if (section === "awards") {
      for (const award of workspace.awards) {
        if (!state.hiddenAwardIds.includes(award.id)) {
          total += 1;
        }
      }
      continue;
    }

    if (section === "skills" && workspace.skills.length > 0) {
      total += 1;
    }
  }

  if (state.density === "airy") {
    total += 2;
  }

  if (state.density === "balanced") {
    total += 1;
  }

  return total;
};

const canFitWithinBudget = (workspace: WorkspaceData, manifest: TemplateManifest, state: BalanceState) =>
  estimateLineCount(workspace, manifest, state) <= getDensityBudget(manifest, state.density);

const compactOneVisibleExperience = (
  workspace: WorkspaceData,
  state: BalanceState,
) => {
  if (deriveHiddenModuleIds(workspace, state.hiddenExperienceIds, state.hiddenAwardIds, state.hiddenModuleIds).includes("experience")) {
    return false;
  }

  const ordered = [...workspace.experiences]
    .filter((experience) => !experience.locked && !state.hiddenExperienceIds.includes(experience.id))
    .sort((left, right) => left.priority - right.priority);

  for (const experience of ordered) {
    const current = state.selectedVariants[experience.id] ?? "standard";
    const candidate = nextVariant(current);

    if (!candidate) {
      continue;
    }

    state.selectedVariants[experience.id] = candidate;
    state.steps.push(`variant:${experience.id}:${candidate}`);
    return true;
  }

  return false;
};

const densify = (state: BalanceState) => {
  const index = DENSITY_ORDER.indexOf(state.density);
  if (index === -1 || index === DENSITY_ORDER.length - 1) {
    return false;
  }

  const next = DENSITY_ORDER[index + 1] ?? state.density;
  state.density = next;
  state.steps.push(`density:${next}`);
  return true;
};

const loosenDensity = (
  workspace: WorkspaceData,
  manifest: TemplateManifest,
  state: BalanceState,
) => {
  const index = DENSITY_ORDER.indexOf(state.density);
  const minimumDensityIndex = getDensityIndex(manifest.compactionPolicy.density);
  if (index <= minimumDensityIndex) {
    return false;
  }

  const next = DENSITY_ORDER[index - 1] ?? state.density;
  const candidateState: BalanceState = {
    ...state,
    density: next,
    selectedVariants: { ...state.selectedVariants },
    hiddenExperienceIds: [...state.hiddenExperienceIds],
    hiddenAwardIds: [...state.hiddenAwardIds],
    hiddenModuleIds: [...state.hiddenModuleIds],
    steps: [...state.steps],
  };

  if (!canFitWithinBudget(workspace, manifest, candidateState)) {
    return false;
  }

  state.density = next;
  state.steps.push(`density:${next}`);
  return true;
};

const hideLowestPriorityAward = (workspace: WorkspaceData, state: BalanceState) => {
  if (deriveHiddenModuleIds(workspace, state.hiddenExperienceIds, state.hiddenAwardIds, state.hiddenModuleIds).includes("awards")) {
    return false;
  }

  const candidate = [...workspace.awards]
    .filter((award) => !state.hiddenAwardIds.includes(award.id))
    .sort((left, right) => left.priority - right.priority)[0];

  if (!candidate) {
    return false;
  }

  state.hiddenAwardIds.push(candidate.id);
  state.steps.push(`hide-award:${candidate.id}`);
  return true;
};

const restoreHighestPriorityAward = (
  workspace: WorkspaceData,
  manifest: TemplateManifest,
  state: BalanceState,
) => {
  const candidates = [...workspace.awards]
    .filter((award) => state.hiddenAwardIds.includes(award.id))
    .sort((left, right) => right.priority - left.priority);

  for (const award of candidates) {
    const nextState: BalanceState = {
      ...state,
      selectedVariants: { ...state.selectedVariants },
      hiddenExperienceIds: [...state.hiddenExperienceIds],
      hiddenAwardIds: state.hiddenAwardIds.filter((awardId) => awardId !== award.id),
      hiddenModuleIds: [...state.hiddenModuleIds],
      steps: [...state.steps],
    };

    if (!canFitWithinBudget(workspace, manifest, nextState)) {
      continue;
    }

    state.hiddenAwardIds.splice(0, state.hiddenAwardIds.length, ...nextState.hiddenAwardIds);
    state.steps.push(`restore-award:${award.id}`);
    return true;
  }

  return false;
};

const hideSkillsSection = (workspace: WorkspaceData, state: BalanceState) => {
  if (
    workspace.skills.length === 0 ||
    state.hiddenModuleIds.includes("skills") ||
    deriveHiddenModuleIds(workspace, state.hiddenExperienceIds, state.hiddenAwardIds, state.hiddenModuleIds).includes("skills")
  ) {
    return false;
  }

  state.hiddenModuleIds.push("skills");
  state.steps.push("hide-section:skills");
  return true;
};

const restoreHiddenModuleByOrder = (
  workspace: WorkspaceData,
  manifest: TemplateManifest,
  state: BalanceState,
) => {
  const hiddenModuleIdSet = new Set(state.hiddenModuleIds);
  const orderedHiddenModules = resolveVisibleSectionOrder(
    {
      ...workspace,
      renderState: workspace.renderState
        ? {
            ...workspace.renderState,
            hiddenModuleIds: [],
          }
        : workspace.renderState,
    },
    manifest,
    [],
  ).filter((section) => hiddenModuleIdSet.has(section));

  for (const moduleId of orderedHiddenModules) {
    const nextHiddenModuleIds = state.hiddenModuleIds.filter((candidate) => candidate !== moduleId);
    const nextState: BalanceState = {
      ...state,
      selectedVariants: { ...state.selectedVariants },
      hiddenExperienceIds: [...state.hiddenExperienceIds],
      hiddenAwardIds: [...state.hiddenAwardIds],
      hiddenModuleIds: nextHiddenModuleIds,
      steps: [...state.steps],
    };

    if (!canFitWithinBudget(workspace, manifest, nextState)) {
      continue;
    }

    state.hiddenModuleIds.splice(0, state.hiddenModuleIds.length, ...nextHiddenModuleIds);
    state.steps.push(`restore-section:${moduleId}`);
    return true;
  }

  return false;
};

const hideLowestPriorityExperience = (workspace: WorkspaceData, state: BalanceState) => {
  if (deriveHiddenModuleIds(workspace, state.hiddenExperienceIds, state.hiddenAwardIds, state.hiddenModuleIds).includes("experience")) {
    return false;
  }

  const candidate = [...workspace.experiences]
    .filter((experience) => !experience.locked && !state.hiddenExperienceIds.includes(experience.id))
    .sort((left, right) => getExperiencePriorityScore(left) - getExperiencePriorityScore(right))[0];

  if (!candidate) {
    return false;
  }

  state.hiddenExperienceIds.push(candidate.id);
  state.steps.push(`hide-experience:${candidate.id}`);
  return true;
};

const restoreHighestPriorityExperience = (
  workspace: WorkspaceData,
  manifest: TemplateManifest,
  state: BalanceState,
) => {
  const candidates = [...workspace.experiences]
    .filter((experience) => state.hiddenExperienceIds.includes(experience.id))
    .sort((left, right) => getExperiencePriorityScore(right) - getExperiencePriorityScore(left));

  for (const experience of candidates) {
    const nextHiddenExperienceIds = state.hiddenExperienceIds.filter((id) => id !== experience.id);
    const originalVariant = state.selectedVariants[experience.id] ?? "standard";
    const variantCandidates: ExperienceVariantKey[] = [];
    let candidateVariant: ExperienceVariantKey | null = originalVariant;

    while (candidateVariant && !variantCandidates.includes(candidateVariant)) {
      variantCandidates.push(candidateVariant);
      candidateVariant = nextVariant(candidateVariant);
    }

    for (const variant of variantCandidates) {
      const nextState: BalanceState = {
        ...state,
        selectedVariants: {
          ...state.selectedVariants,
          [experience.id]: variant,
        },
        hiddenExperienceIds: nextHiddenExperienceIds,
        hiddenAwardIds: [...state.hiddenAwardIds],
        hiddenModuleIds: [...state.hiddenModuleIds],
        steps: [...state.steps],
      };

      if (!canFitWithinBudget(workspace, manifest, nextState)) {
        continue;
      }

      state.hiddenExperienceIds.splice(0, state.hiddenExperienceIds.length, ...nextHiddenExperienceIds);
      state.selectedVariants[experience.id] = variant;
      state.steps.push(`restore-experience:${experience.id}`);
      if (variant !== originalVariant) {
        state.steps.push(`variant:${experience.id}:${variant}`);
      }
      return true;
    }
  }

  return false;
};

const expandOneVisibleExperience = (
  workspace: WorkspaceData,
  manifest: TemplateManifest,
  state: BalanceState,
) => {
  if (deriveHiddenModuleIds(workspace, state.hiddenExperienceIds, state.hiddenAwardIds, state.hiddenModuleIds).includes("experience")) {
    return false;
  }

  const candidates = [...workspace.experiences]
    .filter((experience) => !state.hiddenExperienceIds.includes(experience.id))
    .sort((left, right) => {
      const leftVariantIndex = VARIANT_ORDER.indexOf(state.selectedVariants[left.id] ?? "standard");
      const rightVariantIndex = VARIANT_ORDER.indexOf(state.selectedVariants[right.id] ?? "standard");

      if (leftVariantIndex !== rightVariantIndex) {
        return rightVariantIndex - leftVariantIndex;
      }

      return getExperiencePriorityScore(right) - getExperiencePriorityScore(left);
    });

  for (const experience of candidates) {
    const current = state.selectedVariants[experience.id] ?? "standard";
    if (VARIANT_ORDER.indexOf(current) <= VARIANT_ORDER.indexOf("standard")) {
      continue;
    }

    const expanded = previousVariant(current);
    if (!expanded) {
      continue;
    }

    const nextState: BalanceState = {
      ...state,
      selectedVariants: {
        ...state.selectedVariants,
        [experience.id]: expanded,
      },
      hiddenExperienceIds: [...state.hiddenExperienceIds],
      hiddenAwardIds: [...state.hiddenAwardIds],
      hiddenModuleIds: [...state.hiddenModuleIds],
      steps: [...state.steps],
    };

    if (!canFitWithinBudget(workspace, manifest, nextState)) {
      continue;
    }

    state.selectedVariants[experience.id] = expanded;
    state.steps.push(`variant:${experience.id}:${expanded}`);
    return true;
  }

  return false;
};

const tryOverflowPriorityCompaction = (
  workspace: WorkspaceData,
  manifest: TemplateManifest,
  state: BalanceState,
) => {
  for (const priority of manifest.compactionPolicy.overflowPriority) {
    if (priority === "awards" && hideLowestPriorityAward(workspace, state)) {
      return true;
    }

    if (priority === "skills" && hideSkillsSection(workspace, state)) {
      return true;
    }

    if (priority === "experience" && hideLowestPriorityExperience(workspace, state)) {
      return true;
    }
  }

  return false;
};

const finalizeLayoutPlan = (
  workspace: WorkspaceData,
  manifest: TemplateManifest,
  state: BalanceState,
  estimatedLineCount: number,
): LayoutPlan => {
  const hiddenModuleIds = deriveHiddenModuleIds(
    workspace,
    state.hiddenExperienceIds,
    state.hiddenAwardIds,
    state.hiddenModuleIds,
  );
  const budget = getDensityBudget(manifest, state.density);
  let finalEstimatedLineCount = estimatedLineCount;
  let showSummary = false;

  if (estimatedLineCount <= SPARSE_THRESHOLD) {
    const withSummary = estimatedLineCount + SUMMARY_LINE_COST;
    if (withSummary <= budget) {
      finalEstimatedLineCount = withSummary;
      showSummary = true;
      state.steps.push("summary:visible");
    }
  }

  const hasCompression =
    state.steps.some((step) => step.startsWith("variant:") || step.startsWith("density:") || step.startsWith("hide-")) ||
    state.hiddenExperienceIds.length > 0 ||
    state.hiddenAwardIds.length > 0 ||
    hiddenModuleIds.some(
      (moduleId) =>
        (moduleId === "skills" && workspace.skills.length > 0) ||
        moduleId === "profile",
    );

  const contentBalance: ContentBalance = showSummary
    ? "sparse"
    : hasCompression
      ? "dense"
      : "balanced";
  const overflowStatus = finalEstimatedLineCount <= budget ? "fits" : "requires-trim";

  return {
    density: state.density,
    hiddenExperienceIds: [...state.hiddenExperienceIds],
    hiddenAwardIds: [...state.hiddenAwardIds],
    hiddenModuleIds,
    selectedVariants: { ...state.selectedVariants },
    overflowStatus,
    exportAllowed: true,
    blockingReasons: overflowStatus === "fits" ? [] : ["当前版本已超出一页，导出后会分页。"],
    headerVariant: workspace.profile.photo ? "photo-present" : "photo-absent",
    templateMode: manifest.templateId,
    steps: [...state.steps],
    estimatedLineCount: finalEstimatedLineCount,
    contentBalance,
    showSummary,
  };
};

export const balanceResumeDraft = (workspace: WorkspaceData): LayoutPlan => {
  const manifest = resolveManifest(workspace);
  const state: BalanceState = {
    density: maxDensity(
      workspace.renderState?.density ?? workspace.draft.density ?? manifest.compactionPolicy.density,
      manifest.compactionPolicy.density,
    ),
    selectedVariants: resolveSelectedVariants(workspace),
    hiddenExperienceIds: [
      ...(workspace.renderState?.hiddenExperienceIds ?? workspace.draft.hiddenExperienceIds ?? []),
    ].filter((experienceId) => workspace.experiences.some((experience) => experience.id === experienceId)),
    hiddenAwardIds: [
      ...(workspace.renderState?.hiddenAwardIds ?? workspace.draft.hiddenAwardIds ?? []),
    ].filter((awardId) => workspace.awards.some((award) => award.id === awardId)),
    hiddenModuleIds: resolveRequestedHiddenModuleIds(workspace),
    steps: [],
  };

  let estimatedLineCount = estimateLineCount(workspace, manifest, state);

  while (estimatedLineCount > getDensityBudget(manifest, state.density)) {
    const compacted = compactOneVisibleExperience(workspace, state);
    estimatedLineCount = estimateLineCount(workspace, manifest, state);

    if (estimatedLineCount <= getDensityBudget(manifest, state.density)) {
      break;
    }

    if (compacted) {
      continue;
    }

    if (densify(state)) {
      estimatedLineCount = estimateLineCount(workspace, manifest, state);
      continue;
    }

    if (tryOverflowPriorityCompaction(workspace, manifest, state)) {
      estimatedLineCount = estimateLineCount(workspace, manifest, state);
      continue;
    }

    break;
  }

  let relaxed = true;
  while (relaxed) {
    relaxed = false;

    if (loosenDensity(workspace, manifest, state)) {
      relaxed = true;
      continue;
    }

    if (restoreHiddenModuleByOrder(workspace, manifest, state)) {
      relaxed = true;
      continue;
    }

    if (restoreHighestPriorityExperience(workspace, manifest, state)) {
      relaxed = true;
      continue;
    }

    if (restoreHighestPriorityAward(workspace, manifest, state)) {
      relaxed = true;
      continue;
    }

    if (expandOneVisibleExperience(workspace, manifest, state)) {
      relaxed = true;
    }
  }

  estimatedLineCount = estimateLineCount(workspace, manifest, state);

  return finalizeLayoutPlan(workspace, manifest, state, estimatedLineCount);
};
