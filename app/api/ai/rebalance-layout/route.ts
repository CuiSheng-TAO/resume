import { NextResponse } from "next/server";
import { z } from "zod";

import { balanceResumeDraft } from "@/lib/layout-plan";

const requestSchema = z.object({
  workspace: z.any(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "请求格式错误。" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "参数不完整。" }, { status: 400 });
  }

  const layoutPlan = balanceResumeDraft(parsed.data.workspace);

  return NextResponse.json({
    layoutPlan,
    message: "已重新平衡当前一页排版。",
  });
}
