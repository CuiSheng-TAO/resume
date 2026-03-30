import { NextResponse } from "next/server";
import { z } from "zod";

import { buildFallbackTemplateCandidates } from "@/lib/ai-fallback";
import { AI_PROMPTS } from "@/lib/ai-prompts";
import { buildRateLimitHeaders, checkAiRateLimit } from "@/lib/ai-rate-limit";
import { getAnthropicConfig, requestAnthropicJson } from "@/lib/anthropic";
import { finalizeTemplateManifestCandidates } from "@/lib/template-manifest";

const requestSchema = z.object({
  contentDocument: z
    .object({
      profile: z
        .object({
          targetRole: z.string().optional(),
        })
        .passthrough(),
    })
    .passthrough(),
  stylePreference: z.string().optional(),
});

const responseSchema = z.union([
  z.object({
    candidates: z.array(z.unknown()).optional().default([]),
  }),
  z.array(z.unknown()),
]);

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

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "参数不完整。" }, { status: 400 });
  }

  const fallbackCandidates = buildFallbackTemplateCandidates();
  const config = getAnthropicConfig();

  if (!config.enabled) {
    return NextResponse.json(
      {
        candidates: fallbackCandidates,
        mode: "fallback",
        meta: {
          provider: "local",
          promptVersion: AI_PROMPTS.templateGenerate.version,
        },
      },
      {
        headers: buildRateLimitHeaders(rateLimit),
      },
    );
  }

  try {
    const result = await requestAnthropicJson({
      maxTokens: 1500,
      system: AI_PROMPTS.templateGenerate.system,
      userContent: [
        parsed.data.stylePreference ? `风格偏好：${parsed.data.stylePreference}` : "",
        `目标岗位：${parsed.data.contentDocument.profile.targetRole ?? ""}`,
        "内容文档：",
        JSON.stringify(parsed.data.contentDocument),
        "请只输出 JSON。",
      ]
        .filter(Boolean)
        .join("\n"),
      schema: responseSchema,
    });
    const rawCandidates = Array.isArray(result.data) ? result.data : result.data.candidates;
    const candidates = finalizeTemplateManifestCandidates(rawCandidates);

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
        headers: buildRateLimitHeaders(rateLimit),
      },
    );
  } catch {
    return NextResponse.json(
      {
        candidates: fallbackCandidates,
        mode: "fallback",
        meta: {
          provider: "local",
          promptVersion: AI_PROMPTS.templateGenerate.version,
        },
      },
      {
        headers: buildRateLimitHeaders(rateLimit),
      },
    );
  }
}
