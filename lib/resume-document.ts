import { deriveExperienceVariants, normalizeExperienceBullets } from "@/lib/experience";
import { balanceResumeDraft } from "@/lib/layout-plan";
import {
  BASELINE_TEMPLATE_MANIFESTS,
  hydrateTemplateManifestDisplayCopy,
  resolveTemplateManifestById,
  type TemplateManifest,
} from "@/lib/template-manifest";
import type {
  AwardAsset,
  DensityMode,
  EducationAsset,
  ExperienceAsset,
  ExperienceVariantKey,
  GuidedAnswers,
  IntakeState,
  LayoutPlan,
  OverflowStatus,
  ProfileAsset,
  ResumeDraft,
  WorkspaceData,
  WorkspaceMeta,
} from "@/lib/types";

export type ResumeModuleKey = "profile" | "education" | "experience" | "awards" | "skills";

export type ResumeContentDocument = {
  profile: ProfileAsset;
  education: EducationAsset[];
  experiences: ExperienceAsset[];
  awards: AwardAsset[];
  skills: string[];
  intake: IntakeState;
  meta: {
    language: "zh-CN";
    targetAudience: "campus-recruiting";
    completeness: "baseline";
    evidenceStrength: "mixed";
  };
};

export type TemplateSession = {
  version: "v1";
  candidateTemplateIds: string[];
  candidateManifests?: TemplateManifest[];
  selectedTemplateId: string;
  moduleOrder: ResumeModuleKey[];
};

export type RenderState = {
  density: DensityMode;
  selectedVariants: Record<string, ExperienceVariantKey>;
  lockedExperienceIds: string[];
  hiddenExperienceIds: string[];
  hiddenAwardIds: string[];
  hiddenModuleIds: ResumeModuleKey[];
  overflowStatus: OverflowStatus;
  exportAllowed: boolean;
  blockingReasons: string[];
};

export const BASELINE_TEMPLATE_IDS = BASELINE_TEMPLATE_MANIFESTS.map((manifest) => manifest.templateId);
export const DEFAULT_MODULE_ORDER: ResumeModuleKey[] = [
  "profile",
  "education",
  "experience",
  "awards",
  "skills",
];

const DEFAULT_CONTENT_META: ResumeContentDocument["meta"] = {
  language: "zh-CN",
  targetAudience: "campus-recruiting",
  completeness: "baseline",
  evidenceStrength: "mixed",
};

const createId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const createProfile = (answers: GuidedAnswers): ProfileAsset => ({
  fullName: answers.fullName,
  targetRole: answers.targetRole,
  phone: answers.phone,
  email: answers.email,
  location: answers.location,
  preferredLocation: answers.location,
  summary: `面向${answers.targetRole}方向，优先突出可量化成果与招聘判断力。`,
  compactProfileNote: `面向${answers.targetRole}方向，优先突出可量化成果与判断力。`,
  photo: null,
});

const createEducation = (answers: GuidedAnswers): EducationAsset[] => [
  {
    id: createId("edu"),
    school: answers.education.school,
    degree: answers.education.degree,
    dateRange: answers.education.dateRange,
    highlights: [],
  },
];

const createExperiences = (answers: GuidedAnswers): ExperienceAsset[] => {
  const experienceId = createId("exp");
  const bullets = normalizeExperienceBullets([answers.topExperience.narrative]);

  return [
    {
      id: experienceId,
      section: "internship",
      organization: answers.topExperience.organization,
      role: answers.topExperience.role,
      dateRange: answers.topExperience.dateRange,
      priority: 100,
      locked: true,
      rawNarrative: answers.topExperience.narrative,
      bullets,
      metrics: answers.topExperience.narrative.match(/\d+[^\s，。；]*/g) ?? [],
      tags: [answers.targetRole],
      variants: deriveExperienceVariants(bullets),
    },
  ];
};

const createContentMeta = (): ResumeContentDocument["meta"] => ({
  ...DEFAULT_CONTENT_META,
});

const buildContentDocument = (
  answers: GuidedAnswers,
  intake: IntakeState,
): ResumeContentDocument => ({
  profile: createProfile(answers),
  education: createEducation(answers),
  experiences: createExperiences(answers),
  awards: [],
  skills: [...answers.skills],
  intake,
  meta: createContentMeta(),
});

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const DATE_RANGE_PATTERN = /\d{4}[./-]\d{1,2}\s*[-–—~至]\s*\d{4}[./-]\d{1,2}/;

