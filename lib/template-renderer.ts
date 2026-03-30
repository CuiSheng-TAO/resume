import { createElement, type ReactElement, type Ref } from "react";

import {
  buildEducationSummaryLine,
  buildFlagshipReferenceModel,
  escapeHtml,
  type FlagshipExperienceEntry,
} from "@/lib/flagship-template";
import {
  DEFAULT_TEMPLATE_ID,
  resolveTemplateManifestById,
  sectionKeySchema,
  type TemplateManifest,
} from "@/lib/template-manifest";
import type { WorkspaceData } from "@/lib/types";

type CreateResumeRenderTreeInput = {
  workspace: WorkspaceData;
  manifest?: TemplateManifest;
  sheetRef?: Ref<HTMLElement>;
};

const joinClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

const hasContent = (value: string | null | undefined) => Boolean(value?.trim());

const bodySectionKeys = sectionKeySchema.options;
const isProfileHidden = (workspace: WorkspaceData) =>
  (workspace.renderState?.hiddenModuleIds ?? []).includes("profile");

const resolveBodySectionOrder = (workspace: WorkspaceData, manifest: TemplateManifest) => {
  const allowedSections = manifest.sectionOrder.filter((section, index, list) => list.indexOf(section) === index);
  const moduleOrder = workspace.templateSession?.moduleOrder ?? [];
  const orderedFromSession = moduleOrder.filter(
    (moduleId): moduleId is (typeof bodySectionKeys)[number] =>
      moduleId !== "profile" &&
      bodySectionKeys.includes(moduleId) &&
      allowedSections.includes(moduleId),
  );
  const hiddenModuleIds = new Set(workspace.renderState?.hiddenModuleIds ?? []);
  const mergedOrder = [...orderedFromSession, ...allowedSections.filter((section) => !orderedFromSession.includes(section))];

  return mergedOrder.filter((section) => !hiddenModuleIds.has(section));
};

const renderSectionHeading = (title: string) => `
  <div class="resume-section-heading">
    <span class="resume-section-bar">${escapeHtml(title)}</span>
    <div class="resume-section-line"></div>
  </div>
`;

