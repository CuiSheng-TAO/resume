import { NextResponse } from "next/server";
import { z } from "zod";

import { buildFallbackIntakeTurn } from "@/lib/ai-fallback";
import { AI_PROMPTS } from "@/lib/ai-prompts";
import { buildRateLimitHeaders, checkAiRateLimit } from "@/lib/ai-rate-limit";
import { getAnthropicConfig, requestAnthropicJson } from "@/lib/anthropic";

const requestSchema = z.object({
  questionIndex: z.number().min(0),
  latestAnswer: z.string().max(2000).optional(),
});

const responseSchema = z.object({
  nextQuestion: z.string(),
  suggestion: z.string(),
});

export async function POST(request: Request) {
  const rateLimit = checkAiRateLimit(request, "intake-turn");
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

  // Compatibility wrapper for the legacy fixed-question client.
  const fallback = buildFallbackIntakeTurn(parsed.data.questionIndex, parsed.data.latestAnswer);
  const config = getAnthropicConfig();
  if (!config.enabled) {
    return NextResponse.json(
      {
        ...fallback,
        mode: "fallback",
        meta: {
          provider: "local",
          promptVersion: AI_PROMPTS.intakeTurn.version,
        },
      },
      {
        headers: buildRateLimitHeaders(rateLimit),
      },
    );
  }

  try {
    const result = await requestAnthropicJson({
      maxTokens: 250,
      system: AI_PROMPTS.intakeTurn.system,
      userContent: `当前问题序号：${parsed.data.questionIndex}\n最新回答：${parsed.data.latestAnswer ?? "无"}`,
      schema: responseSchema,
    });

    return NextResponse.json(
      {
        ...result.data,
        mode: "anthropic",
        meta: {
          provider: "anthropic",
          promptVersion: AI_PROMPTS.intakeTurn.version,
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
        ...fallback,
        mode: "fallback",
        meta: {
          provider: "local",
          promptVersion: AI_PROMPTS.intakeTurn.version,
        },
      },
      {
        headers: buildRateLimitHeaders(rateLimit),
      },
    );
  }
}