const matchField = (text: string, label: string) => {
  const escapedLabel = escapeRegex(label);
  const patterns = [
    new RegExp(`(?:^|\\n)\\s*${escapedLabel}\\s*[:：]\\s*(.+)$`, "m"),
    new RegExp(`(?:^|\\n)\\s*${escapedLabel}\\s+(.+)$`, "m"),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1]?.trim();
    if (match) {
      return match;
    }
  }

  return "";
};

const parsePasteText = (text: string): GuidedAnswers => {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const unlabeledStructuredLines = lines.filter(
    (line) => !/^(目标岗位|电话|邮箱|所在地|地点|教育|经历)\s*(?:[:：]|\s)/.test(line),
  );
  const fullName = lines[0] ?? "未命名候选人";
  const targetRole = matchField(text, "目标岗位") || "求职意向待完善";
  const phone = matchField(text, "电话");
  const email = matchField(text, "邮箱");
  const location = matchField(text, "所在地") || matchField(text, "地点");
  const educationLine =
    matchField(text, "教育") ||
    unlabeledStructuredLines.find(
      (line) => DATE_RANGE_PATTERN.test(line) && /(大学|学院|学校|本科|硕士|博士|专科|中学|高中)/.test(line),
    ) ||
    "";
  const experienceLine =
    matchField(text, "经历") ||
    unlabeledStructuredLines.find(
      (line) => line !== educationLine && DATE_RANGE_PATTERN.test(line),
    ) ||
    "";
  const educationParts = educationLine.split(/\s+/).filter(Boolean);
  const experienceParts = experienceLine.split(/\s+/).filter(Boolean);
  const educationDate = educationParts.at(-1) ?? "";
  const experienceDate = experienceParts.at(2) ?? "";

  return {
    fullName,
    targetRole,
    phone,
    email,
    location,
    education: {
      school: educationParts[0] ?? "教育信息待完善",
      degree: educationParts.slice(1, -1).join(" ") || "专业待完善",
      dateRange: educationDate,
    },
    topExperience: {
      organization: experienceParts[0] ?? "经历待完善",
      role: experienceParts[1] ?? "岗位待完善",
      dateRange: experienceDate,
      narrative: experienceParts.slice(3).join(" ") || text,
    },
    skills: targetRole.includes("招聘")
      ? ["招聘", "候选人沟通", "流程推进"]
      : ["沟通", "执行", "学习能力"],
  };
};

export const createBaselineContentDocumentFromGuidedAnswers = (
  answers: GuidedAnswers,
): ResumeContentDocument =>
  buildContentDocument(answers, {
    mode: "guided",
    turns: [],
  });

export const createBaselineContentDocumentFromPasteText = (
  text: string,
): ResumeContentDocument =>
  buildContentDocument(parsePasteText(text), {
    mode: "paste",
    turns: [],
  });

const resolveCandidateTemplateManifests = (
  candidateManifests?: readonly TemplateManifest[],
  candidateTemplateIds: readonly string[] = BASELINE_TEMPLATE_IDS,
) => {
  const sourceCandidateManifests = candidateManifests ?? [];
  type HydrationManifestInput = Parameters<typeof hydrateTemplateManifestDisplayCopy>[0];
  const manifestById = new Map<string, TemplateManifest>();
  const orderedManifests: TemplateManifest[] = [];

  const toHydrationInput = (manifest: TemplateManifest): HydrationManifestInput => ({
    ...manifest,
    sectionOrder: [...manifest.sectionOrder],
    compactionPolicy: {
      ...manifest.compactionPolicy,
      overflowPriority: [...manifest.compactionPolicy.overflowPriority],
    },
    previewHighlights: manifest.previewHighlights ? [...manifest.previewHighlights] : undefined,
  });

  for (const manifest of sourceCandidateManifests) {
    const hydratedManifest = hydrateTemplateManifestDisplayCopy(toHydrationInput(manifest));
    manifestById.set(hydratedManifest.templateId, hydratedManifest);
  }

  for (const templateId of candidateTemplateIds) {
    const manifest =
      manifestById.get(templateId) ??
      resolveTemplateManifestById(templateId, sourceCandidateManifests);
    if (manifest.templateId !== templateId || orderedManifests.some((item) => item.templateId === templateId)) {
      continue;
    }

    const hydratedManifest = hydrateTemplateManifestDisplayCopy(toHydrationInput(manifest));
    orderedManifests.push(hydratedManifest);
    manifestById.set(templateId, hydratedManifest);
  }

  for (const manifest of sourceCandidateManifests) {
    const hydratedManifest = hydrateTemplateManifestDisplayCopy(toHydrationInput(manifest));
    if (orderedManifests.some((item) => item.templateId === hydratedManifest.templateId)) {
      continue;
    }

    orderedManifests.push(hydratedManifest);
  }

  if (orderedManifests.length === 0) {
    for (const manifest of BASELINE_TEMPLATE_MANIFESTS) {
      orderedManifests.push(hydrateTemplateManifestDisplayCopy(toHydrationInput(manifest)));
    }
  }

  return orderedManifests;
};

