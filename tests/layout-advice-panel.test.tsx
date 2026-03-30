import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LayoutAdvicePanel } from "@/components/layout-advice-panel";
import type { LayoutAdvice } from "@/lib/layout-advice";

const advice: LayoutAdvice = {
  reasons: ["当前预览超出单页 14px，导出后大概率会分页。"],
  suggestions: [
    {
      id: "variant:exp-3:compact",
      kind: "switch-variant",
      title: "将“湖北联投东湖高新集团”切到 compact 版本",
      description: "优先压缩非锁定经历，信息损失最小。",
      actionLabel: "应用建议",
      experienceId: "exp-3",
      nextVariant: "compact",
    },
  ],
  sequence: [
    {
      id: "variant:exp-3:compact",
      kind: "switch-variant",
      title: "将“湖北联投东湖高新集团”切到 compact 版本",
      description: "优先压缩非锁定经历，信息损失最小。",
      actionLabel: "应用建议",
      experienceId: "exp-3",
      nextVariant: "compact",
    },
  ],
};

describe("LayoutAdvicePanel", () => {
  it("renders reasons, shows the preview sequence, and lets the user choose batch or single apply", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onApplySequence = vi.fn();

    render(
      <LayoutAdvicePanel advice={advice} onApply={onApply} onApplySequence={onApplySequence} />,
    );

    expect(screen.getByText("单页建议")).toBeInTheDocument();
    expect(screen.getByText("当前预览超出单页 14px，导出后大概率会分页。")).toBeInTheDocument();
    expect(screen.getByText("本轮预演")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "应用建议" }));

    expect(onApply).toHaveBeenCalledWith(advice.suggestions[0]);

    await user.click(screen.getByRole("button", { name: "一次应用本轮建议" }));

    expect(onApplySequence).toHaveBeenCalledWith(advice.sequence);
  });
});
