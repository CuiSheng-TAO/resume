import { NextResponse } from "next/server";
import { z } from "zod";

const eventSchema = z.object({
  name: z.string().max(200),
  timestamp: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "请求格式错误。" }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "埋点格式不正确。" }, { status: 400 });
  }

  console.info("[resume-event]", parsed.data);

  return NextResponse.json({ ok: true });
}