const deriveModuleOrderFromManifest = (
  manifest?: TemplateManifest,
): ResumeModuleKey[] =>
  manifest ? ["profile", ...manifest.sectionOrder] : [...DEFAULT_MODULE_ORDER];

const normalizeTemplateSession = (
  templateSession: Partial<Omit<TemplateSession, "candidateManifests">> & {
    candidateManifests?: readonly TemplateManifest[];
  } = {},
): TemplateSession => {
  const candidateManifests = resolveCandidateTemplateManifests(
    templateSession.candidateManifests,
    templateSession.candidateTemplateIds,
  );
  const candidateTemplateIds = candidateManifests.map((manifest) => manifest.templateId);
  const selectedManifest =
    candidateManifests.find(
      (manifest) => manifest.templateId === templateSession.selectedTemplateId,
    ) ?? candidateManifests[0];

  return {
    version: "v1",
    candidateManifests,
    candidateTemplateIds,
    selectedTemplateId:
      selectedManifest?.templateId ?? templateSession.selectedTemplateId ?? "flagship-reference",
    moduleOrder: deriveModuleOrderFromManifest(selectedManifest),
  };
};

export const deriveInitialTemplateSession = (
  candidateManifests: readonly TemplateManifest[] = BASELINE_TEMPLATE_MANIFESTS,
): TemplateSession =>
  normalizeTemplateSession({
    candidateManifests,
    candidateTemplateIds: candidateManifests.map((manifest) => manifest.templateId),
    selectedTemplateId: candidateManifests[0]?.templateId ?? "flagship-reference",
  });

export const deriveInitialRenderState = (
  contentDocument: ResumeContentDocument,
): RenderState => ({
  density: "airy",
  selectedVariants: Object.fromEntries(
    contentDocument.experiences.map((experience) => [experience.id, "standard"]),
  ),
  lockedExperienceIds: contentDocument.experiences
    .filter((experience) => experience.locked)
    .map((experience) => experience.id),
  hiddenExperienceIds: [],
  hiddenAwardIds: [],
  hiddenModuleIds: [],
  overflowStatus: "fits",
  exportAllowed: true,
  blockingReasons: [],
});

const toResumeDraft = (
  templateSession: TemplateSession,
  renderState: RenderState,
): ResumeDraft => ({
  selectedVariants: { ...renderState.selectedVariants },
  lockedExperienceIds: [...renderState.lockedExperienceIds],
  hiddenExperienceIds: [...renderState.hiddenExperienceIds],
  hiddenAwardIds: [...renderState.hiddenAwardIds],
  density: renderState.density,
  moduleOrder: [...templateSession.moduleOrder],
});

const createInitialLayoutPlan = (renderState: RenderState, templateSession: TemplateSession): LayoutPlan => ({
  density: renderState.density,
  hiddenExperienceIds: [...renderState.hiddenExperienceIds],
  hiddenAwardIds: [...renderState.hiddenAwardIds],
  hiddenModuleIds: [...renderState.hiddenModuleIds],
  selectedVariants: { ...renderState.selectedVariants },
  overflowStatus: renderState.overflowStatus,
  exportAllowed: renderState.exportAllowed,
  blockingReasons: [...renderState.blockingReasons],
  headerVariant: "photo-absent",
  templateMode: templateSession.selectedTemplateId,
  steps: [],
  estimatedLineCount: 0,
  contentBalance: "balanced",
  showSummary: false,
});

