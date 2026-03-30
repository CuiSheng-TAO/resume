import { NextResponse } from "next/server";
import { z } from "zod";

import { buildFallbackInterviewNext } from "@/lib/ai-fallback";
import { AI_PROMPTS } from "@/lib/ai-prompts";
import { buildRateLimitHeaders, checkAiRateLimit } from "@/lib/ai-rate-limit";
import { getAnthropicConfig, requestAnthropicJson } from "@/lib/anthropic";

const experienceVariantSchema = z.object({
  raw: z.string(),
  star: z.string(),
  standard: z.string(),
  compact: z.string(),
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
    photo: z.any().nullable().optional(),
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
      variants: experienceVariantSchema,
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

const requestSchema = z.object({
  contentDocument: contentDocumentSchema,
  hasDraft: z.boolean().optional().default(false),
});

const responseSchema = z.object({
  stage: z.enum(["import", "core-follow-up", "early-draft", "strengthening-follow-up"]),
  focus: z.enum([
    "full-name",
    "target-role",
    "contact",
    "education",
    "experience-basics",
    "experience-metrics",
    "skills-specificity",
    "education-signals",
  ]),
  question: z.string(),
  reason: z.string(),
  suggestion: z.string(),
});

export async function POST(request: Request) {
  const rateLimit = checkAiRateLimit(request, "interview-next");
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

  const fallback = buildFallbackInterviewNext(parsed.data);
  const config = getAnthropicConfig();

  if (!config.enabled) {
    if (!fallback) {
      return NextResponse.json(
        {
          nextQuestion: null,
          mode: "fallback",
          meta: {
            provider: "local",
            promptVersion: AI_PROMPTS.interviewNext.version,
          },
        },
        {
          headers: buildRateLimitHeaders(rateLimit),
        },
      );
    }

    return NextResponse.json(
      {
        ...fallback,
        mode: "fallback",
        meta: {
          provider: "local",
          promptVersion: AI_PROMPTS.interviewNext.version,
        },
      },
      {
        headers: buildRateLimitHeaders(rateLimit),
      },
    );
  }

  try {
    const result = await requestAnthropicJson({
      maxTokens: 400,
      maxRetries: 0,
      system: AI_PROMPTS.interviewNext.system,
      timeoutMs: 2500,
      userContent: [
        `是否已有草稿：${parsed.data.hasDraft ? "是" : "否"}`,
        "当前内容文档：",
        JSON.stringify(parsed.data.contentDocument),
        "请只输出 JSON。",
      ].join("\n"),
      schema: responseSchema,
    });

    return NextResponse.json(
      {
        ...result.data,
        mode: "anthropic",
        meta: {
          provider: "anthropic",
          promptVersion: AI_PROMPTS.interviewNext.version,
          attempts: result.attempts,
        },
      },
      {
        headers: buildRateLimitHeaders(rateLimit),
      },
    );
  } catch {
    if (!fallback) {
      return NextResponse.json(
        {
          nextQuestion: null,
          mode: "fallback",
          meta: {
            provider: "local",
            promptVersion: AI_PROMPTS.interviewNext.version,
          },
        },
        {
          headers: buildRateLimitHeaders(rateLimit),
        },
      );
    }

    return NextResponse.json(
      {
        ...fallback,
        mode: "fallback",
        meta: {
          provider: "local",
          promptVersion: AI_PROMPTS.interviewNext.version,
        },
      },
      {
        headers: buildRateLimitHeaders(rateLimit),
      },
    );
  }
}
