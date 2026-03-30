export type TemplateFamilyId =
  | "warm-professional"
  | "calm-academic"
  | "modern-clean"
  | "highlight-forward";

export type TemplateManifestDisplayMetadata = {
  displayName: string;
  description: string;
  familyId: TemplateFamilyId;
  familyLabel: string;
  fitSummary: string;
  previewHighlights: ReadonlyArray<string>;
};

export type TemplateManifestOptionalDisplayMetadata = {
  displayName?: string;
  description?: string;
  familyId?: TemplateFamilyId;
  familyLabel?: string;
  fitSummary?: string;
  previewHighlights?: ReadonlyArray<string>;
};

export type HeroVariant =
  | "classic-banner"
  | "name-left-photo-right"
  | "centered-name-minimal"
  | "split-meta-band"
  | "stacked-profile-card";

export type EducationVariant =
  | "compact-rows"
  | "highlight-strip"
  | "school-emphasis"
  | "signal-grid";

export type ExperienceVariant =
  | "stacked-bullets"
  | "metric-first"
  | "compact-cards"
  | "role-first"
  | "result-callout";

export type AwardsVariant = "two-column-table" | "inline-list" | "pill-row";
export type SkillsVariant = "inline-tags" | "grouped-chips" | "label-columns";

export type TemplateManifestCore = {
  version: "v1";
  templateId: string;
  name: string;
  tone: "calm" | "confident" | "academic" | "modern";
  page: {
    size: "A4";
    marginPreset: "tight" | "balanced" | "airy";
    layout: "single-column";
  };
  theme: {
    fontPair: "serif-sans" | "humanist-sans" | "songti-sans";
    accentColor: "ink" | "navy" | "forest" | "burgundy";
    dividerStyle: "line" | "bar" | "soft";
  };
  sectionOrder: ReadonlyArray<"education" | "experience" | "awards" | "skills">;
  sections: {
    hero: {
      variant: HeroVariant;
    };
    education: {
      variant: EducationVariant;
    };
    experience: {
      variant: ExperienceVariant;
    };
    awards: {
      variant: AwardsVariant;
    };
    skills: {
      variant: SkillsVariant;
    };
  };
  compactionPolicy: {
    density: "airy" | "balanced" | "tight";
    overflowPriority: ReadonlyArray<"awards" | "skills" | "experience">;
  };
};

export type TemplateManifest = TemplateManifestCore & TemplateManifestOptionalDisplayMetadata;
export type CuratedTemplateManifest = TemplateManifestCore & TemplateManifestDisplayMetadata;
