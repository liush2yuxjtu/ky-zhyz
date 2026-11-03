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

/** Short chip label + real scene text (avoid AI-demo essay chips). */
const EXAMPLES: { label: string; scene: string }[] = [
  { label: "奶茶", scene: "奶茶加错糖还排队半小时" },
  { label: "排位", scene: "排位连跪被坑队友甩锅" },
  { label: "房租", scene: "房租又涨房东还不修灯" },
  { label: "詹皇", scene: "詹皇打铁还甩锅" },
  { label: "砍勇", scene: "复述评论区：砍勇最会游走" },
  { label: "野种", scene: "用经典原句嘲讽詹姆斯抽象操作" },
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
          className="mb-2 block text-[13px] font-medium text-mute"
        >
          场景输入
        </label>
        <textarea
          ref={textareaRef}
          id="scene"
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void generate();
            }
          }}
          rows={3}
          placeholder="排位连跪 / 奶茶加错糖 / …"
          disabled={loading}
          autoFocus
          className="w-full resize-y rounded-md border border-stroke bg-ink px-3 py-3 font-body text-[15px] text-text caret-magenta outline-none placeholder:text-mute focus:border-magenta focus:shadow-[0_4px_0_0_rgba(255,43,214,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-magenta disabled:opacity-60"
        />
        <div className="chip-scroll mt-3 flex gap-2 overflow-x-auto pb-2">
          {EXAMPLES.map((ex, i) => (
            <button
              key={ex.label}
              type="button"
              disabled={loading}
              title={ex.scene}
              aria-label={`用场景：${ex.scene}`}
              onClick={() => {
                setScene(ex.scene);
                track("example_chip", { index: i, label: ex.label });
                void generate(ex.scene, { fromExample: true });
              }}
              className="inline-flex min-h-11 shrink-0 items-center rounded border border-stroke bg-ink px-3 font-body text-[13px] text-mute transition hover:border-lime hover:text-lime focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-50"
            >
              {ex.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void generate()}
          className="mt-4 hidden w-full rounded-md border-2 border-magenta bg-magenta/15 py-3 font-body text-base font-bold text-magenta transition hover:bg-magenta hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-magenta disabled:cursor-wait disabled:opacity-60 sm:block"
        >
          {loading ? loadingLabel : "翻译成 ky,zhyz"}
        </button>
        {error && !loading && (
          <p className="mt-3 rounded border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
            {error}
          </p>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stroke bg-ink/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        <button
          type="button"
          disabled={loading}
          onClick={() => void generate()}
          className="w-full min-h-12 rounded-md border-2 border-magenta bg-magenta/20 py-3 font-body text-base font-bold text-magenta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-magenta disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? loadingLabel : "翻译成 ky,zhyz"}
        </button>
      </div>

      {!loading && !showResult && (
        <p className="mt-6 text-center text-[13px] text-mute">
          写好场景后点「翻译成 ky,zhyz」，六字会出现在这里
        </p>
      )}

      {(loading || showResult) && (
        <section aria-live="polite" aria-busy={loading} className="mt-6 rounded-lg border border-stroke bg-panel/90 p-4 sm:p-6">
          {loading && (
            <p className="py-6 text-center text-sm text-magenta motion-safe:animate-pulse">
              {loadingLabel}
            </p>
          )}
          {showResult && (
            <>
              <SlotBoard slots={slots} filled />
              {display && (
                canMeme ? (
                  <button
                    type="button"
                    onClick={() => {
                      track("meme_open", {});
                      setMemeOpen(true);
                    }}
                    className="mt-5 block w-full text-center font-body text-3xl font-black tracking-wide text-magenta transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-magenta sm:text-4xl"
                    title="点开梗图"
                  >
                    {display}
                  </button>
                ) : (
                  <p className="mt-5 text-center font-body text-3xl font-black tracking-wide text-magenta sm:text-4xl">
                    {display}
                  </p>
                )
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
                    className="inline-flex min-h-11 items-center rounded-md border border-lime/50 bg-lime/10 px-4 font-body text-sm font-bold text-lime transition hover:bg-lime hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
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
