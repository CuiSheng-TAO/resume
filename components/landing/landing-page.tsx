"use client";

import { useState, useCallback } from "react";
import { FileDropZone } from "./file-drop-zone";

type LandingPageProps = {
  onStartWithText: (text: string) => void;
  onStartWithFile: (file: File) => void;
  onStartBlank: () => void;
  isGenerating: boolean;
};

export function LandingPage({
  onStartWithText,
  onStartWithFile,
  onStartBlank,
  isGenerating,
}: LandingPageProps) {
  const [pasteText, setPasteText] = useState("");
  const [acceptedFile, setAcceptedFile] = useState<File | null>(null);

  const handleStart = useCallback(() => {
    if (acceptedFile) {
      onStartWithFile(acceptedFile);
    } else if (pasteText.trim()) {
      onStartWithText(pasteText.trim());
    }
  }, [acceptedFile, pasteText, onStartWithFile, onStartWithText]);

  const hasInput = Boolean(acceptedFile || pasteText.trim());

  return (
    <div className="landing-page">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-brand">
          <div className="landing-brand-mark">R</div>
          <span>ResumeForge</span>
        </div>
      </nav>

      {/* Hero */}
      <main className="landing-hero">
        <h1 className="landing-headline">
          你的经历值得<br />更好的表达。
        </h1>
        <p className="landing-subline">
          丢进来任何材料，60 秒出第一版简历，然后我们一起打磨到可投递。
        </p>

        <FileDropZone
          pasteText={pasteText}
          onPasteTextChange={setPasteText}
          onFileAccepted={setAcceptedFile}
          acceptedFile={acceptedFile}
          onFileClear={() => setAcceptedFile(null)}
          disabled={isGenerating}
        />

        <div className="landing-actions">
          <button
            className={`btn btn-amber ${isGenerating ? "btn-loading" : ""}`}
            disabled={!hasInput || isGenerating}
            onClick={handleStart}
            type="button"
          >
            {isGenerating ? "生成中..." : "开始制作"}
          </button>
          <button
            className="landing-blank-link"
            onClick={onStartBlank}
            disabled={isGenerating}
            type="button"
          >
            什么都没有？从空白开始
          </button>
        </div>
      </main>

      {/* Showcase */}
      <section className="landing-showcase">
        <div className="showcase-card">
          <span className="showcase-card-label">Before</span>
          <p className="showcase-before-text">
            {`我叫陈星野，华东师范大学人力资源管理专业，
大三在读。之前在星桥科技做过招聘运营实习，
主要负责筛简历和安排面试，
还参加过学校的创业比赛拿了二等奖。
技能的话会用 Excel 和 Python...`}
          </p>
        </div>
        <span className="showcase-arrow">→</span>
        <div className="showcase-card">
          <span className="showcase-card-label">After</span>
          <div className="showcase-after-preview">
            {/* Mini resume preview skeleton */}
            <div style={{
              padding: "16px 14px",
              fontFamily: "var(--font-serif)",
            }}>
              <div style={{
                height: 10, width: "45%", background: "#1a1a2e",
                borderRadius: 2, marginBottom: 6,
              }} />
              <div style={{
                height: 5, width: "70%", background: "#d4d4cc",
                borderRadius: 2, marginBottom: 12,
              }} />
              <div style={{
                height: 6, width: "30%", background: "#1a1a2e",
                borderRadius: 2, marginBottom: 6,
              }} />
              {[80, 95, 60].map((w, i) => (
                <div key={i} style={{
                  height: 4, width: `${w}%`, background: "#e8e8e0",
                  borderRadius: 2, marginBottom: 4,
                }} />
              ))}
              <div style={{ height: 6, width: "30%", background: "#1a1a2e", borderRadius: 2, marginBottom: 6, marginTop: 10 }} />
              {[90, 75, 85, 50].map((w, i) => (
                <div key={i} style={{
                  height: 4, width: `${w}%`, background: "#e8e8e0",
                  borderRadius: 2, marginBottom: 4,
                }} />
              ))}
              <div style={{ height: 6, width: "25%", background: "#1a1a2e", borderRadius: 2, marginBottom: 6, marginTop: 10 }} />
              <div style={{ display: "flex", gap: 6 }}>
                {[40, 35, 45].map((w, i) => (
                  <div key={i} style={{
                    height: 8, width: w, background: "rgba(212,168,83,0.15)",
                    borderRadius: 4,
                  }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <footer className="landing-proof">
        已帮助 2,400+ 位同学完成校招简历
      </footer>
    </div>
  );
}