const renderHero = (workspace: WorkspaceData, manifest: TemplateManifest) => {
  const model = buildFlagshipReferenceModel(workspace);
  const isCentered = manifest.sections.hero.variant === "centered-name-minimal";
  const showHomepageBadge = model.websiteUrl && model.websiteLabel;

  return `
    <div class="${joinClasses(
      "resume-hero",
      `resume-hero--${manifest.sections.hero.variant}`,
      model.headerVariant,
      isCentered && "resume-hero--centered",
    )}">
      <div class="resume-hero-main">
        <div class="resume-name">
          ${escapeHtml(model.fullName)}
          ${
            showHomepageBadge
              ? `<span class="resume-homepage-badge"><a href="${escapeHtml(
                  model.websiteUrl!,
                )}">${escapeHtml(model.websiteLabel!)}</a></span>`
              : ""
          }
        </div>
        <div class="resume-contact">
          ${model.headerItems
            .map(
              (item) =>
                `<span>${escapeHtml(item.label)}：${
                  item.english
                    ? `<span class="resume-text-latin">${escapeHtml(item.value)}</span>`
                    : escapeHtml(item.value)
                }</span>`,
            )
            .join("")}
        </div>
      </div>
      ${
        model.photoSrc
          ? `<img src="${escapeHtml(model.photoSrc)}" alt="${escapeHtml(
              model.fullName,
            )} 证件照" class="resume-photo">`
          : ""
      }
    </div>
  `;
};

const renderEducation = (workspace: WorkspaceData, manifest: TemplateManifest) => {
  const model = buildFlagshipReferenceModel(workspace);
  const educationItems = model.education.filter(
    (item) => hasContent(item.school) || hasContent(item.degree) || hasContent(item.dateRange) || hasContent(item.tag),
  );
  const summaryLine = buildEducationSummaryLine(workspace.education);

  if (educationItems.length === 0 && !summaryLine) {
    return "";
  }

  return `
    <section class="${joinClasses(
      "resume-section",
      "resume-section--education",
      `resume-education--${manifest.sections.education.variant}`,
    )}">
      ${renderSectionHeading("教育背景")}
      <div class="resume-section-body">
        ${educationItems
          .map(
            (item) => `
              <div class="resume-education-row">
                <span>
                  <span class="resume-text-date">${escapeHtml(item.dateRange)}</span>
                  <b>${escapeHtml(item.school)}</b>
                  ${
                    item.tag
                      ? `<span class="resume-education-tag">${escapeHtml(item.tag)}</span>`
                      : ""
                  }
                </span>
                <span class="resume-education-major">${escapeHtml(item.degree)}</span>
              </div>
            `,
          )
          .join("")}
        ${
          summaryLine
            ? `<div class="resume-education-summary">${summaryLine}</div>`
            : ""
        }
      </div>
    </section>
  `;
};

const renderExperienceEntries = (
  entries: FlagshipExperienceEntry[],
  manifest: TemplateManifest,
) =>
  entries
    .map(
      (experience) => `
        <div class="${joinClasses(
          "resume-experience-entry",
          manifest.sections.experience.variant === "compact-cards" && "resume-experience-entry--card",
        )}">
          <div class="resume-experience-header">
            <span>
              <b>${escapeHtml(experience.organization)}</b>
              ${
                experience.organizationNote
                  ? `<span class="resume-organization-note">${escapeHtml(
                      experience.organizationNote,
                    )}</span>`
                  : ""
              }
              （<span class="resume-text-date">${escapeHtml(experience.dateRange)}</span>）
            </span>
            <span class="resume-role">${escapeHtml(experience.role)}</span>
          </div>
          ${experience.bullets
            .map(
              (bullet, index) => `
                <div class="resume-experience-item">
                  <span class="num">(${index + 1})</span> ${escapeHtml(bullet)}
                </div>
              `,
            )
            .join("")}
        </div>
      `,
    )
    .join("");

const renderExperience = (workspace: WorkspaceData, manifest: TemplateManifest) => {
  const model = buildFlagshipReferenceModel(workspace);
  const internshipExperiences = model.internshipExperiences.filter(
    (experience) =>
      hasContent(experience.organization) ||
      hasContent(experience.organizationNote) ||
      hasContent(experience.role) ||
      hasContent(experience.dateRange) ||
      experience.bullets.some((bullet) => hasContent(bullet)),
  );
  const campusExperiences = model.campusExperiences.filter(
    (experience) =>
      hasContent(experience.organization) ||
      hasContent(experience.organizationNote) ||
      hasContent(experience.role) ||
      hasContent(experience.dateRange) ||
      experience.bullets.some((bullet) => hasContent(bullet)),
  );

  if (internshipExperiences.length === 0 && campusExperiences.length === 0) {
    return "";
  }

  return `
    <section class="${joinClasses(
      "resume-section",
      "resume-section--experience",
      `resume-experience--${manifest.sections.experience.variant}`,
    )}">
      ${
        internshipExperiences.length > 0
          ? `
            ${renderSectionHeading("实习经历")}
            <div class="resume-section-body">
              ${renderExperienceEntries(internshipExperiences, manifest)}
            </div>
          `
          : ""
      }

      ${
        campusExperiences.length > 0
          ? `
            ${renderSectionHeading("在校经历")}
            <div class="resume-section-body">
              ${renderExperienceEntries(campusExperiences, manifest)}
            </div>
          `
          : ""
      }
    </section>
  `;
};

const renderAwards = (workspace: WorkspaceData, manifest: TemplateManifest) => {
  const model = buildFlagshipReferenceModel(workspace);
  const showInlineList = manifest.sections.awards.variant === "inline-list";
  const awards = model.awards.filter((award) => hasContent(award));
  const awardRows = model.awardRows.filter((row) => row.some((cell) => hasContent(cell)));

  if (awards.length === 0 && awardRows.length === 0) {
    return "";
  }

  return `
    <section class="${joinClasses(
      "resume-section",
      "resume-section--awards",
      `resume-awards--${manifest.sections.awards.variant}`,
    )}">
      ${renderSectionHeading("奖项荣誉")}
      <div class="resume-section-body">
        <table class="resume-awards-table">
          <tbody>
            ${awardRows
              .map(
                (row) => `
                  <tr>
                    <td>${row[0] ? escapeHtml(row[0]) : ""}</td>
                    <td>${row[1] ? escapeHtml(row[1]) : ""}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
        ${
          showInlineList
            ? `<div class="resume-awards-inline">${awards.map((award) => escapeHtml(award)).join(" / ")}</div>`
            : ""
        }
      </div>
    </section>
  `;
};

const renderSkills = (workspace: WorkspaceData, manifest: TemplateManifest) => {
  const model = buildFlagshipReferenceModel(workspace);
  const showGroupedChips = manifest.sections.skills.variant === "grouped-chips";
  const skills = model.skills.filter((skill) => hasContent(skill));

  if (skills.length === 0) {
    return "";
  }

  return `
    <section class="${joinClasses(
      "resume-section",
      "resume-section--skills",
      `resume-skills--${manifest.sections.skills.variant}`,
    )}">
      ${renderSectionHeading("专业技能")}
      <div class="resume-section-body">
        <div class="resume-skills-line">
          <b>核心技能：</b>${escapeHtml(skills.join("、"))}
        </div>
        ${
          model.compactProfileNote
            ? `<div class="resume-skills-line"><b>补充说明：</b>${escapeHtml(
                model.compactProfileNote,
              )}</div>`
            : ""
        }
        ${
          showGroupedChips
            ? `<div class="resume-skills-chips">${skills
                .map((skill) => `<span class="resume-skill-chip">${escapeHtml(skill)}</span>`)
                .join("")}</div>`
            : ""
        }
      </div>
    </section>
  `;
};

const renderSection = (workspace: WorkspaceData, manifest: TemplateManifest, section: string) => {
  switch (section) {
    case "education":
      return renderEducation(workspace, manifest);
    case "experience":
      return renderExperience(workspace, manifest);
    case "awards":
      return renderAwards(workspace, manifest);
    case "skills":
      return renderSkills(workspace, manifest);
    default:
      return "";
  }
};

const getSheetClassName = (manifest: TemplateManifest) =>
  joinClasses(
    "resume-sheet",
    `resume-theme--${manifest.theme.accentColor}`,
    `resume-font--${manifest.theme.fontPair}`,
    `resume-margin--${manifest.page.marginPreset}`,
    `resume-divider--${manifest.theme.dividerStyle}`,
    `resume-layout--${manifest.page.layout}`,
    `resume-template--${manifest.templateId}`,
    manifest.templateId === DEFAULT_TEMPLATE_ID && "flagship-page",
  );

const renderResumeInnerHtml = (workspace: WorkspaceData, manifest: TemplateManifest) => `
  ${isProfileHidden(workspace) ? "" : renderHero(workspace, manifest)}
  ${resolveBodySectionOrder(workspace, manifest)
    .map((section) => renderSection(workspace, manifest, section))
    .join("")}
`;

export const resolveTemplateManifestForWorkspace = (workspace: WorkspaceData) =>
  resolveTemplateManifestById(
    workspace.templateSession?.selectedTemplateId ??
      workspace.layoutPlan.templateMode ??
      DEFAULT_TEMPLATE_ID,
    workspace.templateSession?.candidateManifests,
  );

export const createResumeRenderTree = ({
  workspace,
  manifest = resolveTemplateManifestForWorkspace(workspace),
  sheetRef,
}: CreateResumeRenderTreeInput): ReactElement =>
  createElement("section", {
    className: getSheetClassName(manifest),
    ref: sheetRef,
  }, createElement("div", {
    className: "resume-sheet-content",
    "data-resume-sheet-content": "true",
    dangerouslySetInnerHTML: {
      __html: renderResumeInnerHtml(workspace, manifest),
    },
  }));

export const SHARED_RESUME_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@400;700&display=swap');

  .resume-sheet, .flagship-page {
    --resume-accent: #1e3a5f;
    --resume-accent-soft: #e8eef4;
    --resume-line: #c0c8d4;
    --resume-line-strong: #d8d8d8;
    --resume-text: #222;
    --resume-muted: #666;
    --resume-body-font: "Kaiti SC", "LXGW WenKai TC", "STKaiti", serif;
    --resume-latin-font: "Times New Roman", Times, serif;
    width: 210mm;
    min-height: 297mm;
    margin: 8px auto;
    background: #fff !important;
    color: #000;
    overflow: hidden;
    position: relative;
    font-family: var(--resume-body-font);
  }
  .resume-sheet-content {
    min-height: 0;
  }
  .resume-sheet, .resume-sheet *, .resume-sheet *::before, .resume-sheet *::after,
  .flagship-page, .flagship-page *, .flagship-page *::before, .flagship-page *::after {
    box-sizing: border-box;
  }
  .resume-sheet *, .flagship-page * {
    margin: 0;
    padding: 0;
  }
  .resume-theme--ink { --resume-accent: #25313f; --resume-accent-soft: #edf1f4; --resume-line: #c8d0d8; }
  .resume-theme--navy { --resume-accent: #1e3a5f; --resume-accent-soft: #e8eef4; --resume-line: #c0c8d4; }
  .resume-theme--forest { --resume-accent: #245b47; --resume-accent-soft: #e7f1ed; --resume-line: #bdd2c8; }
  .resume-theme--burgundy { --resume-accent: #6a2736; --resume-accent-soft: #f3e9ec; --resume-line: #d8c0c5; }
  .resume-font--serif-sans { --resume-body-font: "Iowan Old Style", "Palatino Linotype", "Songti SC", serif; }
  .resume-font--humanist-sans { --resume-body-font: "Avenir Next", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; }
  .resume-font--songti-sans { --resume-body-font: "Kaiti SC", "LXGW WenKai TC", "STKaiti", serif; }
  .resume-margin--tight { padding: 6mm 11mm 10mm 11mm; }
  .resume-margin--balanced { padding: 7mm 12mm 11mm 12mm; }
  .resume-margin--airy { padding: 9mm 13mm 12mm 13mm; }
  .resume-text-latin, .resume-text-strong, .resume-text-date, .resume-text-number, .num {
    font-family: var(--resume-latin-font);
  }
  .resume-text-strong, .resume-text-date, .resume-text-number, .num {
    font-weight: 700;
  }
  .resume-hero {
    padding-bottom: 4px;
    display: flex;
    align-items: flex-end;
    gap: 10px;
    margin-bottom: 6px;
    position: relative;
  }
  .resume-hero::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: linear-gradient(to right, var(--resume-accent) 40%, transparent 90%);
  }
  .resume-hero--centered {
    display: block;
    text-align: center;
  }
  .resume-hero-main { flex: 1; min-width: 0; }
  .resume-name {
    font-size: 24pt;
    color: var(--resume-accent);
    letter-spacing: 5pt;
    margin-bottom: 1px;
    line-height: 1.2;
  }
  .resume-contact {
    font-size: 10.5pt;
    color: var(--resume-text);
    line-height: 1.5;
    display: flex;
    flex-wrap: wrap;
    gap: 0.6em 1.2em;
  }
  .resume-hero--centered .resume-contact { justify-content: center; }
  .resume-homepage-badge {
    display: inline-block;
    background: linear-gradient(to right, var(--resume-accent), var(--resume-accent) 60%, color-mix(in srgb, var(--resume-accent) 75%, white));
    color: #fff;
    font-size: 10pt;
    padding: 2px 10px;
    border-radius: 3px;
    margin-left: 8px;
    letter-spacing: 0.5pt;
    vertical-align: middle;
    position: relative;
    top: -2px;
  }
  .resume-homepage-badge a { color: #fff; text-decoration: none; }
  .resume-photo {
    width: 20mm;
    height: 26mm;
    object-fit: cover;
    object-position: center top;
    flex-shrink: 0;
    border-radius: 3px;
  }
  .resume-section-heading {
    position: relative;
    height: 30px;
    margin-bottom: 5px;
    margin-top: 10px;
  }
  .resume-section-bar {
    display: inline-block;
    background: var(--resume-accent);
    color: #fff;
    font-size: 14pt;
    padding: 3px 14px 3px 16px;
    border-radius: 0 4px 4px 0;
    letter-spacing: 2pt;
    position: relative;
    z-index: 2;
  }
  .resume-divider--bar .resume-section-bar {
    border-radius: 999px;
    padding-left: 18px;
    padding-right: 18px;
  }
  .resume-section-line {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 1px;
    height: 2px;
    background: var(--resume-line);
    z-index: 1;
  }
  .resume-divider--soft .resume-section-line {
    opacity: 0.65;
    background: linear-gradient(to right, color-mix(in srgb, var(--resume-line) 80%, white), transparent);
  }
  .resume-section-body { padding: 1px 0 0 2px; }
  .resume-education-row {
    display: flex;
    align-items: baseline;
    font-size: 12pt;
    line-height: 1.38;
  }
  .resume-text-date { margin-right: 6mm; }
  .resume-education-row > span:first-child { flex: 1; }
  .resume-education-major {
    width: 8em;
    text-align: right;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .resume-education-tag {
    background: var(--resume-accent-soft);
    color: var(--resume-accent);
    font-size: 9pt;
    padding: 0 5px;
    border-radius: 2px;
    margin-left: 2px;
  }
  .resume-education-summary {
    font-size: 10.5pt;
    line-height: 1.38;
    margin-top: 1px;
  }
  .resume-education--compact-rows .resume-education-summary { margin-top: 4px; }
  .resume-divider { color: var(--resume-line); margin: 0 0.4em; }
  .resume-experience-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 12pt;
    line-height: 1.35;
    margin-top: 7px;
    padding-top: 5px;
    border-top: 0.5px solid var(--resume-line-strong);
  }
  .resume-section-body > :first-child .resume-experience-header,
  .resume-section-body > .resume-experience-header:first-child {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }
  .resume-experience--compact-cards .resume-experience-entry--card {
    padding: 4px 8px 6px;
    border: 1px solid color-mix(in srgb, var(--resume-line) 65%, white);
    border-radius: 8px;
    margin-bottom: 6px;
  }
  .resume-experience-header .resume-text-date { color: var(--resume-muted); }
  .resume-role { white-space: nowrap; }
  .resume-organization-note {
    font-size: 9pt;
    color: #444;
    margin-left: 2px;
  }
  .resume-experience-item {
    padding-left: 0.5em;
    font-size: 10.5pt;
    line-height: 1.45;
  }
  .resume-text-number, .num { color: var(--resume-accent); }
  .resume-awards-table {
    width: 100%;
    table-layout: fixed;
    font-size: 10.5pt;
    line-height: 1.45;
    border-collapse: collapse;
  }
  .resume-awards-table td {
    width: 50%;
    padding: 0;
    vertical-align: top;
  }
  .resume-awards-table td:last-child { text-align: right; }
  .resume-awards-inline { display: none; font-size: 10.5pt; line-height: 1.45; }
  .resume-awards--inline-list .resume-awards-table { display: none; }
  .resume-awards--inline-list .resume-awards-inline { display: block; }
  .resume-skills-line {
    font-size: 10.5pt;
    line-height: 1.45;
  }
  .resume-skills-chips { display: none; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
  .resume-skill-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--resume-accent-soft);
    color: var(--resume-accent);
    font-size: 9.5pt;
  }
  .resume-skills--grouped-chips .resume-skills-chips { display: flex; }
`;

export const EXPORT_DOCUMENT_CSS = `
  @page { size: A4 portrait; margin: 0; }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { color-scheme: light only !important; }
  body {
    background: #666 !important;
    color: #000;
  }
  @media print {
    body { background: none !important; }
    .resume-sheet, .flagship-page { margin: 0; box-shadow: none; border: 0; }
  }
`;

export const RESUME_DOCUMENT_CSS = `
  ${SHARED_RESUME_CSS}
  ${EXPORT_DOCUMENT_CSS}
`;
