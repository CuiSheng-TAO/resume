import type { ResumeContentDocument } from "@/lib/resume-document";

export type IntakeStage =
  | "import"
  | "core-follow-up"
  | "early-draft"
  | "strengthening-follow-up";

export type IntakeQuestionFocus =
  | "full-name"
  | "target-role"
  | "contact"
  | "education"
  | "experience-basics"
  | "experience-metrics"
  | "skills-specificity"
  | "education-signals";

export type IntakeProgress = {
  stage: IntakeStage;
  completenessScore: number;
  evidenceScore: number;
  minimumDraftReady: boolean;
  weakAreas: IntakeQuestionFocus[];
};

export type IntakeQuestionPlan = {
  stage: IntakeStage;
  focus: IntakeQuestionFocus;
  question: string;
  reason: string;
  suggestion: string;
};

type IntakeOptions = {
  hasDraft?: boolean;
};

const roundScore = (value: number) => Math.round(value * 100) / 100;

const hasValue = (value: string | null | undefined) => Boolean(value?.trim());

const looksGenericSkill = (skill: string) =>
  /(沟通|执行|学习|责任心|抗压|协作|细心|认真|办公软件)/.test(skill);

const hasContactInfo = (contentDocument: ResumeContentDocument) =>
  hasValue(contentDocument.profile.phone) &&
  hasValue(contentDocument.profile.email) &&
  hasValue(contentDocument.profile.location);

const hasEducationSkeleton = (contentDocument: ResumeContentDocument) =>
  contentDocument.education.some(
    (education) =>
      hasValue(education.school) &&
      hasValue(education.degree) &&
      hasValue(education.dateRange),
  );

const hasExperienceSkeleton = (contentDocument: ResumeContentDocument) =>
  contentDocument.experiences.some(
    (experience) =>
      hasValue(experience.organization) &&
      hasValue(experience.role) &&
      hasValue(experience.dateRange),
  );

const hasExperienceMetrics = (contentDocument: ResumeContentDocument) =>
  contentDocument.experiences.some((experience) => {
    if ((experience.metrics ?? []).length > 0) {
      return true;
    }

    const searchableText = [
      experience.rawNarrative,
      ...(experience.bullets ?? []),
      ...Object.values(experience.variants ?? {}),
    ].join(" ");

    return /\d/.test(searchableText);
  });

const hasSpecificSkills = (contentDocument: ResumeContentDocument) => {
  const normalizedSkills = contentDocument.skills
    .map((skill) => skill.trim())
    .filter(Boolean);

  if (normalizedSkills.length < 2) {
    return false;
  }

  return normalizedSkills.some((skill) => !looksGenericSkill(skill));
};

const hasEducationSignals = (contentDocument: ResumeContentDocument) =>
  contentDocument.education.some((education) => (education.highlights ?? []).length > 0) ||
  contentDocument.awards.length > 0;

const countMeaningfulTopLevelFields = (contentDocument: ResumeContentDocument) =>
  [
    contentDocument.profile.fullName,
    contentDocument.profile.targetRole,
    contentDocument.profile.phone,
    contentDocument.profile.email,
    contentDocument.profile.location,
    contentDocument.education[0]?.school,
    contentDocument.experiences[0]?.organization,
  ].filter(hasValue).length;

export const scoreCompleteness = (contentDocument: ResumeContentDocument) => {
  let score = 0;

  if (hasValue(contentDocument.profile.fullName)) {
    score += 0.15;
  }

  if (hasValue(contentDocument.profile.targetRole)) {
    score += 0.15;
  }

  if (hasContactInfo(contentDocument)) {
    score += 0.2;
  }

  if (hasEducationSkeleton(contentDocument)) {
    score += 0.25;
  }

  if (hasExperienceSkeleton(contentDocument)) {
    score += 0.25;
  }

  return roundScore(Math.min(score, 1));
};

export const scoreEvidence = (contentDocument: ResumeContentDocument) => {
  let score = 0;

  if (hasExperienceMetrics(contentDocument)) {
    score += 0.5;
  }

  if (hasSpecificSkills(contentDocument)) {
    score += 0.3;
  }

  if (hasEducationSignals(contentDocument)) {
    score += 0.2;
  }

  return roundScore(Math.min(score, 1));
};

export const listMissingCoreAreas = (
  contentDocument: ResumeContentDocument,
): IntakeQuestionFocus[] => {
  const missing: IntakeQuestionFocus[] = [];

  if (!hasValue(contentDocument.profile.fullName)) {
    missing.push("full-name");
  }

  if (!hasValue(contentDocument.profile.targetRole)) {
    missing.push("target-role");
  }

  if (!hasContactInfo(contentDocument)) {
    missing.push("contact");
  }

  if (!hasEducationSkeleton(contentDocument)) {
    missing.push("education");
  }

  if (!hasExperienceSkeleton(contentDocument)) {
    missing.push("experience-basics");
  }

  return missing;
};

