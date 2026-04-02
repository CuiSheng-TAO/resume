"use client";

type LandingPanelProps = {
  onEnterGuided: () => void;
  onEnterPaste: () => void;
};

export function LandingPanel({ onEnterGuided, onEnterPaste }: LandingPanelProps) {
  return (
    <section className="landing-panel">
      <div className="landing-copy">
        <p className="block-kicker">开始</p>
        <h2>先填基本信息，我们先整理出第一版简历。</h2>
        <p>
          这不是一个空白编辑器，而是一个会提问、会整理、会陪你慢慢补好的简历助手。
        </p>
      </div>
      <div className="entry-actions">
        <button className="primary-button" onClick={onEnterGuided} type="button">
          从零开始
        </button>
        <button className="secondary-button" onClick={onEnterPaste} type="button">
          导入旧材料
        </button>
      </div>
    </section>
  );
}
