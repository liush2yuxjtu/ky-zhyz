import type { CharVerdict, ValidationResult } from "@/lib/validator";

export type TopicPayload = {
  id: string;
  name: string;
  note: string;
  phrase: string;
  memeSrc?: string | null;
};

export type ApiOk = {
  type?: "result";
  ok: true;
  phrase: string;
  display: string;
  gloss: string;
  validation: ValidationResult;
  attempts: number;
  topic?: TopicPayload;
};

export type ApiFail = {
  type?: "result";
  ok: false;
  error: string;
  attempts?: number;
};

type StreamEvent =
  | { type: "start"; maxAttempts: number }
  | { type: "attempt"; n: number; max: number }
  | (ApiOk & { type: "result" })
  | (ApiFail & { type: "result" });

export type { CharVerdict };

/** Read SSE body from POST /api/generate until a result event. */
export async function readGenerateStream(
  res: Response,
  signal?: AbortSignal,
): Promise<ApiOk | ApiFail> {
  if (!res.body) {
    return { ok: false, error: "网络挂了，再点一次" };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: ApiOk | ApiFail | null = null;

  const onAbort = () => {
    void reader.cancel();
  };
  signal?.addEventListener("abort", onAbort);

  try {
    while (true) {
      if (signal?.aborted) {
        return { ok: false, error: "已取消硬造" };
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const line = chunk
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l.startsWith("data:"));
        if (!line) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;
        let evt: StreamEvent;
        try {
          evt = JSON.parse(raw) as StreamEvent;
        } catch {
          continue;
        }
        if (evt.type === "result") {
          final = evt;
        }
      }
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }

  if (final) return final;
  if (signal?.aborted) return { ok: false, error: "已取消硬造" };
  return { ok: false, error: "这波没凑齐 ky,zhyz，点一下再试一次就好。" };
}

/** Single-shot generate against /api/generate (no UI auto-retry loop). */
export async function postGenerate(opts: {
  scene: string;
  avoid?: string[];
  locks?: (string | null)[];
  signal?: AbortSignal;
}): Promise<ApiOk | ApiFail> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      scene: opts.scene,
      avoid: opts.avoid ?? [],
      locks: opts.locks ?? [null, null, null, null, null, null],
    }),
    signal: opts.signal,
  });

  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return (await res.json()) as ApiFail;
  }
  return readGenerateStream(res, opts.signal);
}
