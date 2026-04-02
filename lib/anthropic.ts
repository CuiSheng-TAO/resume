import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_ROUTE_LIMIT_WINDOW_MS = 300_000;
const DEFAULT_ROUTE_LIMIT_MAX_REQUESTS = 20;

const readPositiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const readRetryCount = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
};

export const getAnthropicConfig = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || null;
  const model = process.env.ANTHROPIC_MODEL?.trim() || null;
  const timeoutMs = readPositiveNumber(process.env.ANTHROPIC_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const maxRetries = readRetryCount(process.env.ANTHROPIC_MAX_RETRIES, DEFAULT_MAX_RETRIES);
  const routeLimitWindowMs = readPositiveNumber(
    process.env.AI_ROUTE_LIMIT_WINDOW_MS,
    DEFAULT_ROUTE_LIMIT_WINDOW_MS,
  );
  const routeLimitMaxRequests = readPositiveNumber(
    process.env.AI_ROUTE_LIMIT_MAX_REQUESTS,
    DEFAULT_ROUTE_LIMIT_MAX_REQUESTS,
  );

  return {
    apiKey,
    model,
    timeoutMs,
    maxRetries,
    routeLimitWindowMs,
    routeLimitMaxRequests,
    enabled: Boolean(apiKey && model),
  };
};

export const getAnthropicClient = (config = getAnthropicConfig()) => {
  if (!config.enabled || !config.apiKey) {
    return null;
  }

  return new Anthropic({ apiKey: config.apiKey });
};

export const readTextFromAnthropicResponse = (
  response: {
    content?: Array<{
      type: string;
      text?: string;
    }>;
  },
) =>
  (response.content ?? [])
    .filter((item) => item.type === "text")
    .map((item) => item.text ?? "")
    .join("\n");

export const extractJsonCandidate = (text: string) => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) {
    return fenced;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }

  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return trimmed.slice(firstBracket, lastBracket + 1).trim();
  }

  return trimmed;
};

export const parseJsonFromText = <T>(text: string, schema: z.ZodType<T>) =>
  schema.parse(JSON.parse(extractJsonCandidate(text)));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("anthropic_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

type AnthropicJsonRequest<T> = {
  system: string;
  userContent: string;
  maxTokens: number;
  schema: z.ZodType<T>;
  timeoutMs?: number;
  maxRetries?: number;
};

export const requestAnthropicJson = async <T>({
  system,
  userContent,
  maxTokens,
  schema,
  timeoutMs: timeoutOverrideMs,
  maxRetries: maxRetriesOverride,
}: AnthropicJsonRequest<T>) => {
  const config = getAnthropicConfig();
  const client = getAnthropicClient(config);

  if (!client || !config.enabled || !config.model) {
    throw new Error("anthropic_not_configured");
  }

  let attempts = 0;
  let lastError: unknown;
  const timeoutMs = timeoutOverrideMs ?? config.timeoutMs;
  const maxRetries = maxRetriesOverride ?? config.maxRetries;

  while (attempts <= maxRetries) {
    attempts += 1;

    try {
      const response = await withTimeout(
        client.messages.create({
          model: config.model,
          max_tokens: maxTokens,
          system,
          messages: [
            {
              role: "user",
              content: userContent,
            },
          ],
        }),
        timeoutMs,
      );

      const text = readTextFromAnthropicResponse(response as Anthropic.Message);
      return {
        data: parseJsonFromText(text, schema),
        attempts,
      };
    } catch (error) {
      lastError = error;

      if (attempts > maxRetries) {
        break;
      }

      await wait(Math.min(250 * attempts, 750));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("anthropic_request_failed");
};
