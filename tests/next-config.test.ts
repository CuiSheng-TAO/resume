import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";

describe("next config", () => {
  it("allows local loopback dev origins so 127.0.0.1 can load dev resources", () => {
    expect(nextConfig.allowedDevOrigins).toContain("127.0.0.1");
  });
});
