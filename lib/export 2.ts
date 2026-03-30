import type { ExperienceVariantKey, WorkspaceData } from "@/lib/types";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const renderPhoto = (workspace: WorkspaceData) => {
  if (!workspace.profile.photo?.dataUrl) {
    return "";
  }

  return `
    <div class="photo-frame">
      <img src="${workspace.profile.photo.dataUrl}" alt="${escapeHtml(workspace.profile.fullName)} 证件照" />
    </div>
  `;
};

const getVisibleExperiences = (workspace: WorkspaceData) =>
  workspace.experiences.filter(
    (experience) => !workspace.layoutPlan.hiddenExperienceIds.includes(experience.id),
  );

const renderExperience = (workspace: WorkspaceData) =>
  getVisibleExperiences(workspace)
    .map((experience) => {
      const variant: ExperienceVariantKey =
        workspace.layoutPlan.selectedVariants[experience.id] ??
        workspace.draft.selectedVariants[experience.id] ??
        "standard";
      const content = experience.variants[variant] ?? experience.variants.standard;

      return `
        <article class="experience">
          <div class="experience-header">
            <div>
              <strong>${escapeHtml(experience.organization)}</strong>
              <span>${escapeHtml(experience.role)}</span>
            </div>
            <time>${escapeHtml(experience.dateRange)}</time>
          </div>
          <p>${escapeHtml(content)}</p>
        </article>
      `;
    })
    .join("");

const renderSummary = (workspace: WorkspaceData) => {
  if (!workspace.layoutPlan.showSummary) {
    return "";
  }

  return `
    <section>
      <h2>求职概述</h2>
      <p class="summary">${escapeHtml(workspace.profile.summary)}</p>
    </section>
  `;
};

export const exportResumeHtml = (workspace: WorkspaceData) => `
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(workspace.profile.fullName)} - 简历</title>
    <style>
      @page { size: A4 portrait; margin: 0; }
      :root {
        color-scheme: light;
        --ink: oklch(25% 0.03 255);
        --muted: oklch(54% 0.03 250);
        --accent: oklch(37% 0.08 247);
        --paper: oklch(98% 0.01 95);
        --line: oklch(86% 0.02 250);
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #d9d4c8; }
      body { font-family: "Noto Serif SC", "Songti SC", serif; color: var(--ink); }
      .page {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        background: var(--paper);
        padding: 11mm 12mm 12mm;
      }
      .header {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12mm;
        align-items: end;
        padding-bottom: 8mm;
        border-bottom: 1px solid var(--line);
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.22em;
        color: var(--muted);
        font-size: 9pt;
      }
      .name {
        margin: 5px 0 7px;
        font-size: 26pt;
        letter-spacing: 0.08em;
        color: var(--accent);
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 18px;
        font-size: 10.5pt;
      }
      .photo-frame {
        width: 26mm;
        height: 32mm;
        border-radius: 4mm;
        overflow: hidden;
        background: color-mix(in oklab, var(--accent) 10%, white);
      }
      .photo-frame img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      main {
        display: grid;
        gap: 8mm;
        margin-top: 8mm;
      }
      section h2 {
        margin: 0 0 4mm;
        font-size: 13pt;
        color: var(--accent);
        letter-spacing: 0.16em;
      }
      .education-item,
      .experience-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: baseline;
      }
      .education-item + .education-item,
      .experience + .experience {
        margin-top: 4mm;
      }
      .experience p,
      .summary,
      .skills,
      .awards {
        margin: 2mm 0 0;
        font-size: 10.5pt;
        line-height: 1.62;
        color: var(--ink);
      }
      .awards-list {
        margin: 0;
        padding-left: 18px;
      }
      @media print {
        html, body { background: transparent; }
        .page { margin: 0; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <header class="header">
        <div>
          <div class="eyebrow">${escapeHtml(workspace.profile.targetRole)}</div>
          <h1 class="name">${escapeHtml(workspace.profile.fullName)}</h1>
          <div class="meta">
            <span>${escapeHtml(workspace.profile.phone)}</span>
            <span>${escapeHtml(workspace.profile.email)}</span>
            <span>${escapeHtml(workspace.profile.location)}</span>
          </div>
        </div>
        ${renderPhoto(workspace)}
      </header>
      <main>
        ${renderSummary(workspace)}
        <section>
          <h2>教育背景</h2>
          ${workspace.education
            .map(
              (item) => `
                <div class="education-item">
                  <div><strong>${escapeHtml(item.school)}</strong> · ${escapeHtml(item.degree)}</div>
                  <time>${escapeHtml(item.dateRange)}</time>
                </div>
              `,
            )
            .join("")}
        </section>
        <section>
          <h2>经历亮点</h2>
          ${renderExperience(workspace)}
        </section>
        <section>
          <h2>技能</h2>
          <p class="skills">${escapeHtml(workspace.skills.join(" / "))}</p>
        </section>
        ${
          workspace.awards.length > 0
            ? `
            <section>
              <h2>补充信息</h2>
              <div class="awards">
                <ul class="awards-list">
                  ${workspace.awards
                    .filter((award) => !workspace.layoutPlan.hiddenAwardIds.includes(award.id))
                    .map((award) => `<li>${escapeHtml(award.title)}</li>`)
                    .join("")}
                </ul>
              </div>
            </section>
          `
            : ""
        }
      </main>
    </div>
  </body>
</html>
`;

export const exportResumeJson = (workspace: WorkspaceData) =>
  JSON.stringify(
    {
      profile: workspace.profile,
      education: workspace.education,
      experiences: workspace.experiences,
      awards: workspace.awards,
      skills: workspace.skills,
      intake: workspace.intake,
      draft: workspace.draft,
      layoutPlan: workspace.layoutPlan,
      meta: workspace.meta,
    },
    null,
    2,
  );

export const printToPdf = () => {
  if (typeof window !== "undefined") {
    window.print();
  }
};
