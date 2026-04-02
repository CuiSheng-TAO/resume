"use client";

import { useEffect, useRef, useState } from "react";

import {
  createResumeRenderTree,
  SHARED_RESUME_CSS,
  resolveTemplateManifestForWorkspace,
} from "@/lib/template-renderer";
import { measureResumeSheetElementLayout } from "@/lib/layout-measure";
import type { ResumeMeasurement, WorkspaceData } from "@/lib/types";

const SHEET_INTRINSIC_WIDTH = 794;

type ResumePreviewProps = {
  workspace: WorkspaceData;
  onMeasurementChange?: (measurement: ResumeMeasurement) => void;
};

export function ResumePreview({ workspace, onMeasurementChange }: ResumePreviewProps) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const manifest = resolveTemplateManifestForWorkspace(workspace);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const update = () => {
      const available = wrap.clientWidth;
      setScale(available >= SHEET_INTRINSIC_WIDTH ? 1 : available / SHEET_INTRINSIC_WIDTH);
    };

    update();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

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

  const sheetHeight = sheetRef.current?.scrollHeight ?? 1123;

  return (
    <div ref={wrapRef} style={{ width: "100%", overflow: "hidden" }}>
      <div
        style={{
          transformOrigin: "top left",
          transform: scale < 1 ? `scale(${scale})` : undefined,
          height: scale < 1 ? sheetHeight * scale : undefined,
        }}
      >
        <style>{SHARED_RESUME_CSS}</style>
        {createResumeRenderTree({
          workspace,
          manifest,
          sheetRef,
        })}
      </div>
    </div>
  );
}
