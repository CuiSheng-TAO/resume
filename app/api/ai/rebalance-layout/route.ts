import { NextResponse } from "next/server";
import { z } from "zod";

import { balanceResumeDraft } from "@/lib/layout-plan";

const requestSchema = z.object({
  workspace: z.any(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "参数不完整。" }, { status: 400 });
  }

  const layoutPlan = balanceResumeDraft(parsed.data.workspace);

  return NextResponse.json({
    layoutPlan,
    message: "已重新平衡当前一页排版。",
  });
}
