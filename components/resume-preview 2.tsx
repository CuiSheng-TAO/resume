"use client";

import { useEffect, useRef } from "react";

import Image from "next/image";

import { measureResumeSheetLayout } from "@/lib/layout-measure";
import type { ExperienceVariantKey, ResumeMeasurement, WorkspaceData } from "@/lib/types";

type ResumePreviewProps = {
  workspace: WorkspaceData;
  onMeasurementChange?: (measurement: ResumeMeasurement) => void;
};

const getVariantText = (workspace: WorkspaceData, experienceId: string) => {
  const experience = workspace.experiences.find((item) => item.id === experienceId);
  if (!experience) {
    return "";
  }

  const variant: ExperienceVariantKey =
    workspace.layoutPlan.selectedVariants[experienceId] ??
    workspace.draft.selectedVariants[experienceId] ??
    "standard";

  return experience.variants[variant];
};

export function ResumePreview({ workspace, onMeasurementChange }: ResumePreviewProps) {
  const visibleExperiences = workspace.experiences.filter(
    (experience) => !workspace.layoutPlan.hiddenExperienceIds.includes(experience.id),
  );
  const visibleAwards = workspace.awards.filter(
    (award) => !workspace.layoutPlan.hiddenAwardIds.includes(award.id),
  );
  const sheetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!onMeasurementChange || !sheetRef.current) {
      return;
    }

    const node = sheetRef.current;
    const report = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      onMeasurementChange(
        measureResumeSheetLayout({
          widthPx: rect.width,
          heightPx: rect.height,
        }),
      );
    };

    report();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => report());
    observer.observe(node);

    return () => observer.disconnect();
  }, [
    onMeasurementChange,
    visibleAwards.length,
    visibleExperiences.length,
    workspace.layoutPlan.contentBalance,
    workspace.layoutPlan.estimatedLineCount,
    workspace.layoutPlan.overflowStatus,
    workspace.layoutPlan.showSummary,
  ]);

  return (
    <section
      className={`resume-sheet density-${workspace.layoutPlan.density}`}
      data-content-balance={workspace.layoutPlan.contentBalance}
      ref={sheetRef}
    >
      <header className="resume-header">
        <div>
          <p className="resume-role">{workspace.profile.targetRole}</p>
          <h2>{workspace.profile.fullName}</h2>
          <p className="resume-meta">
            <span>{workspace.profile.phone}</span>
            <span>{workspace.profile.email}</span>
            <span>{workspace.profile.location}</span>
          </p>
        </div>
        <div className="resume-photo-slot">
          {workspace.profile.photo?.dataUrl ? (
            <Image
              alt={`${workspace.profile.fullName} 证件照`}
              height={136}
              src={workspace.profile.photo.dataUrl}
              unoptimized
              width={108}
            />
          ) : (
            <div className="resume-photo-placeholder">待上传</div>
          )}
        </div>
      </header>

      {workspace.layoutPlan.showSummary ? (
        <div className="resume-section">
          <div className="resume-section-title">求职概述</div>
          <p className="resume-inline resume-summary-copy">{workspace.profile.summary}</p>
        </div>
      ) : null}

      <div className="resume-section">
        <div className="resume-section-title">教育背景</div>
        {workspace.education.map((item) => (
          <div className="resume-row" key={item.id}>
            <div>
              <strong>{item.school}</strong> · {item.degree}
            </div>
            <span>{item.dateRange}</span>
          </div>
        ))}
      </div>

      <div className="resume-section">
        <div className="resume-section-title">经历亮点</div>
        {visibleExperiences.map((experience) => (
          <article className="resume-experience" key={experience.id}>
            <div className="resume-row">
              <div>
                <strong>{experience.organization}</strong> · {experience.role}
              </div>
              <span>{experience.dateRange}</span>
            </div>
            <p>{getVariantText(workspace, experience.id)}</p>
          </article>
        ))}
      </div>

      <div className="resume-section">
        <div className="resume-section-title">技能</div>
        <p className="resume-inline">{workspace.skills.join(" / ")}</p>
      </div>

      {visibleAwards.length > 0 ? (
        <div className="resume-section">
          <div className="resume-section-title">补充信息</div>
          <ul className="resume-list">
            {visibleAwards.map((award) => (
              <li key={award.id}>{award.title}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
