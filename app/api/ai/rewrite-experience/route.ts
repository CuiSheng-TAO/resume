import { NextResponse } from "next/server";
import { z } from "zod";

import { rewriteExperienceFallback } from "@/lib/ai-fallback";
import { AI_PROMPTS } from "@/lib/ai-prompts";
import { buildRateLimitHeaders, checkAiRateLimit } from "@/lib/ai-rate-limit";
import { getAnthropicConfig, requestAnthropicJson } from "@/lib/anthropic";
import { deriveExperienceVariants } from "@/lib/experience";

const experienceSchema = z.object({
  organization: z.string(),
  role: z.string(),
  rawNarrative: z.string().optional().default(""),
  bullets: z.array(z.string()).optional().default([]),
});

const requestSchema = z.object({
  experience: experienceSchema,
  targetRole: z.string().optional(),
});

const responseSchema = z.object({
  suggestedBullets: z.array(z.string()).min(1).max(2),
  rationale: z.string().optional(),
  followUpPrompt: z.string().optional(),
});

export async function POST(request: Request) {
  const rateLimit = checkAiRateLimit(request, "rewrite-experience");
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

  const experience = parsed.data.experience;
  const targetRole = parsed.data.targetRole;
  const sourceNarrative = experience.bullets.join(" ").trim() || experience.rawNarrative;
  const fallback = rewriteExperienceFallback({
    organization: experience.organization,
    role: experience.role,
    narrative: sourceNarrative,
    targetRole,
  });

  const config = getAnthropicConfig();
  if (!config.enabled) {
    return NextResponse.json(
      {
        ...fallback,
        mode: "fallback",
        meta: {
          provider: "local",
          promptVersion: AI_PROMPTS.rewriteExperience.version,
        },
      },
      {
        headers: buildRateLimitHeaders(rateLimit),
      },
    );
  }

  try {
    const result = await requestAnthropicJson({
      maxTokens: 500,
      system: AI_PROMPTS.rewriteExperience.system,
      userContent: [
        targetRole ? `目标岗位：${targetRole}` : "",
        `组织：${experience.organization}`,
        `岗位：${experience.role}`,
        `当前经历要点：${sourceNarrative}`,
        "请只输出 JSON。",
      ]
        .filter(Boolean)
        .join("\n"),
      schema: responseSchema,
    });

    return NextResponse.json(
      {
        suggestedBullets: result.data.suggestedBullets,
        variants: deriveExperienceVariants(result.data.suggestedBullets),
        rationale: result.data.rationale,
        followUpPrompt: result.data.followUpPrompt,
        mode: "anthropic",
        meta: {
          provider: "anthropic",
          promptVersion: AI_PROMPTS.rewriteExperience.version,
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
          promptVersion: AI_PROMPTS.rewriteExperience.version,
        },
      },
      {
        headers: buildRateLimitHeaders(rateLimit),
      },
    );
  }
}
