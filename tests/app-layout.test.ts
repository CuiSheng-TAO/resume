import { describe, expect, it } from "vitest";

import { metadata } from "@/app/layout";

describe("app layout metadata", () => {
  it("uses a branded title", () => {
    expect(String(metadata.title)).toContain("ResumeForge");
    expect(String(metadata.title)).not.toContain("Siamese Dream");
  });
});
