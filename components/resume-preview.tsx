"use client";

import { useEffect, useRef } from "react";

import {
  createResumeRenderTree,
  SHARED_RESUME_CSS,
  resolveTemplateManifestForWorkspace,
} from "@/lib/template-renderer";
import { measureResumeSheetElementLayout } from "@/lib/layout-measure";
import type { ResumeMeasurement, WorkspaceData } from "@/lib/types";

type ResumePreviewProps = {
  workspace: WorkspaceData;
  onMeasurementChange?: (measurement: ResumeMeasurement) => void;
};

export function ResumePreview({ workspace, onMeasurementChange }: ResumePreviewProps) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const manifest = resolveTemplateManifestForWorkspace(workspace);

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

      onMeasurementChange(measureResumeSheetElementLayout(node));
    };

    report();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => report());
    observer.observe(node);

    return () => observer.disconnect();
  }, [
    manifest.templateId,
    workspace.education.length,
    workspace.experiences.length,
    workspace.awards.length,
    workspace.skills.length,
    workspace.profile.photo?.processedDataUrl,
    workspace.profile.photo?.previewDataUrl,
    workspace.profile.photo?.dataUrl,
    onMeasurementChange,
  ]);

  return (
    <>
      <style>{SHARED_RESUME_CSS}</style>
      {createResumeRenderTree({
        workspace,
        manifest,
        sheetRef,
      })}
    </>
  );
}
