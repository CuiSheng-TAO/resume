"use client";

import type { ReactNode } from "react";

import type { ResumeContentDocument } from "@/lib/resume-document";

type GuidedPanelProps = {
  stepIndex: number;
  totalSteps: number;
  questionPrompt: string;
  questionNote: string;
  questionPlaceholder: string;
  questionMultiline?: boolean;
  draftAnswer: string;
  refinementHint: string | null;
  actionWillCreateDraft: boolean;
  activeEntryMode: "guided" | "paste";
  sourceContentDocument: ResumeContentDocument | null;
  helperBlock: ReactNode;
  onDraftAnswerChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
};

export function GuidedPanel({
  stepIndex,
  totalSteps,
  questionPrompt,
  questionNote,
  questionPlaceholder,
  questionMultiline,
  draftAnswer,
  refinementHint,
  actionWillCreateDraft,
  activeEntryMode,
  sourceContentDocument,
  helperBlock,
  onDraftAnswerChange,
  onNext,
  onBack,
}: GuidedPanelProps) {
  return (
    <section className="studio-block">
      <div className="block-heading">
        <div>
          <p className="block-kicker">引导</p>
          <h3>回答当前最关键的问题</h3>
        </div>
        <span className="block-status">
          {stepIndex + 1} / {totalSteps}
        </span>
      </div>
      <div className="guided-progress-bar" role="progressbar" aria-valuenow={stepIndex + 1} aria-valuemin={1} aria-valuemax={totalSteps}>
        <div className="guided-progress-fill" style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }} />
      </div>
      <p className="guided-prompt">{questionPrompt}</p>
      <p className="block-copy">{questionNote}</p>
      {activeEntryMode === "paste" && sourceContentDocument ? (
        <p className="inline-note">刚刚导入的内容已经保留，现在只补还缺的关键信息。</p>
      ) : null}
      <div className="guided-grid">
        <label className="field">
          <span>当前回答</span>
          {questionMultiline ? (
            <>
              <textarea
                aria-label="当前回答"
                onChange={(event) => onDraftAnswerChange(event.target.value)}
                placeholder={questionPlaceholder}
                rows={6}
                value={draftAnswer}
              />
              {helperBlock}
            </>
          ) : (
            <>
              <input
                aria-label="当前回答"
                onChange={(event) => onDraftAnswerChange(event.target.value)}
                placeholder={questionPlaceholder}
                value={draftAnswer}
              />
              {helperBlock}
            </>
          )}
        </label>
      </div>
      {refinementHint ? <p className="inline-note">{refinementHint}</p> : null}
      <div className="entry-actions">
        <button
          className="primary-button"
          disabled={!draftAnswer.trim()}
          onClick={onNext}
          type="button"
        >
          {actionWillCreateDraft ? "生成第一版简历" : "下一题"}
        </button>
        <button className="text-button" onClick={onBack} type="button">
          {stepIndex === 0 ? "返回" : "上一题"}
        </button>
      </div>
    </section>
  );
}
