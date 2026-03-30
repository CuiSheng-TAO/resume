import { renderToStaticMarkup } from "react-dom/server";

import { escapeHtml } from "@/lib/flagship-template";
import {
  createResumeRenderTree,
  RESUME_DOCUMENT_CSS,
  resolveTemplateManifestForWorkspace,
} from "@/lib/template-renderer";
import type { WorkspaceData } from "@/lib/types";

export const exportResumeHtml = (workspace: WorkspaceData) => {
  const manifest = resolveTemplateManifestForWorkspace(workspace);
  const body = renderToStaticMarkup(
    createResumeRenderTree({
      workspace,
      manifest,
    }),
  );

  return `
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="color-scheme" content="light only" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(workspace.profile.fullName)} - 简历</title>
    <style>${RESUME_DOCUMENT_CSS}</style>
  </head>
  <body>
    ${body}
  </body>
</html>
`;
};

export const exportResumeJson = (workspace: WorkspaceData) =>
  JSON.stringify(workspace, null, 2);

export const printToPdf = (workspace: WorkspaceData) => {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;

    if (!frameWindow) {
      iframe.remove();
      throw new Error("打印视图初始化失败，请稍后再试。");
    }

    frameWindow.focus();
    frameWindow.print();
    window.setTimeout(() => {
      iframe.remove();
    }, 1000);
  };

  iframe.srcdoc = exportResumeHtml(workspace);
  document.body.appendChild(iframe);
};
