import { NextResponse } from "next/server";
import { generateKyZhyz } from "@/lib/deepseek";
import { matchTopic, memeSrc } from "@/lib/topics";

export const runtime = "nodejs";

type Body = {
  scene?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "坏请求" }, { status: 400 });
  }

  const scene = typeof body.scene === "string" ? body.scene.trim() : "";
  if (!scene) {
    return NextResponse.json(
      { ok: false, error: "先丢一句场景进来" },
      { status: 400 },
    );
  }
  if (scene.length > 500) {
    return NextResponse.json(
      { ok: false, error: "场景太长了，收一收（≤500字）" },
      { status: 400 },
    );
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "服务器未配置 DEEPSEEK_API_KEY" },
      { status: 500 },
    );
  }

  try {
    const result = await generateKyZhyz(scene, apiKey);

    if (!result.ok) {
      // Friendly error only — no fail slots / lastPhrase as the answer
      return NextResponse.json(
        { ok: false, error: result.error, attempts: result.attempts },
        { status: 422 },
      );
    }

    const match = matchTopic({
      scene,
      phrase: result.phrase,
      gloss: result.gloss,
    });

    return NextResponse.json({
      ok: true,
      phrase: result.phrase,
      display: result.display,
      gloss: result.gloss,
      validation: result.validation,
      attempts: result.attempts,
      topic: {
        id: match.topic.id,
        name: match.topic.name,
        note: match.topic.note,
        phrase: match.topic.phrase,
        matchedKeywords: match.matchedKeywords,
        via: match.via,
        score: match.score,
        memeSrc: memeSrc(match.topic),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "生成失败";
    const safe = message.replace(/sk-[a-zA-Z0-9]+/g, "[redacted]");
    return NextResponse.json(
      { ok: false, error: "生成出了点岔子，再试一次。", detail: safe, attempts: 0 },
      { status: 502 },
    );
  }
}
