"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { MemePop } from "@/components/MemePop";
import { SlotBoard } from "@/components/SlotBoard";
import type { CharVerdict, ValidationResult } from "@/lib/validator";

type TopicPayload = {
  id: string;
  name: string;
  note: string;
  phrase: string;
  memeSrc: string;
};

type ApiOk = {
  type?: "result";
  ok: true;
  phrase: string;
  display: string;
  gloss: string;
  validation: ValidationResult;
  attempts: number;
  topic?: TopicPayload;
};

type ApiFail = {
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

const EXAMPLES = [
  "詹皇又甩锅还说队友不懂球",
  "Canyon转会抱团被叫三慕斯",
  "蔡徐坤又被拿出来说篮球",
  "老板雷军发布会又 are you ok",
  "论文被审稿人批到体无完肤",
];

async function readGenerateStream(res: Response): Promise<ApiOk | ApiFail> {
  if (!res.body) {
    return { ok: false, error: "网络挂了，再点一次" };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: ApiOk | ApiFail | null = null;

  while (true) {
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
      // ignore start/attempt — one-shot UX, no「第 N 次」
    }
  }

  if (final) return final;
  return { ok: false, error: "这波没凑齐 ky,zhyz，点一下再试一次就好。" };
}

export default function Home() {
  const [scene, setScene] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [display, setDisplay] = useState("");
  const [gloss, setGloss] = useState("");
  const [slots, setSlots] = useState<CharVerdict[] | undefined>();
  const [memeOpen, setMemeOpen] = useState(false);
  const [memeTitle, setMemeTitle] = useState("");
  const [memeSrc, setMemeSrc] = useState("");
  const [memeNote, setMemeNote] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const generate = useCallback(
    async (override?: string, opts?: { fromExample?: boolean }) => {
      const text = (override ?? scene).trim();
      if (!text) {
        setError("先写一句你想吐的场景");
        textareaRef.current?.focus();
        return;
      }
      setLoading(true);
      setError(null);
      setMemeOpen(false);
      setDisplay("");
      setGloss("");
      setSlots(undefined);
      setMemeTitle("");
      setMemeSrc("");
      setMemeNote("");

      track("generate_click", {
        has_example: Boolean(opts?.fromExample),
      });

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ scene: text }),
        });

        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
          const data = (await res.json()) as ApiFail;
          track("generate_fail", {
            attempts: typeof data.attempts === "number" ? data.attempts : 0,
          });
          setError(data.error || "生成出了点岔子，再试一次。");
          return;
        }

        const data = await readGenerateStream(res);

        if (data.ok && data.validation?.pass) {
          track("generate_success", {
            attempts: typeof data.attempts === "number" ? data.attempts : 0,
          });
          setDisplay(data.display);
          setGloss(data.gloss);
          setSlots(data.validation.slots);
          if (data.topic?.memeSrc) {
            setMemeTitle(data.topic.name || "");
            setMemeSrc(data.topic.memeSrc);
            setMemeNote(data.topic.note || "");
          }
          // Do NOT auto-open meme — show board first
        } else {
          track("generate_fail", {
            attempts:
              typeof data.attempts === "number" ? data.attempts : undefined,
          });
          setDisplay("");
          setGloss("");
          setSlots(undefined);
          setMemeTitle("");
          setMemeSrc("");
          setMemeNote("");
          setError(
            (!data.ok && data.error) ||
              "这波没凑齐 ky,zhyz，点一下再试一次就好。",
          );
        }
      } catch {
        track("generate_fail", {});
        setDisplay("");
        setSlots(undefined);
        setError("网络挂了，再点一次");
      } finally {
        setLoading(false);
      }
    },
    [scene],
  );

  const showResult = Boolean(slots) && !loading;
  const canMeme = Boolean(memeSrc);
  const loadingLabel = "生成中…";

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-28 pt-6 sm:px-6 sm:pb-16 sm:pt-10">
      <header className="mb-5 sm:mb-6">
        <h1 className="font-display text-[20px] leading-none text-text sm:text-[26px]">
          <span className="text-magenta">ky</span>
          <span className="text-mute">,</span>
          <span className="text-lime">zhyz</span>
        </h1>
        <p className="mt-2 text-[13px] leading-snug text-mute sm:text-sm">
          丢场景 → 吐出六字 ky,zhyz
        </p>
      </header>

      <section className="rounded-lg border border-stroke bg-panel p-4 sm:p-5">
        <label
          htmlFor="scene"
          className="mb-2 block font-mono text-[11px] text-mute"
        >
          场景输入
        </label>
        <textarea
          ref={textareaRef}
          id="scene"
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          rows={3}
          placeholder="例：排位遇到三慕斯开大还甩锅……"
          disabled={loading}
          autoFocus
          className="w-full resize-y rounded-md border border-stroke bg-ink px-3 py-3 font-body text-[15px] text-text outline-none placeholder:text-mute/60 focus:border-magenta focus:shadow-[0_0_0_3px_rgba(255,43,214,0.2)] disabled:opacity-60"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex, i) => (
            <button
              key={ex}
              type="button"
              disabled={loading}
              onClick={() => {
                setScene(ex);
                track("example_chip", { index: i });
                void generate(ex, { fromExample: true });
              }}
              className="rounded-full border border-stroke bg-panel-2 px-3 py-1 text-xs text-mute transition hover:border-lime hover:text-lime disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void generate()}
          className="mt-4 hidden w-full rounded-md border-2 border-magenta bg-magenta/15 py-3 font-body text-base font-bold text-magenta transition hover:bg-magenta hover:text-ink disabled:cursor-wait disabled:opacity-60 sm:block"
        >
          {loading ? loadingLabel : "翻译成 ky,zhyz"}
        </button>
        {error && !loading && (
          <p className="mt-3 rounded border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
            {error}
          </p>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stroke bg-ink/95 p-3 backdrop-blur sm:hidden">
        <button
          type="button"
          disabled={loading}
          onClick={() => void generate()}
          className="w-full rounded-md border-2 border-magenta bg-magenta/20 py-3 font-body text-base font-bold text-magenta disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? loadingLabel : "翻译成 ky,zhyz"}
        </button>
      </div>

      {(loading || showResult) && (
        <section className="mt-6 rounded-lg border border-stroke bg-panel/90 p-4 shadow-[inset_0_0_0_1px_rgba(255,43,214,0.08)] sm:p-6">
          {loading && (
            <p className="py-6 text-center font-mono text-sm text-magenta animate-pulse">
              {loadingLabel}
            </p>
          )}
          {showResult && (
            <>
              <SlotBoard slots={slots} filled />
              {display && (
                <button
                  type="button"
                  onClick={() => {
                    if (!canMeme) return;
                    track("meme_open", {});
                    setMemeOpen(true);
                  }}
                  className="mt-5 block w-full text-center font-body text-3xl font-black tracking-wide text-magenta transition hover:brightness-110 sm:text-4xl"
                  title={canMeme ? "点开梗图" : undefined}
                >
                  {display}
                </button>
              )}
              {gloss && (
                <p className="mt-2 text-center text-sm text-mute">{gloss}</p>
              )}
              {canMeme && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      track("meme_open", {});
                      setMemeOpen(true);
                    }}
                    className="rounded-full border border-lime/50 bg-lime/10 px-4 py-2 font-body text-sm font-bold text-lime transition hover:bg-lime hover:text-ink"
                  >
                    看梗图
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <footer className="mt-10 border-t border-stroke pt-5 text-center text-[11px] text-mute">
        梗图来自社区表情包，非 AI 生成
      </footer>

      <MemePop
        open={memeOpen}
        onClose={() => setMemeOpen(false)}
        phrase={display}
        title={memeTitle}
        memeSrc={memeSrc}
        note={memeNote}
      />
    </main>
  );
}
