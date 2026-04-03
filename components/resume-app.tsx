"use client";

import { useCallback, useState } from "react";
import { LandingPage } from "@/components/landing/landing-page";
import { ResumeStudio } from "@/components/resume-studio";

type AppStage = "landing" | "studio";
type EntryPayload =
  | { kind: "text"; text: string }
  | { kind: "file"; file: File }
  | { kind: "blank" };

export function ResumeApp() {
  const [appStage, setAppStage] = useState<AppStage>("landing");
  const [entryPayload, setEntryPayload] = useState<EntryPayload | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleStartWithText = useCallback(async (text: string) => {
    setEntryPayload({ kind: "text", text });
    setAppStage("studio");
  }, []);

  const handleStartWithFile = useCallback(async (file: File) => {
    setIsGenerating(true);
    try {
      const text = await extractTextFromFile(file);
      setEntryPayload({ kind: "text", text });
      setAppStage("studio");
    } catch {
      setEntryPayload({ kind: "blank" });
      setAppStage("studio");
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleStartBlank = useCallback(() => {
    setEntryPayload({ kind: "blank" });
    setAppStage("studio");
  }, []);

  if (appStage === "landing") {
    return (
      <LandingPage
        onStartWithText={handleStartWithText}
        onStartWithFile={handleStartWithFile}
        onStartBlank={handleStartBlank}
        isGenerating={isGenerating}
      />
    );
  }

  return (
    <ResumeStudio
      initialText={entryPayload?.kind === "text" ? entryPayload.text : undefined}
      onBackToLanding={() => { setAppStage("landing"); setEntryPayload(null); }}
    />
  );
}

async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || file.type === "text/plain") {
    return file.text();
  }

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const { extractTextFromPdf } = await import("@/lib/file-parsers");
    return extractTextFromPdf(file);
  }

  if (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const { extractTextFromDocx } = await import("@/lib/file-parsers");
    return extractTextFromDocx(file);
  }

  return file.text();
}
