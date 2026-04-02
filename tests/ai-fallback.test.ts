import { describe, expect, it } from "vitest";

import { rewriteExperienceFallback } from "@/lib/ai-fallback";

describe("rewriteExperienceFallback", () => {
  it("returns suggested bullets plus fallback variants for a strong experience", () => {
    const result = rewriteExperienceFallback({
      organization: "微派网络科技有限公司",
      role: "招聘实习生",
      narrative:
        "支持运营、美术、技术等10余个岗位类型招聘，3个月推进13位候选人入职，招聘目标达成率87%。",
    });

    expect(result.suggestedBullets.length).toBeGreaterThan(0);
    expect(result.suggestedBullets[0]).toContain("13位候选人入职");
    expect(result.variants.star).toContain("87%");
    expect(result.variants.compact.length).toBeLessThan(result.variants.star.length);
  });

  it("stays conservative when the experience lacks strong evidence", () => {
    const result = rewriteExperienceFallback({
      organization: "学生会",
      role: "干事",
      narrative: "负责活动支持和沟通。",
    });

    expect(result.suggestedBullets).toEqual(["负责活动支持和沟通"]);
    expect(result.followUpPrompt).toContain("数字");
    expect(result.suggestedBullets.join("")).not.toMatch(/\d/);
  });

  it("strengthens weak verbs and removes filler", () => {
    const result = rewriteExperienceFallback({
      organization: "某公司",
      role: "实习生",
      narrative: "我在公司帮助同事做了一个项目。然后写了一份报告。",
    });

    expect(result.suggestedBullets.length).toBe(2);
    expect(result.suggestedBullets[0]).not.toMatch(/^我在/);
    expect(result.suggestedBullets[0]).toContain("协助");
    expect(result.suggestedBullets[1]).toContain("撰写");
  });

  it("deduplicates overlapping bullets", () => {
    const result = rewriteExperienceFallback({
      organization: "某公司",
      role: "实习生",
      narrative: "推进招聘流程。推进招聘流程并完成复盘。",
    });

    expect(result.suggestedBullets.length).toBe(1);
    expect(result.suggestedBullets[0]).toContain("复盘");
  });
});
