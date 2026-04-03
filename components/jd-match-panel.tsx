"use client";

import { useCallback, useState } from "react";

type JdMatchResult = {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  suggestions: string[];
};

type JdMatchPanelProps = {
  resumeText: string;
};

export function JdMatchPanel({ resumeText }: JdMatchPanelProps) {
  const [jdText, setJdText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<JdMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (!jdText.trim() || !resumeText.trim()) return;

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/ai/jd-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jdText: jdText.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "分析失败，请稍后再试。");
      }

      const data = await response.json();
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setIsAnalyzing(false);
    }
  }, [jdText, resumeText]);

  const scoreColor = result
    ? result.score >= 75
      ? "var(--green, #2d8a56)"
      : result.score >= 50
        ? "var(--amber, #d4a853)"
        : "var(--red, #c0392b)"
    : undefined;

  return (
    <section className="jd-match-panel">
      <div className="block-heading">
        <div>
          <p className="block-kicker">岗位匹配</p>
          <h3>对照 JD 检查匹配度</h3>
        </div>
      </div>

      {!result ? (
        <>
          <p className="block-copy">
            粘贴目标岗位的 JD，AI 会分析你的简历与岗位的匹配程度。
          </p>
          <textarea
            aria-label="粘贴岗位 JD"
            className="jd-match-textarea"
            disabled={isAnalyzing}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="粘贴岗位描述（Job Description）..."
            rows={6}
            value={jdText}
          />
          {error ? <p className="jd-match-error">{error}</p> : null}
          <div className="entry-actions">
            <button
              className="primary-button"
              disabled={isAnalyzing || !jdText.trim()}
              onClick={handleAnalyze}
              type="button"
            >
              {isAnalyzing ? "正在分析..." : "分析匹配度"}
            </button>
          </div>
        </>
      ) : (
        <div className="jd-match-result">
          <div className="jd-match-score" style={{ borderColor: scoreColor }}>
            <span className="jd-match-score-number" style={{ color: scoreColor }}>
              {result.score}
            </span>
            <span className="jd-match-score-label">匹配分</span>
          </div>

          {result.matchedKeywords.length > 0 ? (
            <div className="jd-match-section">
              <h4>已覆盖关键词</h4>
              <div className="jd-match-tags">
                {result.matchedKeywords.map((kw) => (
                  <span className="jd-match-tag jd-match-tag--matched" key={kw}>
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {result.missingKeywords.length > 0 ? (
            <div className="jd-match-section">
              <h4>缺失关键词</h4>
              <div className="jd-match-tags">
                {result.missingKeywords.map((kw) => (
                  <span className="jd-match-tag jd-match-tag--missing" key={kw}>
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {result.strengths.length > 0 ? (
            <div className="jd-match-section">
              <h4>优势</h4>
              <ul className="jd-match-list">
                {result.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.suggestions.length > 0 ? (
            <div className="jd-match-section">
              <h4>改进建议</h4>
              <ul className="jd-match-list">
                {result.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="entry-actions">
            <button
              className="secondary-button"
              onClick={() => {
                setResult(null);
                setJdText("");
              }}
              type="button"
            >
              重新分析
            </button>
          </div>
        </div>
      )}
    </section>
  );
}