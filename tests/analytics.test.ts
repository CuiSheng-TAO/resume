import { describe, expect, it } from "vitest";

import { createAnalyticsEvent } from "@/lib/analytics";

describe("createAnalyticsEvent", () => {
  it("strips resume正文和联系方式 from analytics payloads", () => {
    const event = createAnalyticsEvent("draft_created", {
      body: "支持运营、美术、技术等10余个岗位类型招聘。",
      email: "3294182452@qq.com",
      phone: "18973111415",
      hiddenExperienceIds: ["exp-2"],
      density: "tight",
    });

    expect(event.name).toBe("draft_created");
    expect(event.payload).toEqual({
      hiddenExperienceIds: ["exp-2"],
      density: "tight",
    });
  });
});
