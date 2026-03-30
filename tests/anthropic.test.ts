import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { extractJsonCandidate, getAnthropicConfig } from "@/lib/anthropic";

const ORIGINAL_ENV = process.env;

describe("anthropic runtime helpers", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_TIMEOUT_MS;
    delete process.env.ANTHROPIC_MAX_RETRIES;
    delete process.env.AI_ROUTE_LIMIT_WINDOW_MS;
    delete process.env.AI_ROUTE_LIMIT_MAX_REQUESTS;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns safe defaults when anthropic env is missing", () => {
    const config = getAnthropicConfig();

    expect(config.enabled).toBe(false);
    expect(config.timeoutMs).toBe(12000);
    expect(config.maxRetries).toBe(1);
    expect(config.routeLimitWindowMs).toBe(300000);
    expect(config.routeLimitMaxRequests).toBe(20);
  });

  it("reads current env values on each call", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "test-model";
    process.env.ANTHROPIC_TIMEOUT_MS = "9000";
    process.env.ANTHROPIC_MAX_RETRIES = "2";

    const config = getAnthropicConfig();

    expect(config.enabled).toBe(true);
    expect(config.apiKey).toBe("test-key");
    expect(config.model).toBe("test-model");
    expect(config.timeoutMs).toBe(9000);
    expect(config.maxRetries).toBe(2);
  });

  it("extracts raw json from fenced model output", () => {
    const candidate = extractJsonCandidate('```json\n{"nextQuestion":"继续","suggestion":"补一个结果数字"}\n```');

    expect(candidate).toBe('{"nextQuestion":"继续","suggestion":"补一个结果数字"}');
  });
});
