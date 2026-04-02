"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontSize: "1.25rem", marginBottom: 12 }}>页面出了点问题</h2>
      <p style={{ color: "#666", marginBottom: 24 }}>
        当前页面遇到了意外错误。你的简历数据已自动保存在本地，刷新后可以恢复。
      </p>
      <button
        onClick={reset}
        style={{
          padding: "10px 24px",
          borderRadius: 8,
          border: "1px solid #ccc",
          background: "#fff",
          cursor: "pointer",
          fontSize: "0.95rem",
        }}
        type="button"
      >
        重新加载
      </button>
    </div>
  );
}