const filterPersistableHiddenModuleIds = (
  workspace: Pick<WorkspaceData, "skills">,
  hiddenModuleIds: ResumeModuleKey[],
): ResumeModuleKey[] =>
  hiddenModuleIds.filter((moduleId) => {
    if (moduleId === "profile") {
      return true;
    }

    if (moduleId === "skills") {
      return workspace.skills.length > 0;
    }

    return false;
  });

const syncRenderStateWithLayoutPlan = (
  workspace: Pick<WorkspaceData, "skills">,
  renderState: RenderState,
  layoutPlan: LayoutPlan,
): RenderState => ({
  ...renderState,
  density: layoutPlan.density,
  selectedVariants: { ...layoutPlan.selectedVariants },
  hiddenExperienceIds: [...layoutPlan.hiddenExperienceIds],
  hiddenAwardIds: [...layoutPlan.hiddenAwardIds],
  hiddenModuleIds: filterPersistableHiddenModuleIds(workspace, layoutPlan.hiddenModuleIds),
  overflowStatus: layoutPlan.overflowStatus,
  exportAllowed: layoutPlan.exportAllowed ?? renderState.exportAllowed,
  blockingReasons: [...(layoutPlan.blockingReasons ?? renderState.blockingReasons)],
});

const normalizeContentDocument = (
  contentDocument: Omit<ResumeContentDocument, "meta"> & {
    meta?: Partial<ResumeContentDocument["meta"]>;
  },
): ResumeContentDocument => ({
  profile: contentDocument.profile,
  education: [...contentDocument.education],
  experiences: [...contentDocument.experiences],
  awards: [...contentDocument.awards],
  skills: [...contentDocument.skills],
  intake: {
    mode: contentDocument.intake.mode,
    turns: [...contentDocument.intake.turns],
  },
  meta: {
    ...DEFAULT_CONTENT_META,
    ...(contentDocument.meta ?? {}),
  },
});

type WorkspaceBridgeInput = {
  contentDocument: ResumeContentDocument;
  templateSession: TemplateSession;
  renderState: RenderState;
  meta: WorkspaceMeta;
};

type WorkspaceBridgeOptions = {
  rebalance?: boolean;
};

export const createWorkspaceDataBridge = ({
  contentDocument,
  templateSession,
  renderState,
  meta,
}: WorkspaceBridgeInput, options: WorkspaceBridgeOptions = {}): WorkspaceData => {
  const normalizedContentDocument = normalizeContentDocument(contentDocument);
  const normalizedTemplateSession = normalizeTemplateSession(templateSession);
  const normalizedRenderState: RenderState = {
    ...renderState,
    selectedVariants: { ...renderState.selectedVariants },
    lockedExperienceIds: [...renderState.lockedExperienceIds],
    hiddenExperienceIds: [...renderState.hiddenExperienceIds],
    hiddenAwardIds: [...renderState.hiddenAwardIds],
    hiddenModuleIds: [...renderState.hiddenModuleIds],
    blockingReasons: [...renderState.blockingReasons],
  };

  const workspace: WorkspaceData = {
    profile: normalizedContentDocument.profile,
    education: normalizedContentDocument.education,
    experiences: normalizedContentDocument.experiences,
    awards: normalizedContentDocument.awards,
    skills: normalizedContentDocument.skills,
    intake: normalizedContentDocument.intake,
    draft: toResumeDraft(normalizedTemplateSession, normalizedRenderState),
    layoutPlan: createInitialLayoutPlan(normalizedRenderState, normalizedTemplateSession),
    meta,
    contentDocument: normalizedContentDocument,
    templateSession: normalizedTemplateSession,
    renderState: normalizedRenderState,
  };

  if (options.rebalance) {
    workspace.layoutPlan = balanceResumeDraft(workspace);
    workspace.renderState = syncRenderStateWithLayoutPlan(
      workspace,
      normalizedRenderState,
      workspace.layoutPlan,
    );
    workspace.draft = toResumeDraft(workspace.templateSession!, workspace.renderState!);
  }

  return workspace;
};

export const createWorkspaceFromGuidedAnswers = (answers: GuidedAnswers): WorkspaceData => {
  const contentDocument = createBaselineContentDocumentFromGuidedAnswers(answers);
  const templateSession = deriveInitialTemplateSession();
  const renderState = deriveInitialRenderState(contentDocument);
  const updatedAt = new Date().toISOString();

  return createWorkspaceDataBridge({
    contentDocument,
    templateSession,
    renderState,
    meta: {
      updatedAt,
      firstDraftAt: updatedAt,
    },
  }, {
    rebalance: true,
  });
};

