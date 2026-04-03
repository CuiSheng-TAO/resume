"use client";

import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from "react";

type FileDropZoneProps = {
  pasteText: string;
  onPasteTextChange: (value: string) => void;
  onFileAccepted: (file: File) => void;
  acceptedFile: File | null;
  onFileClear: () => void;
  disabled?: boolean;
};

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
];

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt"];

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  return ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
}

export function FileDropZone({
  pasteText,
  onPasteTextChange,
  onFileAccepted,
  acceptedFile,
  onFileClear,
  disabled,
}: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showTextarea, setShowTextarea] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file && isAcceptedFile(file)) {
        onFileAccepted(file);
      }
    },
    [onFileAccepted],
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && isAcceptedFile(file)) {
        onFileAccepted(file);
      }
    },
    [onFileAccepted],
  );

  if (acceptedFile) {
    return (
      <div className="drop-zone">
        <div className="drop-zone-file-badge">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 1h5l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" />
            <path d="M9 1v4h4" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          <span>{acceptedFile.name}</span>
          <button
            className="drop-zone-file-remove"
            onClick={onFileClear}
            type="button"
            aria-label="移除文件"
          >
            &times;
          </button>
        </div>
      </div>
    );
  }

  if (showTextarea) {
    return (
      <div className="drop-zone">
        <textarea
          className="drop-zone-textarea"
          placeholder="把旧简历、自我介绍、项目经历贴进来..."
          value={pasteText}
          onChange={(e) => onPasteTextChange(e.target.value)}
          rows={6}
          disabled={disabled}
          autoFocus
        />
        <button
          className="btn-ghost"
          style={{ fontSize: "0.82rem", padding: "4px 0", marginTop: "4px" }}
          onClick={() => { setShowTextarea(false); onPasteTextChange(""); }}
          type="button"
        >
          切换回文件上传
        </button>
      </div>
    );
  }

  return (
    <div className={`drop-zone ${isDragOver ? "drop-zone--active" : ""}`}>
      <div
        className="drop-zone-area"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
      >
        <svg className="drop-zone-icon" viewBox="0 0 40 40" fill="none">
          <path d="M20 6v20M12 18l8-8 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 28v4a2 2 0 002 2h24a2 2 0 002-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="drop-zone-text">
          <span className="drop-zone-primary">拖入文件，或点击选择</span>
          <span className="drop-zone-hint">支持 PDF / Word / 纯文本</span>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt"
        onChange={handleFileInput}
        style={{ display: "none" }}
      />
      <p className="drop-zone-or">或者</p>
      <button
        className="btn btn-secondary"
        style={{ width: "100%" }}
        onClick={() => setShowTextarea(true)}
        type="button"
      >
        直接粘贴文本内容
      </button>
    </div>
  );
}
