import { describe, expect, it } from "vitest";

import { metadata } from "@/app/layout";

describe("app layout metadata", () => {
  it("uses a Chinese title instead of the old English brand name", () => {
    expect(metadata.title).toBe("校招一页简历助手");
    expect(String(metadata.title)).not.toContain("Siamese Dream");
  });
});
