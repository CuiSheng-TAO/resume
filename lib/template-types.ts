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
      variant: "classic-banner" | "name-left-photo-right" | "centered-name-minimal";
    };
    education: {
      variant: "compact-rows" | "highlight-strip";
    };
    experience: {
      variant: "stacked-bullets" | "metric-first" | "compact-cards";
    };
    awards: {
      variant: "two-column-table" | "inline-list";
    };
    skills: {
      variant: "inline-tags" | "grouped-chips";
    };
  };
  compactionPolicy: {
    density: "airy" | "balanced" | "tight";
    overflowPriority: ReadonlyArray<"awards" | "skills" | "experience">;
  };
};

export type TemplateManifest = TemplateManifestCore & TemplateManifestOptionalDisplayMetadata;
export type CuratedTemplateManifest = TemplateManifestCore & TemplateManifestDisplayMetadata;