export const createWorkspaceFromPasteText = (text: string): WorkspaceData => {
  const contentDocument = createBaselineContentDocumentFromPasteText(text);
  const templateSession = deriveInitialTemplateSession();
  const renderState = deriveInitialRenderState(contentDocument);
  const updatedAt = new Date().toISOString();

  return createWorkspaceDataBridge({
    contentDocument,
    templateSession,
    renderState,
    meta: {
      updatedAt,
      firstDraftAt: updatedAt,
    },
  }, {
    rebalance: true,
  });
};

type LegacyWorkspaceShape = Pick<
  WorkspaceData,
  | "profile"
  | "education"
  | "experiences"
  | "awards"
  | "skills"
  | "intake"
  | "draft"
  | "layoutPlan"
  | "meta"
> & {
  contentDocument?: ResumeContentDocument;
  templateSession?: TemplateSession;
  renderState?: RenderState;
};

const looksLikeLegacyWorkspace = (
  value: unknown,
): value is LegacyWorkspaceShape =>
  Boolean(
    value &&
      typeof value === "object" &&
      "profile" in value &&
      "education" in value &&
      "experiences" in value &&
      "draft" in value &&
      "layoutPlan" in value,
  );

const looksLikeSplitWorkspace = (
  value: unknown,
): value is Pick<WorkspaceBridgeInput, "contentDocument" | "templateSession" | "renderState" | "meta"> =>
  Boolean(
    value &&
      typeof value === "object" &&
      "contentDocument" in value &&
      "templateSession" in value &&
      "renderState" in value,
  );

export const createContentDocumentFromLegacyWorkspace = (
  workspace: LegacyWorkspaceShape,
): ResumeContentDocument =>
  normalizeContentDocument({
    profile: workspace.profile,
    education: workspace.education,
    experiences: workspace.experiences,
    awards: workspace.awards,
    skills: workspace.skills,
    intake: workspace.intake,
    meta: workspace.contentDocument?.meta,
  });

export const deriveTemplateSessionFromLegacyWorkspace = (
  workspace: LegacyWorkspaceShape,
): TemplateSession =>
  normalizeTemplateSession({
    version: workspace.templateSession?.version ?? "v1",
    candidateManifests: workspace.templateSession?.candidateManifests,
    candidateTemplateIds: workspace.templateSession?.candidateTemplateIds,
    selectedTemplateId:
      workspace.templateSession?.selectedTemplateId ?? workspace.layoutPlan.templateMode,
  });

export const deriveRenderStateFromLegacyWorkspace = (
  workspace: LegacyWorkspaceShape,
): RenderState => ({
  density: workspace.renderState?.density ?? workspace.draft.density ?? workspace.layoutPlan.density,
  selectedVariants: {
    ...(workspace.layoutPlan.selectedVariants ?? {}),
    ...(workspace.draft.selectedVariants ?? {}),
    ...(workspace.renderState?.selectedVariants ?? {}),
  },
  lockedExperienceIds: [
    ...(workspace.renderState?.lockedExperienceIds ?? workspace.draft.lockedExperienceIds),
  ],
  hiddenExperienceIds: [
    ...(workspace.renderState?.hiddenExperienceIds ??
      workspace.draft.hiddenExperienceIds ??
      workspace.layoutPlan.hiddenExperienceIds ??
      []),
  ],
  hiddenAwardIds: [
    ...(workspace.renderState?.hiddenAwardIds ??
      workspace.draft.hiddenAwardIds ??
      workspace.layoutPlan.hiddenAwardIds ??
      []),
  ],
  hiddenModuleIds: [
    ...filterPersistableHiddenModuleIds(
      workspace,
      workspace.renderState?.hiddenModuleIds ?? workspace.layoutPlan.hiddenModuleIds ?? [],
    ),
  ],
  overflowStatus: workspace.renderState?.overflowStatus ?? workspace.layoutPlan.overflowStatus,
  exportAllowed:
    workspace.renderState?.exportAllowed ?? workspace.layoutPlan.exportAllowed ?? true,
  blockingReasons: [
    ...(workspace.renderState?.blockingReasons ??
      workspace.layoutPlan.blockingReasons ??
      []),
  ],
});

