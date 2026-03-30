import { getAnthropicConfig } from "@/lib/anthropic";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInMs: number;
};

type GlobalRateLimitStore = typeof globalThis & {
  __resumeCraftAiRateLimitStore?: Map<string, RateLimitBucket>;
};

const getStore = () => {
  const runtime = globalThis as GlobalRateLimitStore;

  if (!runtime.__resumeCraftAiRateLimitStore) {
    runtime.__resumeCraftAiRateLimitStore = new Map<string, RateLimitBucket>();
  }

  return runtime.__resumeCraftAiRateLimitStore;
};

const getClientIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip")?.trim() ||
  "anonymous";

const cleanupExpiredBuckets = (store: Map<string, RateLimitBucket>, now: number) => {
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }
};

export const checkAiRateLimit = (request: Request, routeKey: string): RateLimitResult => {
  const config = getAnthropicConfig();
  const now = Date.now();
  const store = getStore();
  const limit = config.routeLimitMaxRequests;
  const windowMs = config.routeLimitWindowMs;
  const key = `${routeKey}:${getClientIp(request)}`;

  cleanupExpiredBuckets(store, now);

  const bucket = store.get(key);
  if (!bucket) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      limit,
      remaining: Math.max(limit - 1, 0),
      resetInMs: windowMs,
    };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetInMs: Math.max(bucket.resetAt - now, 0),
    };
  }

  bucket.count += 1;
  store.set(key, bucket);

  return {
    allowed: true,
    limit,
    remaining: Math.max(limit - bucket.count, 0),
    resetInMs: Math.max(bucket.resetAt - now, 0),
  };
};

export const buildRateLimitHeaders = (result: RateLimitResult) => ({
  "x-ratelimit-limit": String(result.limit),
  "x-ratelimit-remaining": String(result.remaining),
  "x-ratelimit-reset": String(Math.ceil(result.resetInMs / 1000)),
});

export const resetAiRateLimitStore = () => {
  getStore().clear();
};
