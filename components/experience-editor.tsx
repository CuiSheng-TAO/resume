"use client";

import type { ReactNode } from "react";

import type { ExperienceAsset, ExperienceSection } from "@/lib/types";

type ExperienceEditorCardProps = {
  experience: ExperienceAsset;
  index: number;
  sectionLabel: string;
  canRemove: boolean;
  isAiGenerating: boolean;
  bulletDraftValue: string;
  suggestionPanel: ReactNode;
  onFieldChange: (experienceId: string, field: "organization" | "organizationNote" | "role" | "dateRange" | "linkUrl", value: string) => void;
  onBulletsChange: (experienceId: string, value: string) => void;
  onBulletsBlur: (experienceId: string) => void;
  onAiRewrite: (experienceId: string) => void;
  onRemove: (experienceId: string) => void;
};

export function ExperienceEditorCard({
  experience,
  index,
  sectionLabel,
  canRemove,
  isAiGenerating,
  bulletDraftValue,
  suggestionPanel,
  onFieldChange,
  onBulletsChange,
  onBulletsBlur,
  onAiRewrite,
  onRemove,
}: ExperienceEditorCardProps) {
  return (
    <article className="editor-card">
      <div className="editor-card-header">
        <strong>{sectionLabel} {index + 1}</strong>
        <div className="editor-card-actions">
          <button
            className={isAiGenerating ? "text-button is-loading" : "text-button"}
            disabled={isAiGenerating}
            onClick={() => onAiRewrite(experience.id)}
            type="button"
          >
            {isAiGenerating ? "润色中..." : "帮我润色"}
          </button>
          {canRemove ? (
            <button
              className="text-button"
              onClick={() => onRemove(experience.id)}
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
            onChange={(event) => onFieldChange(experience.id, "organization", event.target.value)}
            value={experience.organization}
          />
        </label>
        <label className="field">
          <span>岗位/身份</span>
          <input
            onChange={(event) => onFieldChange(experience.id, "role", event.target.value)}
            value={experience.role}
          />
        </label>
        <label className="field">
          <span>时间</span>
          <input
            onChange={(event) => onFieldChange(experience.id, "dateRange", event.target.value)}
            value={experience.dateRange}
          />
        </label>
        <label className="field">
          <span>补充说明（可选）</span>
          <input
            onChange={(event) => onFieldChange(experience.id, "organizationNote", event.target.value)}
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
          onBlur={() => onBulletsBlur(experience.id)}
          onChange={(event) => onBulletsChange(experience.id, event.target.value)}
          placeholder={
            sectionLabel === "实习"
              ? "例如：推进 8 个岗位招聘流程\n协调候选人与面试官排期并跟进结果"
              : "例如：组织学院活动并协调分工\n复盘报名与到场数据，形成优化建议"
          }
          rows={4}
          value={bulletDraftValue}
        />
      </label>
      {suggestionPanel}
    </article>
  );
}

type ExperienceSectionEditorProps = {
  sectionRef?: React.RefObject<HTMLElement | null>;
  kicker: string;
  title: string;
  experiences: ExperienceAsset[];
  sectionLabel: string;
  sectionType: ExperienceSection;
  experienceSuggestions: Record<string, { status: string }>;
  onAdd: (section: ExperienceSection) => void;
  onFieldChange: (experienceId: string, field: "organization" | "organizationNote" | "role" | "dateRange" | "linkUrl", value: string) => void;
  onBulletsChange: (experienceId: string, value: string) => void;
  onBulletsBlur: (experienceId: string) => void;
  onAiRewrite: (experienceId: string) => void;
  onRemove: (experienceId: string) => void;
  getBulletDraftValue: (experience: ExperienceAsset) => string;
  renderSuggestion: (experience: ExperienceAsset) => ReactNode;
};

export function ExperienceSectionEditor({
  sectionRef,
  kicker,
  title,
  experiences,
  sectionLabel,
  sectionType,
  experienceSuggestions,
  onAdd,
  onFieldChange,
  onBulletsChange,
  onBulletsBlur,
  onAiRewrite,
  onRemove,
  getBulletDraftValue,
  renderSuggestion,
}: ExperienceSectionEditorProps) {
  return (
    <section className="studio-block" ref={sectionRef}>
      <div className="block-heading">
        <div>
          <p className="block-kicker">{kicker}</p>
          <h3>{title}</h3>
        </div>
        <button
          className="secondary-button"
          onClick={() => onAdd(sectionType)}
          type="button"
        >
          新增{sectionLabel}
        </button>
      </div>
      <p className="block-copy">
        当前共有 {experiences.length} 段{sectionLabel}，后面继续补也不会覆盖前面内容。
      </p>
      <div className="stacked-editor">
        {experiences.map((experience, index) => (
          <ExperienceEditorCard
            key={experience.id}
            bulletDraftValue={getBulletDraftValue(experience)}
            canRemove={experiences.length > 1}
            experience={experience}
            index={index}
            isAiGenerating={experienceSuggestions[experience.id]?.status === "generating"}
            onAiRewrite={onAiRewrite}
            onBulletsBlur={onBulletsBlur}
            onBulletsChange={onBulletsChange}
            onFieldChange={onFieldChange}
            onRemove={onRemove}
            sectionLabel={sectionLabel}
            suggestionPanel={renderSuggestion(experience)}
          />
        ))}
      </div>
    </section>
  );
}