export const hydrateWorkspaceData = (value: unknown): WorkspaceData | undefined => {
  if (looksLikeLegacyWorkspace(value)) {
    return createWorkspaceDataBridge({
      contentDocument: createContentDocumentFromLegacyWorkspace(value),
      templateSession: deriveTemplateSessionFromLegacyWorkspace(value),
      renderState: deriveRenderStateFromLegacyWorkspace(value),
      meta: value.meta,
    });
  }

  if (looksLikeSplitWorkspace(value)) {
    const contentDocument = normalizeContentDocument(value.contentDocument);

    return createWorkspaceDataBridge({
      contentDocument,
      templateSession: normalizeTemplateSession(value.templateSession),
      renderState: {
        ...deriveInitialRenderState(contentDocument),
        ...value.renderState,
        selectedVariants: { ...value.renderState.selectedVariants },
        lockedExperienceIds: [...(value.renderState.lockedExperienceIds ?? [])],
        hiddenExperienceIds: [...(value.renderState.hiddenExperienceIds ?? [])],
        hiddenAwardIds: [...(value.renderState.hiddenAwardIds ?? [])],
        hiddenModuleIds: [...(value.renderState.hiddenModuleIds ?? [])],
        blockingReasons: [...(value.renderState.blockingReasons ?? [])],
      },
      meta: value.meta,
    });
  }

  return undefined;
};

export const recomputeWorkspaceData = (workspace: WorkspaceData): WorkspaceData => {
  const contentDocument = createContentDocumentFromLegacyWorkspace(workspace);
  const templateSession = deriveTemplateSessionFromLegacyWorkspace(workspace);
  const renderState = deriveRenderStateFromLegacyWorkspace(workspace);
  const baseWorkspace = createWorkspaceDataBridge({
    contentDocument,
    templateSession,
    renderState,
    meta: workspace.meta,
  });
  const layoutPlan = balanceResumeDraft(baseWorkspace);
  const nextRenderState = syncRenderStateWithLayoutPlan(baseWorkspace, renderState, layoutPlan);

  return {
    ...baseWorkspace,
    draft: toResumeDraft(templateSession, nextRenderState),
    layoutPlan,
    renderState: nextRenderState,
  };
};

export const dehydrateWorkspaceData = (workspace: WorkspaceData): WorkspaceBridgeInput => {
  const contentDocument = createContentDocumentFromLegacyWorkspace(workspace);
  const templateSession = deriveTemplateSessionFromLegacyWorkspace(workspace);
  const liveRenderState: RenderState = {
    density: workspace.draft.density ?? workspace.layoutPlan.density ?? workspace.renderState?.density ?? "airy",
    selectedVariants: {
      ...(workspace.layoutPlan.selectedVariants ?? {}),
      ...(workspace.renderState?.selectedVariants ?? {}),
      ...(workspace.draft.selectedVariants ?? {}),
    },
    lockedExperienceIds: [
      ...(workspace.draft.lockedExperienceIds ?? workspace.renderState?.lockedExperienceIds ?? []),
    ],
    hiddenExperienceIds: [
      ...(workspace.draft.hiddenExperienceIds ??
        workspace.layoutPlan.hiddenExperienceIds ??
        workspace.renderState?.hiddenExperienceIds ??
        []),
    ],
    hiddenAwardIds: [
      ...(workspace.draft.hiddenAwardIds ??
        workspace.layoutPlan.hiddenAwardIds ??
        workspace.renderState?.hiddenAwardIds ??
        []),
    ],
    hiddenModuleIds: [
      ...filterPersistableHiddenModuleIds(
        workspace,
        (
          workspace.layoutPlan ??
          createInitialLayoutPlan(workspace.renderState!, templateSession)
        ).hiddenModuleIds,
      ),
    ],
    overflowStatus:
      workspace.layoutPlan.overflowStatus ?? workspace.renderState?.overflowStatus ?? "fits",
    exportAllowed:
      workspace.layoutPlan.exportAllowed ?? workspace.renderState?.exportAllowed ?? true,
    blockingReasons: [
      ...(workspace.layoutPlan.blockingReasons ??
        workspace.renderState?.blockingReasons ??
        []),
    ],
  };

  return {
    contentDocument,
    templateSession,
    renderState: liveRenderState,
    meta: workspace.meta,
  };
};
