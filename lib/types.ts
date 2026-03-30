import type {
  RenderState,
  ResumeContentDocument,
  ResumeModuleKey,
  TemplateSession,
} from "@/lib/resume-document";

export type {
  RenderState,
  ResumeContentDocument,
  ResumeModuleKey,
  TemplateSession,
} from "@/lib/resume-document";

export type ExperienceVariantKey = "raw" | "star" | "standard" | "compact";
export type DensityMode = "airy" | "balanced" | "tight";
export type OverflowStatus = "fits" | "overflow" | "requires-trim";
export type ContentBalance = "sparse" | "balanced" | "dense";
export type PhotoQuality = "pending" | "invalid" | "ready";
export type EntryMode = "guided" | "paste";
export type ExperienceSection = "internship" | "campus";

export type PhotoCrop = {
  x: number;
  y: number;
  zoom: number;
};

export type PhotoAsset = {
  dataUrl: string;
  previewDataUrl?: string;
  processedDataUrl?: string;
  crop: PhotoCrop;
  aspect: number;
  width: number;
  height: number;
  sourceWidth?: number;
  sourceHeight?: number;
  quality: PhotoQuality;
  fileName: string;
  sizeBytes: number;
  processingStatus?: "idle" | "processing" | "ready" | "needs_retry";
  issues?: string[];
};

export type ProfileAsset = {
  fullName: string;
  targetRole: string;
  phone: string;
  email: string;
  location: string;
  summary: string;
  politicalStatus?: string;
  preferredLocation?: string;
  websiteUrl?: string;
  websiteLabel?: string;
  compactProfileNote?: string;
  photo?: PhotoAsset | null;
};

export type EducationHighlight = {
  label: string;
  value: string;
};

export type EducationAsset = {
  id: string;
  school: string;
  degree: string;
  dateRange: string;
  tag?: string;
  highlights?: EducationHighlight[];
};

export type ExperienceAsset = {
  id: string;
  section?: ExperienceSection;
  organization: string;
  organizationNote?: string;
  role: string;
  dateRange: string;
  priority: number;
  locked: boolean;
  rawNarrative: string;
  bullets?: string[];
  linkUrl?: string;
  metrics: string[];
  tags: string[];
  variants: Record<ExperienceVariantKey, string>;
};

export type AwardAsset = {
  id: string;
  title: string;
  priority: number;
};

export type IntakeTurn = {
  id: string;
  speaker: "assistant" | "user";
  content: string;
};

export type IntakeState = {
  mode: EntryMode;
  turns: IntakeTurn[];
};

export type ResumeDraft = {
  selectedVariants: Record<string, ExperienceVariantKey>;
  lockedExperienceIds: string[];
  hiddenExperienceIds: string[];
  hiddenAwardIds: string[];
  density: DensityMode;
  moduleOrder: ResumeModuleKey[];
};

export type LayoutPlan = {
  density: DensityMode;
  hiddenExperienceIds: string[];
  hiddenAwardIds: string[];
  hiddenModuleIds: ResumeModuleKey[];
  selectedVariants: Record<string, ExperienceVariantKey>;
  overflowStatus: OverflowStatus;
  exportAllowed?: boolean;
  blockingReasons?: string[];
  headerVariant?: "photo-present" | "photo-absent";
  templateMode?: string;
  steps: string[];
  estimatedLineCount: number;
  contentBalance: ContentBalance;
  showSummary: boolean;
};

export type ResumeMeasurement = {
  widthPx: number;
  heightPx: number;
  pageHeightPx: number;
  overflowPx: number;
  status: OverflowStatus;
};

export type WorkspaceMeta = {
  updatedAt: string;
  firstDraftAt?: string;
};

export type WorkspaceData = {
  profile: ProfileAsset;
  education: EducationAsset[];
  experiences: ExperienceAsset[];
  awards: AwardAsset[];
  skills: string[];
  intake: IntakeState;
  draft: ResumeDraft;
  layoutPlan: LayoutPlan;
  meta: WorkspaceMeta;
  contentDocument?: ResumeContentDocument;
  templateSession?: TemplateSession;
  renderState?: RenderState;
};

export type GuidedAnswers = {
  fullName: string;
  targetRole: string;
  phone: string;
  email: string;
  location: string;
  education: {
    school: string;
    degree: string;
    dateRange: string;
  };
  topExperience: {
    organization: string;
    role: string;
    dateRange: string;
    narrative: string;
  };
  skills: string[];
};