export const listWeakAreas = (contentDocument: ResumeContentDocument): IntakeQuestionFocus[] => {
  const weakAreas: IntakeQuestionFocus[] = [];

  if (!hasExperienceMetrics(contentDocument)) {
    weakAreas.push("experience-metrics");
  }

  if (!hasSpecificSkills(contentDocument)) {
    weakAreas.push("skills-specificity");
  }

  if (!hasEducationSignals(contentDocument)) {
    weakAreas.push("education-signals");
  }

  return weakAreas;
};

export const assessIntakeProgress = (
  contentDocument: ResumeContentDocument,
  options: IntakeOptions = {},
): IntakeProgress => {
  const minimumDraftReady = listMissingCoreAreas(contentDocument).length === 0;
  const weakAreas = listWeakAreas(contentDocument);
  const hasDraft = options.hasDraft ?? false;
  const meaningfulFieldCount = countMeaningfulTopLevelFields(contentDocument);

  let stage: IntakeStage = "import";

  if (minimumDraftReady && hasDraft) {
    stage = "strengthening-follow-up";
  } else if (minimumDraftReady) {
    stage = "early-draft";
  } else if (meaningfulFieldCount > 0) {
    stage = "core-follow-up";
  }

  return {
    stage,
    completenessScore: scoreCompleteness(contentDocument),
    evidenceScore: scoreEvidence(contentDocument),
    minimumDraftReady,
    weakAreas,
  };
};

const QUESTION_BANK: Record<IntakeQuestionFocus, Omit<IntakeQuestionPlan, "stage" | "focus">> = {
  "full-name": {
    question: "我们先从你是谁开始。",
    reason: "先把简历署名定下来，后面的信息才能挂上去。",
    suggestion: "写下简历上要展示的姓名。",
  },
  "target-role": {
    question: "你最想投的岗位是什么？",
    reason: "先锁定目标岗位，后面的表达才能收束。",
    suggestion: "先写一个最想争取的方向。",
  },
  contact: {
    question: "把电话、邮箱、所在地一次告诉我。",
    reason: "补齐联系方式，起稿骨架会更完整。",
    suggestion: "推荐分 3 行填写，也可以用 / 分隔。",
  },
  education: {
    question: "学校、专业、时间怎么写？",
    reason: "教育背景是校招简历的基础骨架。",
    suggestion: "推荐写成“学校 / 专业 / 时间”。",
  },
  "experience-basics": {
    question: "最重要的一段经历，是在哪里做什么？",
    reason: "先把最强经历的组织、岗位、时间立起来。",
    suggestion: "推荐写成“组织 / 岗位 / 时间”。",
  },
  "experience-metrics": {
    question: "这段经历里能补一个数字结果吗？",
    reason: "骨架已经齐了，但经历缺数字会削弱说服力。",
    suggestion: "例如：推进多少候选人进入下一轮、入职或完成交付。",
  },
  "skills-specificity": {
    question: "再补 3 到 6 个更具体的技能关键词？",
    reason: "泛化词太多时，招聘方很难判断你到底会什么。",
    suggestion: "例如：招聘漏斗分析、候选人沟通、Excel、ATS、校园活动运营。",
  },
  "education-signals": {
    question: "教育背景里还有 GPA、排名、六级或奖项可以补吗？",
    reason: "校招简历里，教育信号越明确，筛选越容易通过。",
    suggestion: "没有就留空，有的话补 1 到 2 个最能加分的信号。",
  },
};

export const planNextIntakeQuestion = (
  contentDocument: ResumeContentDocument,
  options: IntakeOptions = {},
): IntakeQuestionPlan | null => {
  const progress = assessIntakeProgress(contentDocument, options);

  if (progress.stage === "import") {
    return {
      stage: "core-follow-up",
      focus: "full-name",
      ...QUESTION_BANK["full-name"],
    };
  }

  if (progress.stage === "core-follow-up") {
    const focus = listMissingCoreAreas(contentDocument)[0];
    if (!focus) {
      return null;
    }

    return {
      stage: "core-follow-up",
      focus,
      ...QUESTION_BANK[focus],
    };
  }

  if (progress.stage === "strengthening-follow-up") {
    const focus = progress.weakAreas[0];
    if (!focus) {
      return null;
    }

    return {
      stage: "strengthening-follow-up",
      focus,
      ...QUESTION_BANK[focus],
    };
  }

  return null;
};
