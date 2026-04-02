import { createElement, type ReactElement, type Ref } from "react";

import {
  buildEducationSummaryLine,
  buildFlagshipReferenceModel,
  escapeHtml,
  sanitizeHref,
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

const renderHomepageBadge = (websiteUrl?: string, websiteLabel?: string) =>
  websiteUrl && websiteLabel
    ? `<span class="resume-homepage-badge"><a href="${escapeHtml(sanitizeHref(websiteUrl))}">${escapeHtml(
        websiteLabel,
      )}</a></span>`
    : "";

const renderHeroContactItems = (
  items: Array<{ label: string; value: string; english?: boolean }>,
) =>
  items
    .map(
      (item) =>
        `<span>${escapeHtml(item.label)}：${
          item.english
            ? `<span class="resume-text-latin">${escapeHtml(item.value)}</span>`
            : escapeHtml(item.value)
        }</span>`,
    )
    .join("");

const renderHeroPhoto = (fullName: string, photoSrc?: string) =>
  photoSrc
    ? `<img src="${escapeHtml(photoSrc)}" alt="${escapeHtml(fullName)} 证件照" class="resume-photo">`
    : "";

const renderHero = (workspace: WorkspaceData, manifest: TemplateManifest) => {
  const model = buildFlagshipReferenceModel(workspace);
  const isCentered = manifest.sections.hero.variant === "centered-name-minimal";
  const homepageBadge = renderHomepageBadge(model.websiteUrl, model.websiteLabel);
  const contactItems = renderHeroContactItems(model.headerItems);
  const photo = renderHeroPhoto(model.fullName, model.photoSrc);

  if (manifest.sections.hero.variant === "split-meta-band") {
    return `
      <div class="${joinClasses(
        "resume-hero",
        "resume-hero--split-meta-band",
        model.headerVariant,
      )}">
        <div class="resume-hero-band">
          <div class="resume-contact resume-contact--band">${contactItems}</div>
        </div>
        <div class="resume-hero-main resume-hero-main--split-band">
          <div class="resume-hero-title-block">
            <div class="resume-name">
              ${escapeHtml(model.fullName)}
              ${homepageBadge}
            </div>
            ${
              model.compactProfileNote
                ? `<div class="resume-hero-note">${escapeHtml(model.compactProfileNote)}</div>`
                : ""
            }
          </div>
          ${photo}
        </div>
      </div>
    `;
  }

  if (manifest.sections.hero.variant === "stacked-profile-card") {
    return `
      <div class="${joinClasses(
        "resume-hero",
        "resume-hero--stacked-profile-card",
        model.headerVariant,
      )}">
        <div class="resume-profile-card">
          <div class="resume-profile-card-main">
            <div class="resume-name">
              ${escapeHtml(model.fullName)}
              ${homepageBadge}
            </div>
            ${
              model.compactProfileNote
                ? `<div class="resume-hero-note resume-hero-note--card">${escapeHtml(
                    model.compactProfileNote,
                  )}</div>`
                : ""
            }
            <div class="resume-contact resume-contact--stacked">${contactItems}</div>
          </div>
          ${photo ? `<div class="resume-profile-card-media">${photo}</div>` : ""}
        </div>
      </div>
    `;
  }

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
          ${homepageBadge}
        </div>
        <div class="resume-contact">${contactItems}</div>
      </div>
      ${photo}
    </div>
  `;
};

const renderEducationRows = (
  educationItems: Array<{
    id: string;
    school: string;
    degree: string;
    dateRange: string;
    tag?: string;
  }>,
) =>
  educationItems
    .map(
      (item) => `
        <div class="resume-education-row">
          <span>
            <span class="resume-text-date">${escapeHtml(item.dateRange)}</span>
            <b>${escapeHtml(item.school)}</b>
            ${item.tag ? `<span class="resume-education-tag">${escapeHtml(item.tag)}</span>` : ""}
          </span>
          <span class="resume-education-major">${escapeHtml(item.degree)}</span>
        </div>
      `,
    )
    .join("");

const renderEducation = (workspace: WorkspaceData, manifest: TemplateManifest) => {
  const model = buildFlagshipReferenceModel(workspace);
  const educationItems = model.education.filter(
    (item) => hasContent(item.school) || hasContent(item.degree) || hasContent(item.dateRange) || hasContent(item.tag),
  );
  const summaryLine = buildEducationSummaryLine(workspace.education);

  if (educationItems.length === 0 && !summaryLine) {
    return "";
  }

  let bodyHtml = `${renderEducationRows(educationItems)}${
    summaryLine ? `<div class="resume-education-summary">${summaryLine}</div>` : ""
  }`;

  if (manifest.sections.education.variant === "school-emphasis") {
    bodyHtml = `
      <div class="resume-education-school-list">
        ${educationItems
          .map(
            (item) => `
              <article class="resume-education-school-block">
                <div class="resume-education-school-line">
                  <b>${escapeHtml(item.school)}</b>
                  ${item.tag ? `<span class="resume-education-tag">${escapeHtml(item.tag)}</span>` : ""}
                </div>
                <div class="resume-education-detail-line">
                  <span class="resume-text-date">${escapeHtml(item.dateRange)}</span>
                  <span class="resume-education-degree-detail">${escapeHtml(item.degree)}</span>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
      ${summaryLine ? `<div class="resume-education-summary">${summaryLine}</div>` : ""}
    `;
  }

  if (manifest.sections.education.variant === "signal-grid") {
    const highlightCells = model.educationHighlights.filter(
      (item) => hasContent(item.label) && hasContent(item.value),
    );

    bodyHtml = `
      ${
        highlightCells.length > 0
          ? `<div class="resume-education-signal-grid">
              ${highlightCells
                .map(
                  (item) => `
                    <div class="resume-education-signal">
                      <span class="resume-education-signal-label">${escapeHtml(item.label)}</span>
                      <span class="resume-education-signal-value">${escapeHtml(item.value)}</span>
                    </div>
                  `,
                )
                .join("")}
            </div>`
          : ""
      }
      <div class="resume-education-school-list">
        ${renderEducationRows(educationItems)}
      </div>
    `;
  }

  return `
    <section class="${joinClasses(
      "resume-section",
      "resume-section--education",
      `resume-education--${manifest.sections.education.variant}`,
    )}">
      ${renderSectionHeading("教育背景")}
      <div class="resume-section-body">${bodyHtml}</div>
    </section>
  `;
};

const renderExperienceBullets = (bullets: string[], startIndex = 0) =>
  bullets
    .map(
      (bullet, index) => `
        <div class="resume-experience-item">
          <span class="num">(${startIndex + index + 1})</span> ${escapeHtml(bullet)}
        </div>
      `,
    )
    .join("");

const renderExperienceHeader = (experience: FlagshipExperienceEntry) => `
  <div class="resume-experience-header">
    <span>
      <b>${escapeHtml(experience.organization)}</b>
      ${
        experience.organizationNote
          ? `<span class="resume-organization-note">${escapeHtml(experience.organizationNote)}</span>`
          : ""
      }
      （<span class="resume-text-date">${escapeHtml(experience.dateRange)}</span>）
    </span>
    <span class="resume-role">${escapeHtml(experience.role)}</span>
  </div>
`;

const renderExperienceEntries = (
  entries: FlagshipExperienceEntry[],
  manifest: TemplateManifest,
) =>
  entries
    .map(
      (experience) => {
        if (manifest.sections.experience.variant === "role-first") {
          return `
            <div class="resume-experience-entry resume-experience-entry--role-first">
              <div class="resume-experience-role-first-header">
                <div class="resume-role resume-role--lead">${escapeHtml(experience.role)}</div>
                <div class="resume-experience-role-first-meta">
                  <b>${escapeHtml(experience.organization)}</b>
                  ${
                    experience.organizationNote
                      ? `<span class="resume-organization-note">${escapeHtml(
                          experience.organizationNote,
                        )}</span>`
                      : ""
                  }
                  <span class="resume-text-date">${escapeHtml(experience.dateRange)}</span>
                </div>
              </div>
              ${renderExperienceBullets(experience.bullets)}
            </div>
          `;
        }

        if (manifest.sections.experience.variant === "result-callout") {
          const [leadBullet, ...remainingBullets] = experience.bullets;

          return `
            <div class="resume-experience-entry resume-experience-entry--callout">
              ${
                leadBullet
                  ? `<div class="resume-experience-callout">
                      <span class="resume-experience-callout-label">亮点结果</span>
                      <span>${escapeHtml(leadBullet)}</span>
                    </div>`
                  : ""
              }
              ${renderExperienceHeader(experience)}
              ${renderExperienceBullets(remainingBullets, leadBullet ? 1 : 0)}
            </div>
          `;
        }

        return `
        <div class="${joinClasses(
          "resume-experience-entry",
          manifest.sections.experience.variant === "compact-cards" && "resume-experience-entry--card",
        )}">
          ${renderExperienceHeader(experience)}
          ${renderExperienceBullets(experience.bullets)}
        </div>
      `;
      },
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
  const showPillRow = manifest.sections.awards.variant === "pill-row";
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
        ${
          showPillRow
            ? `<div class="resume-awards-pill-row">${awards
                .map((award) => `<span class="resume-award-pill">${escapeHtml(award)}</span>`)
                .join("")}</div>`
            : `<table class="resume-awards-table">
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
              </table>`
        }
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
  const showLabelColumns = manifest.sections.skills.variant === "label-columns";
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
        ${
          showLabelColumns
            ? `<div class="resume-skills-columns">
                <div class="resume-skills-column">
                  <span class="resume-skills-column-label">核心技能</span>
                  <div class="resume-skills-column-value">${skills
                    .map((skill) => `<span class="resume-skill-chip">${escapeHtml(skill)}</span>`)
                    .join("")}</div>
                </div>
                ${
                  model.compactProfileNote
                    ? `<div class="resume-skills-column">
                        <span class="resume-skills-column-label">补充说明</span>
                        <div class="resume-skills-column-value resume-skills-column-value--note">${escapeHtml(
                          model.compactProfileNote,
                        )}</div>
                      </div>`
                    : ""
                }
              </div>`
            : `<div class="resume-skills-line">
                <b>核心技能：</b>${escapeHtml(skills.join("、"))}
              </div>
              ${
                model.compactProfileNote
                  ? `<div class="resume-skills-line"><b>补充说明：</b>${escapeHtml(
                      model.compactProfileNote,
                    )}</div>`
                  : ""
              }`
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
  @import url('https://fonts.loli.net/css2?family=LXGW+WenKai+TC:wght@400;700&display=swap');

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
  .resume-hero--split-meta-band {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
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
  .resume-hero-band {
    margin-bottom: 5px;
    padding: 4px 8px;
    background: color-mix(in srgb, var(--resume-accent-soft) 82%, white);
    border-radius: 6px;
  }
  .resume-contact--band {
    gap: 0.35em 1.1em;
    justify-content: space-between;
  }
  .resume-hero-main--split-band {
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }
  .resume-hero-title-block {
    flex: 1;
    min-width: 0;
  }
  .resume-profile-card {
    width: 100%;
    display: flex;
    align-items: stretch;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--resume-line) 68%, white);
    border-radius: 10px;
    background: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--resume-accent-soft) 55%, white),
      white 58%
    );
  }
  .resume-profile-card-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .resume-profile-card-media {
    display: flex;
    align-items: flex-start;
  }
  .resume-contact--stacked { gap: 0.3em 1em; }
  .resume-hero-note {
    font-size: 10pt;
    line-height: 1.45;
    color: var(--resume-muted);
  }
  .resume-hero-note--card {
    padding-top: 2px;
    border-top: 1px solid color-mix(in srgb, var(--resume-line) 58%, white);
  }
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
  .resume-education-school-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .resume-education-school-block {
    padding: 5px 0 4px;
    border-bottom: 0.5px solid color-mix(in srgb, var(--resume-line) 65%, white);
  }
  .resume-education-school-line {
    display: flex;
    align-items: baseline;
    gap: 5px;
    font-size: 12.5pt;
    line-height: 1.32;
  }
  .resume-education-detail-line {
    margin-top: 1px;
    font-size: 10.5pt;
    line-height: 1.4;
    color: var(--resume-muted);
  }
  .resume-education-degree-detail {
    margin-left: 2mm;
    color: var(--resume-text);
  }
  .resume-education-signal-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px 8px;
    margin-bottom: 5px;
  }
  .resume-education-signal {
    padding: 5px 7px;
    border-radius: 7px;
    background: color-mix(in srgb, var(--resume-accent-soft) 70%, white);
    border: 1px solid color-mix(in srgb, var(--resume-line) 60%, white);
  }
  .resume-education-signal-label {
    display: block;
    font-size: 8.8pt;
    color: var(--resume-muted);
    letter-spacing: 0.4pt;
  }
  .resume-education-signal-value {
    display: block;
    margin-top: 1px;
    font-size: 11.2pt;
    color: var(--resume-accent);
    font-family: var(--resume-latin-font);
    font-weight: 700;
  }
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
  .resume-experience-entry--role-first,
  .resume-experience-entry--callout {
    margin-bottom: 6px;
  }
  .resume-experience-role-first-header {
    margin-top: 7px;
    padding: 5px 0 4px;
    border-top: 0.5px solid var(--resume-line-strong);
  }
  .resume-section-body > :first-child .resume-experience-role-first-header {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }
  .resume-role--lead {
    display: block;
    font-size: 12.4pt;
    color: var(--resume-accent);
    margin-bottom: 1px;
  }
  .resume-experience-role-first-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.3em 0.6em;
    font-size: 10.5pt;
    line-height: 1.4;
  }
  .resume-experience-role-first-meta .resume-text-date {
    color: var(--resume-muted);
    margin-right: 0;
  }
  .resume-experience-callout {
    display: flex;
    gap: 6px;
    align-items: baseline;
    padding: 4px 8px;
    margin-bottom: 4px;
    border-left: 3px solid var(--resume-accent);
    background: color-mix(in srgb, var(--resume-accent-soft) 68%, white);
    border-radius: 0 8px 8px 0;
    font-size: 10.5pt;
    line-height: 1.42;
  }
  .resume-experience-callout-label {
    white-space: nowrap;
    color: var(--resume-accent);
    font-size: 9pt;
    font-weight: 700;
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
  .resume-awards-pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 6px;
  }
  .resume-award-pill {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--resume-line) 65%, white);
    background: color-mix(in srgb, var(--resume-accent-soft) 72%, white);
    font-size: 9.8pt;
    line-height: 1.35;
  }
  .resume-awards-inline { display: none; font-size: 10.5pt; line-height: 1.45; }
  .resume-awards--inline-list .resume-awards-table { display: none; }
  .resume-awards--inline-list .resume-awards-inline { display: block; }
  .resume-skills-line {
    font-size: 10.5pt;
    line-height: 1.45;
  }
  .resume-skills-columns {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .resume-skills-column {
    display: grid;
    grid-template-columns: 5.2em minmax(0, 1fr);
    gap: 8px;
    align-items: start;
  }
  .resume-skills-column-label {
    padding-top: 2px;
    color: var(--resume-accent);
    font-size: 9.5pt;
    font-weight: 700;
    letter-spacing: 0.4pt;
  }
  .resume-skills-column-value {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 6px;
    font-size: 10.5pt;
    line-height: 1.45;
  }
  .resume-skills-column-value--note {
    color: var(--resume-text);
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
