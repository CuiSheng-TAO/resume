import { NextResponse } from "next/server";
import { z } from "zod";

const eventSchema = z.object({
  name: z.string(),
  timestamp: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const parsed = eventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "埋点格式不正确。" }, { status: 400 });
  }

  console.info("[resume-event]", parsed.data);

  return NextResponse.json({ ok: true });
}
