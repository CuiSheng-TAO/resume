import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import process from "node:process";

import { chromium } from "playwright";
import {
  RELEASE_SMOKE_STEP_IDS,
  STARTER_TEMPLATE_CARD_COUNT,
  extractResumeTemplateClass,
  isServerReadyStatus,
} from "./release-smoke-utils.mjs";

const SMOKE_PORT = Number(process.env.SMOKE_PORT ?? "3101");
const BASE_URL = `http://127.0.0.1:${SMOKE_PORT}`;
const BUILD_ID_PATH = ".next/BUILD_ID";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await check()) {
      return;
    }
    await sleep(100);
  }

  throw new Error(`Timed out waiting for ${label}`);
}

async function ensureBuildExists() {
  try {
    await access(BUILD_ID_PATH);
  } catch {
    throw new Error("Missing production build. Run `npm run build` first, or use `npm run verify:release`.");
  }
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL, { redirect: "manual" });
      if (isServerReadyStatus(response.status)) {
        return;
      }
    } catch {
      // server not ready yet
    }
    await sleep(200);
  }

  throw new Error(`Timed out waiting for local app on ${BASE_URL}`);
}

async function clickQuestionButton(page) {
  const button = page.getByRole("button", { name: /下一题|生成第一版简历/ }).first();
  await button.waitFor({ state: "visible", timeout: 30_000 });
  await button.click();
}

async function fillCurrentAnswer(page, value) {
  const field = page.locator("textarea, input[type='text'], input:not([type])").first();
  await field.waitFor({ state: "visible", timeout: 30_000 });
  await field.fill(value);
}

async function waitForCount(locator, expectedCount, label) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if ((await locator.count()) === expectedCount) {
      return;
    }
    await sleep(100);
  }

  throw new Error(`Timed out waiting for ${label}`);
}

async function runGuided(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "从零开始" }).click();

    const answers = [
      "向金涛",
      "招聘运营实习生",
      "18973111415\nxjt18973111415@foxmail.com\n武汉",
      "中国政法大学\n法律\n2022.06-2029.07",
      "星桥科技\n招聘运营实习生\n2025.10-2026.02",
    ];

    for (const answer of answers) {
      await fillCurrentAnswer(page, answer);
      await clickQuestionButton(page);
    }

    await page.getByRole("heading", { name: "第一版简历已经出来了" }).waitFor({
      state: "visible",
      timeout: 30_000,
    });

    const templateCards = page.locator(".template-card-grid > button");
    await waitForCount(templateCards, STARTER_TEMPLATE_CARD_COUNT, RELEASE_SMOKE_STEP_IDS[2]);
    const starterCardCount = await templateCards.count();

    const beforeClass = extractResumeTemplateClass(await page.locator(".resume-sheet").getAttribute("class"));
    const secondTemplateCard = templateCards.nth(1);
    await secondTemplateCard.click();
    await waitFor(
      async () => (await secondTemplateCard.getAttribute("aria-pressed")) === "true",
      20_000,
      "second template card to become selected",
    );
    await waitFor(
      async () => extractResumeTemplateClass(await page.locator(".resume-sheet").getAttribute("class")) !== beforeClass,
      20_000,
      "preview template class to change after manual switch",
    );
    const afterClass = extractResumeTemplateClass(await page.locator(".resume-sheet").getAttribute("class"));
    if (!beforeClass || !afterClass || beforeClass === afterClass) {
      throw new Error("Template switch did not visibly change the preview template class.");
    }

    await page.getByRole("button", { name: "继续完善这版" }).click();
    await page.getByRole("button", { name: "需要时再看版式" }).waitFor({
      state: "visible",
      timeout: 30_000,
    });
    if ((await page.getByRole("heading", { name: "看看哪套版式更适合这版简历" }).count()) !== 0) {
      throw new Error("Template area did not collapse after entering strengthening mode.");
    }

    return {
      starterCardCount,
      beforeClass,
      afterClass,
    };
  } finally {
    await page.close();
  }
}

async function runPaste(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
  let templateResponseCount = 0;

  page.on("response", (response) => {
    if (response.url().includes("/api/ai/generate-templates") && response.request().method() === "POST") {
      templateResponseCount += 1;
    }
  });

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "导入旧材料" }).click();
    await page.getByLabel("粘贴现有简历或自我介绍").fill(
      [
        "陈星野",
        "目标岗位：招聘运营实习生",
        "电话：13800001234",
        "邮箱：chenxingye@example.com",
        "所在地：杭州",
        "教育：华东师范大学 人力资源管理 2022.09-2026.06",
        "经历：星桥科技 招聘运营实习生 2025.10-2026.02 推进13位候选人进入终面，促成5人入职，并持续复盘招聘漏斗与约面流程。",
      ].join("\n"),
    );

    await page.getByRole("button", { name: /整理并起稿|整理出第一版|整理内容/ }).click();
    await page.getByRole("heading", { name: "第一版简历已经出来了" }).waitFor({
      state: "visible",
      timeout: 30_000,
    });

    const templateCards = page.locator(".template-card-grid > button");
    await waitForCount(templateCards, STARTER_TEMPLATE_CARD_COUNT, RELEASE_SMOKE_STEP_IDS[2]);
    const starterCardCount = await templateCards.count();

    const beforeRefreshCount = templateResponseCount;
    await page.getByRole("button", { name: "再加一段教育" }).click();
    const schoolInputs = page.getByLabel("学校");
    await schoolInputs.nth(1).waitFor({ state: "visible", timeout: 30_000 });
    await schoolInputs.nth(1).fill("复旦大学");

    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && templateResponseCount <= beforeRefreshCount) {
      await sleep(100);
    }
    if (templateResponseCount <= beforeRefreshCount) {
      throw new Error("Template candidates did not refresh after adding the second education entry.");
    }

    return {
      starterCardCount,
      templateResponseCount,
    };
  } finally {
    await page.close();
  }
}

async function main() {
  await ensureBuildExists();

  const server = spawn("npm", ["run", "start"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(SMOKE_PORT),
    },
    stdio: "inherit",
  });

  const stopServer = () => {
    if (!server.killed) {
      server.kill("SIGTERM");
    }
  };

  process.on("exit", stopServer);
  process.on("SIGINT", () => {
    stopServer();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    stopServer();
    process.exit(143);
  });

  try {
    await waitForServer();
    const browser = await chromium.launch({ headless: true });
    try {
      const guided = await runGuided(browser);
      const paste = await runPaste(browser);
      console.log(
        JSON.stringify(
          {
            checks: RELEASE_SMOKE_STEP_IDS,
            guided,
            paste,
          },
          null,
          2,
        ),
      );
    } finally {
      await browser.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Executable doesn't exist") || message.includes("browserType.launch")) {
      console.error(
        "Playwright browser is not installed. Run `npx playwright install chromium` once, then retry `npm run smoke:local`.",
      );
    } else {
      console.error(message);
    }
    process.exitCode = 1;
  } finally {
    stopServer();
  }
}

main();
