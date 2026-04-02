import { NextResponse } from "next/server";
import { z } from "zod";

import { AI_PROMPTS } from "@/lib/ai-prompts";
import { buildRateLimitHeaders, checkAiRateLimit } from "@/lib/ai-rate-limit";
import { getAnthropicConfig, requestAnthropicJson } from "@/lib/anthropic";
import { TEMPLATE_CANDIDATE_COUNT, type TemplateManifest } from "@/lib/template-manifest";
import { shortlistTemplateLibrary } from "@/lib/template-matching";

const contentDocumentSchema = z.object({
  profile: z
    .object({
      targetRole: z.string().optional(),
      summary: z.string().optional(),
      compactProfileNote: z.string().optional(),
    })
    .passthrough()
    .default({}),
  education: z.array(z.object({}).passthrough()).default([]),
  experiences: z.array(z.object({}).passthrough()).default([]),
  awards: z.array(z.object({}).passthrough()).default([]),
  skills: z.array(z.string()).default([]),
}).passthrough();

const requestSchema = z.object({
  contentDocument: contentDocumentSchema,
  stylePreference: z.string().max(500).optional(),
});

const responseSchema = z
  .object({
    orderedTemplateIds: z.array(z.string()),
  })
  .strict();

const SHORTLIST_COUNT = 6;

const pickTemplateCandidates = (
  shortlist: readonly TemplateManifest[],
  orderedTemplateIds: readonly string[] = [],
  desiredCount = TEMPLATE_CANDIDATE_COUNT,
) => {
  const shortlistById = new Map(shortlist.map((template) => [template.templateId, template] as const));
  const seenTemplateIds = new Set<string>();
  const candidates: TemplateManifest[] = [];

  for (const templateId of orderedTemplateIds) {
    if (candidates.length >= desiredCount || seenTemplateIds.has(templateId)) {
      continue;
    }

    const template = shortlistById.get(templateId);
    if (!template) {
      continue;
    }

    candidates.push(template);
    seenTemplateIds.add(templateId);
  }

  for (const template of shortlist) {
    if (candidates.length >= desiredCount || seenTemplateIds.has(template.templateId)) {
      continue;
    }

    candidates.push(template);
    seenTemplateIds.add(template.templateId);
  }

  return candidates;
};

const createFallbackResponse = (
  candidates: readonly TemplateManifest[],
  rateLimitHeaders: ReturnType<typeof buildRateLimitHeaders>,
) =>
  NextResponse.json(
    {
      candidates,
      mode: "fallback",
      meta: {
        provider: "local",
        promptVersion: AI_PROMPTS.templateGenerate.version,
      },
    },
    {
      headers: rateLimitHeaders,
    },
  );

export async function POST(request: Request) {
  const rateLimit = checkAiRateLimit(request, "generate-templates");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        message: "当前请求较多，请稍后再试。",
        mode: "rate_limited",
      },
      {
        status: 429,
        headers: buildRateLimitHeaders(rateLimit),
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "请求格式错误。" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "参数不完整。" }, { status: 400 });
  }

  const shortlist = shortlistTemplateLibrary(parsed.data.contentDocument, SHORTLIST_COUNT);
  const fallbackCandidates = pickTemplateCandidates(shortlist);
  const config = getAnthropicConfig();
  const rateLimitHeaders = buildRateLimitHeaders(rateLimit);

  if (!config.enabled) {
    return createFallbackResponse(fallbackCandidates, rateLimitHeaders);
  }

  try {
    const result = await requestAnthropicJson({
      maxTokens: 1500,
      system: [
        AI_PROMPTS.templateGenerate.system,
        "你只能在给定 shortlist 内排序模板。",
        "输出 JSON，字段只能包含 orderedTemplateIds。",
        "不要输出任何 TemplateManifest，也不要返回 shortlist 外的 id。",
      ].join("\n"),
      userContent: [
        parsed.data.stylePreference ? `风格偏好：${parsed.data.stylePreference}` : "",
        `目标岗位：${parsed.data.contentDocument.profile.targetRole ?? ""}`,
        "内容文档：",
        JSON.stringify(parsed.data.contentDocument),
        "候选模板 shortlist：",
        JSON.stringify(
          shortlist.map((template) => ({
            templateId: template.templateId,
            displayName: template.displayName,
            familyLabel: template.familyLabel,
            fitSummary: template.fitSummary,
            previewHighlights: template.previewHighlights,
          })),
        ),
        "请只输出 JSON。",
      ]
        .filter(Boolean)
        .join("\n"),
      schema: responseSchema,
    });
    const parsedAiResponse = responseSchema.safeParse(result.data);
    if (!parsedAiResponse.success) {
      return createFallbackResponse(fallbackCandidates, rateLimitHeaders);
    }

    const candidates = pickTemplateCandidates(shortlist, parsedAiResponse.data.orderedTemplateIds);

    return NextResponse.json(
      {
        candidates,
        mode: "anthropic",
        meta: {
          provider: "anthropic",
          promptVersion: AI_PROMPTS.templateGenerate.version,
          attempts: result.attempts,
        },
      },
      {
        headers: rateLimitHeaders,
      },
    );
  } catch {
    return createFallbackResponse(fallbackCandidates, rateLimitHeaders);
  }
}
