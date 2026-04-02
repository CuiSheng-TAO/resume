"use client";

type PastePanelProps = {
  pasteText: string;
  isPasteGenerating: boolean;
  onPasteTextChange: (value: string) => void;
  onGenerate: () => void;
  onBack: () => void;
};

export function PastePanel({
  pasteText,
  isPasteGenerating,
  onPasteTextChange,
  onGenerate,
  onBack,
}: PastePanelProps) {
  return (
    <section className="studio-block">
      <div className="block-heading">
        <div>
          <p className="block-kicker">导入</p>
          <h3>导入旧材料，先整理第一版</h3>
        </div>
      </div>
      <label className="field">
        <span>粘贴现有简历或自我介绍</span>
        <textarea
          aria-label="粘贴现有简历或自我介绍"
          disabled={isPasteGenerating}
          onChange={(event) => onPasteTextChange(event.target.value)}
          placeholder="把旧简历、自我介绍或项目经历贴进来，我们先整理出第一版，再带你继续完善。"
          rows={11}
          value={pasteText}
        />
      </label>
      <div className="entry-actions">
        <button
          className="primary-button"
          disabled={!pasteText.trim() || isPasteGenerating}
          onClick={onGenerate}
          type="button"
        >
          {isPasteGenerating ? "整理中..." : "整理并起稿"}
        </button>
        <button
          className="text-button"
          disabled={isPasteGenerating}
          onClick={onBack}
          type="button"
        >
          返回
        </button>
      </div>
    </section>
  );
}
