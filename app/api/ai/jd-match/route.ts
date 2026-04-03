import { NextResponse } from "next/server";
import { z } from "zod";

import { AI_PROMPTS } from "@/lib/ai-prompts";
import { buildRateLimitHeaders, checkAiRateLimit } from "@/lib/ai-rate-limit";
import { getAnthropicConfig, requestAnthropicJson } from "@/lib/anthropic";

const requestSchema = z.object({
  resumeText: z.string().min(1).max(8000),
  jdText: z.string().min(1).max(4000),
});

const responseSchema = z.object({
  score: z.number().int().min(0).max(100),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  strengths: z.array(z.string()),
  suggestions: z.array(z.string()),
});

function buildFallbackResult() {
  return {
    score: 0,
    matchedKeywords: [],
    missingKeywords: [],
    strengths: [],
    suggestions: ["AI 分析暂不可用，请稍后再试。"],
  };
}

export async function POST(request: Request) {
  const rateLimit = checkAiRateLimit(request, "jd-match");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "当前请求较多，请稍后再试。", mode: "rate_limited" },
      { status: 429, headers: buildRateLimitHeaders(rateLimit) },
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

  const config = getAnthropicConfig();

  if (!config.enabled) {
    return NextResponse.json(
      {
        result: buildFallbackResult(),
        mode: "fallback",
        meta: { provider: "local", promptVersion: AI_PROMPTS.jdMatch.version },
      },
      { headers: buildRateLimitHeaders(rateLimit) },
    );
  }

  try {
    const result = await requestAnthropicJson({
      maxTokens: 800,
      maxRetries: 0,
      system: AI_PROMPTS.jdMatch.system,
      timeoutMs: 5000,
      userContent: [
        "## 简历内容",
        parsed.data.resumeText,
        "",
        "## 岗位 JD",
        parsed.data.jdText,
        "",
        "请只输出 JSON。",
      ].join("\n"),
      schema: responseSchema,
    });

    return NextResponse.json(
      {
        result: result.data,
        mode: "anthropic",
        meta: {
          provider: "anthropic",
          promptVersion: AI_PROMPTS.jdMatch.version,
          attempts: result.attempts,
        },
      },
      { headers: buildRateLimitHeaders(rateLimit) },
    );
  } catch {
    return NextResponse.json(
      {
        result: buildFallbackResult(),
        mode: "fallback",
        meta: { provider: "local", promptVersion: AI_PROMPTS.jdMatch.version },
      },
      { headers: buildRateLimitHeaders(rateLimit) },
    );
  }
}