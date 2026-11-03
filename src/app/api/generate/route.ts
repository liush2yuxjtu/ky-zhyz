import {
  generateKyZhyz,
  MAX_ATTEMPTS,
  sanitizeAvoid,
  sanitizeLocks,
} from "@/lib/deepseek";
import { matchTopic, memeSrc } from "@/lib/topics";

export const runtime = "nodejs";

type Body = {
  scene?: string;
  /** Recent PASS phrases to avoid repeating on re-click. */
  avoid?: unknown;
  /** Locked slot chars: length-6 array / {index:char}. */
  locks?: unknown;
};

function sseLine(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "坏请求" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const scene = typeof body.scene === "string" ? body.scene.trim() : "";
  if (!scene) {
    return new Response(
      JSON.stringify({ ok: false, error: "先丢一句场景进来" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  if (scene.length > 500) {
    return new Response(
      JSON.stringify({ ok: false, error: "场景太长了，收一收（≤500字）" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "服务暂时不可用，稍后再试。" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(sseLine(obj));
      try {
        send({ type: "start", maxAttempts: MAX_ATTEMPTS });

        const avoid = sanitizeAvoid(body.avoid);
        const locks = sanitizeLocks(body.locks);
        const result = await generateKyZhyz(
          scene,
          apiKey,
          ({ attempt, maxAttempts }) => {
            // Progress only — never fail slots / partial phrases
            send({ type: "attempt", n: attempt, max: maxAttempts });
          },
          avoid,
          locks,
        );

        if (!result.ok) {
          send({
            type: "result",
            ok: false,
            error: result.error,
            attempts: result.attempts,
          });
          controller.close();
          return;
        }

        const match = matchTopic({
          scene,
          phrase: result.phrase,
          gloss: result.gloss,
        });

        send({
          type: "result",
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
            memeSrc: memeSrc(match.topic),
          },
        });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "生成失败";
        const safe = message.replace(/sk-[a-zA-Z0-9]+/g, "[redacted]");
        void safe;
        send({
          type: "result",
          ok: false,
          error: "生成出了点岔子，再试一次。",
          attempts: 0,
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
