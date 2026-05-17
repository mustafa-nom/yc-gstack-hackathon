import { NextResponse } from "next/server";
import { appendLog, type LogLevel } from "@/lib/step-logger";

type Body = {
  runId?: string;
  step?: string;
  level?: LogLevel;
  message?: string;
};

const LEVELS: LogLevel[] = ["info", "success", "warn", "error"];

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const { runId, step, message } = body;
  const level: LogLevel = LEVELS.includes(body.level as LogLevel)
    ? (body.level as LogLevel)
    : "info";

  if (!runId || !step || !message) {
    return NextResponse.json(
      { ok: false, error: "runId, step, and message are required" },
      { status: 400 },
    );
  }

  await appendLog({ runId, step, level, message, source: "ui" });
  return NextResponse.json({ ok: true });
}
