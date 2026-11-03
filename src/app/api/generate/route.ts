import { NextResponse } from "next/server";
import { generateKyZhyz } from "@/lib/deepseek";
import { validateKyZhyz, formatDisplay } from "@/lib/validator";
import { matchTopic, memeSrc } from "@/lib/topics";

export const runtime = "nodejs";

type Body = {
  scene?: string;
  phrase?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "坏请求" }, { status: 400 });
  }

  const phraseOnly = typeof body.phrase === "string" ? body.phrase.trim() : "";
  if (phraseOnly) {
    const validation = validateKyZhyz(phraseOnly);
    const match = matchTopic({ phrase: phraseOnly });
    return NextResponse.json({
      ok: validation.pass,
      phrase: validation.chars.join(""),
      display: formatDisplay(validation.chars),
      gloss: "",
      validation,
      attempts: 0,
      mode: "validate",
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
    const match = matchTopic({
      scene,
      phrase: result.ok
        ? result.phrase
        : result.lastPhrase,
      gloss: result.ok ? result.gloss : result.lastGloss,
    });
    const topicPayload = {
      id: match.topic.id,
      name: match.topic.name,
      note: match.topic.note,
      phrase: match.topic.phrase,
      matchedKeywords: match.matchedKeywords,
      via: match.via,
      score: match.score,
      memeSrc: memeSrc(match.topic),
    };

    if (result.ok) {
      return NextResponse.json({ ...result, topic: topicPayload });
    }
    return NextResponse.json(
      { ...result, topic: topicPayload },
      { status: 422 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "生成失败";
    const safe = message.replace(/sk-[a-zA-Z0-9]+/g, "[redacted]");
    return NextResponse.json(
      { ok: false, error: safe, attempts: 0 },
      { status: 502 },
    );
  }
}
