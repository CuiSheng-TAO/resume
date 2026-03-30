import {
  createWorkspaceFromGuidedAnswers,
  createWorkspaceFromPasteText,
} from "@/lib/resume-document";
import type { GuidedAnswers, WorkspaceData } from "@/lib/types";

export const buildWorkspaceFromIntakeAnswers = (answers: GuidedAnswers): WorkspaceData =>
  createWorkspaceFromGuidedAnswers(answers);

export const buildWorkspaceFromPasteText = (text: string): WorkspaceData =>
  createWorkspaceFromPasteText(text);
