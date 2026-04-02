"use client";

import type { ResumeMeasurement, WorkspaceData } from "@/lib/types";
import { ResumePreview } from "./resume-preview";

type PreviewRailProps = {
  workspace: WorkspaceData | null;
  guidedPreviewWorkspace: WorkspaceData | null;
  stage: "landing" | "guided" | "paste" | "editor";
  isStarterPreview: boolean;
  starterExportBlocked: boolean;
  starterExportLockSignature: string | null;
  editorFlowMode: string;
  previewMeasurement: ResumeMeasurement | null;
  previewSummary: string;
  guidedPreviewSummary: string;
  onMeasurementChange: (measurement: ResumeMeasurement) => void;
  onExportHtml: () => void;
  onPrintPdf: () => void;
};

export function PreviewRail({
  workspace,
  guidedPreviewWorkspace,
  stage,
  isStarterPreview,
  starterExportBlocked,
  starterExportLockSignature,
  editorFlowMode,
  previewMeasurement,
  previewSummary,
  guidedPreviewSummary,
  onMeasurementChange,
  onExportHtml,
  onPrintPdf,
}: PreviewRailProps) {
  if (stage === "editor" && workspace) {
    return (
      <section className="preview-rail">
        <div className="preview-header">
          <div>
            <p className="block-kicker">预览</p>
            <h3>{isStarterPreview ? "第一版预览" : "简历预览"}</h3>
          </div>
        </div>
        <p className="preview-summary">{previewSummary}</p>
        <div className="preview-sheet-wrap">
          <ResumePreview onMeasurementChange={onMeasurementChange} workspace={workspace} />
        </div>
        <div className="preview-actions-card">
          <div className="preview-actions-header">
            <div>
              <p className="block-kicker">导出</p>
              <h4 className="preview-actions-title">导出与打印</h4>
            </div>
            {editorFlowMode !== "starter" && previewMeasurement && previewMeasurement.status !== "fits" ? (
              <span className="block-status warn">已超出一页</span>
            ) : null}
          </div>
          <p className="preview-actions-copy">
            {starterExportLockSignature
              ? editorFlowMode === "starter"
                ? "这还是第一版，建议先补 1 条关键信息后再导出。"
                : "这还是第一版，建议先补完当前这一条再导出。"
              : previewMeasurement && previewMeasurement.status !== "fits"
              ? "当前版本已超出一页，导出后会分页。"
              : "先确认右侧是一页，再导出 PDF。"}
          </p>
          <div className="preview-actions-grid">
            <button
              className="secondary-button preview-action-button"
              disabled={starterExportBlocked}
              onClick={onExportHtml}
              type="button"
            >
              导出网页版
            </button>
            <button
              className="primary-button preview-action-button"
              disabled={starterExportBlocked}
              onClick={onPrintPdf}
              type="button"
            >
              导出 PDF
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (stage === "guided" && guidedPreviewWorkspace) {
    return (
      <section className="preview-rail">
        <div className="preview-header">
          <div>
            <p className="block-kicker">预览</p>
            <h3>实时预览</h3>
          </div>
        </div>
        <p className="preview-summary">{guidedPreviewSummary}</p>
        <div className="preview-sheet-wrap">
          <ResumePreview
            onMeasurementChange={onMeasurementChange}
            workspace={guidedPreviewWorkspace}
          />
        </div>
      </section>
    );
  }

  return (
    <div className="preview-empty">
      <p className="block-kicker">预览</p>
      <h3>第一版预览会先出现在这里</h3>
      <p>
        先从左边开始。我们会先整理出第一版简历，再陪你继续完善。
      </p>
    </div>
  );
}
