import { NextResponse } from "next/server";
import { z } from "zod";

import { extractContentFallback } from "@/lib/ai-fallback";
import { AI_PROMPTS } from "@/lib/ai-prompts";
import { buildRateLimitHeaders, checkAiRateLimit } from "@/lib/ai-rate-limit";
import { getAnthropicConfig, requestAnthropicJson } from "@/lib/anthropic";
import { assessIntakeProgress } from "@/lib/intake-engine";

const requestSchema = z.object({
  entryMode: z.enum(["guided", "paste"]),
  text: z.string().min(1),
});

const contentDocumentSchema = z.object({
  profile: z.object({
    fullName: z.string(),
    targetRole: z.string(),
    phone: z.string(),
    email: z.string(),
    location: z.string(),
    summary: z.string(),
    preferredLocation: z.string().optional(),
    compactProfileNote: z.string().optional(),
    photo: z.null().optional(),
  }),
  education: z.array(
    z.object({
      id: z.string(),
      school: z.string(),
      degree: z.string(),
      dateRange: z.string(),
      tag: z.string().optional(),
      highlights: z
        .array(
          z.object({
            label: z.string(),
            value: z.string(),
          }),
        )
        .optional(),
    }),
  ),
  experiences: z.array(
    z.object({
      id: z.string(),
      section: z.enum(["internship", "campus"]).optional(),
      organization: z.string(),
      organizationNote: z.string().optional(),
      role: z.string(),
      dateRange: z.string(),
      priority: z.number(),
      locked: z.boolean(),
      rawNarrative: z.string(),
      bullets: z.array(z.string()).optional(),
      linkUrl: z.string().optional(),
      metrics: z.array(z.string()),
      tags: z.array(z.string()),
      variants: z.object({
        raw: z.string(),
        star: z.string(),
        standard: z.string(),
        compact: z.string(),
      }),
    }),
  ),
  awards: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      priority: z.number(),
    }),
  ),
  skills: z.array(z.string()),
  intake: z.object({
    mode: z.enum(["guided", "paste"]),
    turns: z.array(
      z.object({
        id: z.string(),
        speaker: z.enum(["assistant", "user"]),
        content: z.string(),
      }),
    ),
  }),
  meta: z.object({
    language: z.literal("zh-CN"),
    targetAudience: z.literal("campus-recruiting"),
    completeness: z.literal("baseline"),
    evidenceStrength: z.literal("mixed"),
  }),
});

const responseSchema = z.object({
  contentDocument: contentDocumentSchema,
});

export async function POST(request: Request) {
  const rateLimit = checkAiRateLimit(request, "extract-content");
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

  const fallbackDocument = extractContentFallback(parsed.data);
  const fallbackProgress = assessIntakeProgress(fallbackDocument, { hasDraft: false });
  const config = getAnthropicConfig();

  if (!config.enabled) {
    return NextResponse.json(
      {
        contentDocument: fallbackDocument,
        intake: fallbackProgress,
        mode: "fallback",
        meta: {
          provider: "local",
          promptVersion: AI_PROMPTS.extractContent.version,
        },
      },
      {
        headers: buildRateLimitHeaders(rateLimit),
      },
    );
  }

  try {
    const result = await requestAnthropicJson({
      maxTokens: 1200,
      system: AI_PROMPTS.extractContent.system,
      userContent: [`入口模式：${parsed.data.entryMode}`, "请只输出 JSON。", parsed.data.text].join("\n"),
      schema: responseSchema,
    });
    const progress = assessIntakeProgress(result.data.contentDocument, { hasDraft: false });

    return NextResponse.json(
      {
        contentDocument: result.data.contentDocument,
        intake: progress,
        mode: "anthropic",
        meta: {
          provider: "anthropic",
          promptVersion: AI_PROMPTS.extractContent.version,
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
        contentDocument: fallbackDocument,
        intake: fallbackProgress,
        mode: "fallback",
        meta: {
          provider: "local",
          promptVersion: AI_PROMPTS.extractContent.version,
        },
      },
      {
        headers: buildRateLimitHeaders(rateLimit),
      },
    );
  }
}
