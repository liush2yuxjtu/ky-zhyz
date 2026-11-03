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

/** Auto-retry toggle label — must PASS ky,zhyz (了→又 so slot2=y). */
const AUTO_RETRY_PHRASE = "垮又再会硬造";
const AUTO_RETRY_DISPLAY = "垮又，再会硬造";
const AUTO_RETRY_MAX = 12;
const AUTO_RETRY_LS = "ky-zhyz-auto-retry";

/** Short chip label + real scene text (avoid AI-demo essay chips). */
const EXAMPLES: { label: string; scene: string }[] = [
  { label: "奶茶", scene: "奶茶加错糖还排队半小时" },
  { label: "排位", scene: "排位连跪被坑队友甩锅" },
  { label: "房租", scene: "房租又涨房东还不修灯" },
  { label: "詹皇", scene: "詹皇打铁还甩锅" },
  { label: "砍勇", scene: "复述评论区：砍勇最会游走" },
  { label: "野种", scene: "用经典原句嘲讽詹姆斯抽象操作" },
];

async function readGenerateStream(
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
  /** Session phrases to push as avoid on re-generate (same or any scene). */
  const recentPhrasesRef = useRef<string[]>([]);
  /** Per-slot lock; parallel to current PASS chars. */
  const [lockedMask, setLockedMask] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  const [lockHint, setLockHint] = useState<string | null>(null);
  const [autoRetry, setAutoRetry] = useState(false);
  const autoRetryRef = useRef(false);
  const [retryTick, setRetryTick] = useState(0);
  const [rememberHint, setRememberHint] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTO_RETRY_LS);
      if (saved === "1") {
        setAutoRetry(true);
        autoRetryRef.current = true;
        setRememberHint(`已记住：${AUTO_RETRY_DISPLAY}`);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!rememberHint) return;
    const t = window.setTimeout(() => setRememberHint(null), 4200);
    return () => window.clearTimeout(t);
  }, [rememberHint]);

  useEffect(() => {
    if (!lockHint) return;
    const t = window.setTimeout(() => setLockHint(null), 3200);
    return () => window.clearTimeout(t);
  }, [lockHint]);

  const setAutoRetryOn = useCallback((on: boolean) => {
    setAutoRetry(on);
    autoRetryRef.current = on;
    try {
      localStorage.setItem(AUTO_RETRY_LS, on ? "1" : "0");
    } catch {
      /* ignore */
    }
    track("auto_retry_toggle", { on: on ? 1 : 0 });
    if (on) {
      setRememberHint(`已记住：${AUTO_RETRY_DISPLAY}`);
    } else {
      setRememberHint(null);
      // Turning off mid-flight cancels the hammer.
      abortRef.current?.abort();
    }
  }, []);

  const cancelHardMake = useCallback(() => {
    abortRef.current?.abort();
    autoRetryRef.current = false;
    setAutoRetry(false);
    try {
      localStorage.setItem(AUTO_RETRY_LS, "0");
    } catch {
      /* ignore */
    }
    track("auto_retry_cancel", {});
  }, []);

  const generate = useCallback(
    async (override?: string, opts?: { fromExample?: boolean }) => {
      const text = (override ?? scene).trim();
      if (!text) {
        setError("先写一句你想吐的场景");
        textareaRef.current?.focus();
        return;
      }

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      setError(null);
      setMemeOpen(false);
      setRetryTick(0);
      // Keep current board while locked-regenerating so fail does not wipe locks.
      if (!lockedMask.some(Boolean)) {
        setDisplay("");
        setGloss("");
        setSlots(undefined);
        setMemeTitle("");
        setMemeSrc("");
        setMemeNote("");
      }

      track("generate_click", {
        has_example: Boolean(opts?.fromExample),
        auto_retry: autoRetryRef.current ? 1 : 0,
      });

      const locksPayload = lockedMask.map((on, i) =>
        on && slots?.[i]?.char ? slots[i]!.char : null,
      );

      let round = 0;
      try {
        while (true) {
          if (ac.signal.aborted) {
            setError("已取消硬造");
            setRetryTick(0);
            return;
          }
          round += 1;
          if (round > 1) setRetryTick(round);

          const res = await fetch("/api/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream",
            },
            body: JSON.stringify({
              scene: text,
              avoid: recentPhrasesRef.current.slice(-8),
              locks: locksPayload,
            }),
            signal: ac.signal,
          });

          const ct = res.headers.get("content-type") ?? "";
          if (ct.includes("application/json")) {
            const data = (await res.json()) as ApiFail;
            track("generate_fail", {
              attempts: typeof data.attempts === "number" ? data.attempts : 0,
              round,
            });
            const canRetry =
              autoRetryRef.current &&
              !ac.signal.aborted &&
              round < AUTO_RETRY_MAX;
            if (canRetry) continue;
            if (!lockedMask.some(Boolean)) {
              setDisplay("");
              setGloss("");
              setSlots(undefined);
              setMemeTitle("");
              setMemeSrc("");
              setMemeNote("");
            }
            if (ac.signal.aborted) {
              setError("已取消硬造");
            } else if (autoRetryRef.current && round >= AUTO_RETRY_MAX) {
              setError(
                `试了 ${round} 轮仍垮——${AUTO_RETRY_PHRASE}也救不了，改场景或解锁再试。`,
              );
            } else {
              setError(data.error || "生成出了点岔子，再试一次。");
            }
            setRetryTick(0);
            return;
          }

          const data = await readGenerateStream(res, ac.signal);

          if (data.ok && data.validation?.pass) {
            track("generate_success", {
              attempts: typeof data.attempts === "number" ? data.attempts : 0,
              round,
              auto_retry: autoRetryRef.current ? 1 : 0,
            });
            if (typeof data.phrase === "string" && data.phrase) {
              const next = [
                ...recentPhrasesRef.current.filter((p) => p !== data.phrase),
                data.phrase,
              ];
              recentPhrasesRef.current = next.slice(-8);
            }
            setDisplay(data.display);
            setGloss(data.gloss);
            setSlots(data.validation.slots);
            if (data.topic?.memeSrc) {
              setMemeTitle(data.topic.name || "");
              setMemeSrc(data.topic.memeSrc);
              setMemeNote(data.topic.note || "");
            }
            setError(null);
            setRetryTick(0);
            return;
          }

          track("generate_fail", {
            attempts:
              typeof data.attempts === "number" ? data.attempts : undefined,
            round,
          });
          const failMsg = !data.ok ? data.error : undefined;
          const canRetry =
            autoRetryRef.current &&
            !ac.signal.aborted &&
            round < AUTO_RETRY_MAX &&
            failMsg !== "已取消硬造";
          if (canRetry) continue;

          if (!lockedMask.some(Boolean)) {
            setDisplay("");
            setGloss("");
            setSlots(undefined);
            setMemeTitle("");
            setMemeSrc("");
            setMemeNote("");
          }
          if (ac.signal.aborted || failMsg === "已取消硬造") {
            setError("已取消硬造");
          } else if (autoRetryRef.current && round >= AUTO_RETRY_MAX) {
            setError(
              `试了 ${round} 轮仍垮——${AUTO_RETRY_PHRASE}也救不了，改场景或解锁再试。`,
            );
          } else {
            setError(
              failMsg || "这波没凑齐 ky,zhyz，点一下再试一次就好。",
            );
          }
          setRetryTick(0);
          return;
        }
      } catch (err) {
        if (ac.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          setError("已取消硬造");
        } else {
          track("generate_fail", { round });
          if (!lockedMask.some(Boolean)) {
            setDisplay("");
            setSlots(undefined);
          }
          setError("网络挂了，再点一次");
        }
        setRetryTick(0);
      } finally {
        setLoading(false);
      }
    },
    [scene, lockedMask, slots],
  );

  const showResult = Boolean(slots);
  const canMeme = Boolean(memeSrc);
  const hardMaking = loading && (autoRetry || retryTick > 1);
  const loadingLabel =
    retryTick > 1
      ? `${AUTO_RETRY_PHRASE}中…第 ${retryTick}/${AUTO_RETRY_MAX} 轮`
      : hardMaking
        ? "硬造中…"
        : "生成中…";

  const ctaLabel = loading
    ? loadingLabel
    : lockedMask.some(Boolean)
      ? "带着锁字再生成"
      : "翻译成 ky,zhyz";

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-32 pt-6 sm:px-6 sm:pb-16 sm:pt-10">
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
                setLockedMask([false, false, false, false, false, false]);
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
          {ctaLabel}
        </button>

        {/* Demoted under primary CTA */}
        <button
          type="button"
          role="switch"
          aria-checked={autoRetry}
          aria-label={`${AUTO_RETRY_DISPLAY}：失败自动重试直到成功`}
          title="开：生成失败就自动再搓，直到过检（最多 12 轮）；再点可取消"
          onClick={() => setAutoRetryOn(!autoRetry)}
          className={[
            "mt-3 flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime",
            autoRetry
              ? "border-lime/70 bg-lime/10 text-lime"
              : "border-stroke bg-ink text-mute hover:border-lime/50 hover:text-lime",
          ].join(" ")}
        >
          <span className="min-w-0">
            <span className="block font-body text-[14px] font-bold tracking-wide sm:text-[15px]">
              {AUTO_RETRY_DISPLAY}
            </span>
            <span className="mt-0.5 block text-[12px] leading-snug text-mute">
              {autoRetry
                ? "已开 · 失败会硬造到过检（可再点关掉/取消）"
                : "点开 · 失败自动重试直到成功"}
            </span>
          </span>
          <span
            aria-hidden
            className={[
              "relative h-6 w-10 shrink-0 rounded-full border transition",
              autoRetry ? "border-lime bg-lime" : "border-stroke bg-panel-2",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-0.5 h-4 w-4 rounded-full bg-ink transition",
                autoRetry ? "left-5" : "left-0.5",
              ].join(" ")}
            />
          </span>
        </button>

        {rememberHint && (
          <p className="mt-2 text-[12px] text-lime" role="status">
            {rememberHint}
          </p>
        )}
        {lockHint && (
          <p className="mt-2 text-[12px] text-warn" role="status">
            {lockHint}
          </p>
        )}

        {error && !loading && (
          <p className="mt-3 rounded border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
            {error}
          </p>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stroke bg-ink/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        {(autoRetry || hardMaking) && (
          <div className="mb-2 flex items-center justify-between gap-2">
            <span
              className={[
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold",
                hardMaking
                  ? "border-lime/60 bg-lime/15 text-lime motion-safe:animate-pulse"
                  : "border-lime/40 bg-lime/10 text-lime",
              ].join(" ")}
            >
              {hardMaking
                ? retryTick > 1
                  ? `硬造中 · ${retryTick}/${AUTO_RETRY_MAX}`
                  : "硬造中"
                : "垮又再会硬造 · 已开"}
            </span>
            {loading && (
              <button
                type="button"
                onClick={cancelHardMake}
                className="text-[12px] font-medium text-mute underline-offset-2 hover:text-warn hover:underline"
              >
                取消
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={() => void generate()}
          className="w-full min-h-12 rounded-md border-2 border-magenta bg-magenta/20 py-3 font-body text-base font-bold text-magenta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-magenta disabled:cursor-wait disabled:opacity-60"
        >
          {ctaLabel}
        </button>
      </div>

      {!loading && !showResult && (
        <p className="mt-6 text-center text-[13px] text-mute">
          写好场景后点「翻译成 ky,zhyz」，六字会出现在这里
        </p>
      )}

      {(loading || showResult) && (
        <section
          aria-live="polite"
          aria-busy={loading}
          className="mt-6 rounded-lg border border-stroke bg-panel/90 p-4 sm:p-6"
        >
          {loading && !showResult && (
            <div className="py-6 text-center">
              <p className="text-sm text-magenta motion-safe:animate-pulse">
                {loadingLabel}
              </p>
              {hardMaking && (
                <button
                  type="button"
                  onClick={cancelHardMake}
                  className="mt-3 text-[13px] text-mute underline-offset-2 hover:text-warn hover:underline"
                >
                  取消硬造
                </button>
              )}
            </div>
          )}
          {loading && showResult && (
            <div className="mb-3 flex flex-wrap items-center justify-center gap-3">
              <p className="text-center text-[13px] text-magenta motion-safe:animate-pulse">
                {lockedMask.some(Boolean) ? "锁字重写中…" : loadingLabel}
              </p>
              {hardMaking && (
                <button
                  type="button"
                  onClick={cancelHardMake}
                  className="text-[12px] text-mute underline-offset-2 hover:text-warn hover:underline"
                >
                  取消
                </button>
              )}
            </div>
          )}
          {showResult && (
            <>
              <SlotBoard
                slots={slots}
                filled
                locked={lockedMask}
                lockDisabled={loading}
                onToggleLock={(index) => {
                  setLockedMask((prev) => {
                    const next = [...prev];
                    const turningOn = !next[index];
                    next[index] = turningOn;
                    if (next.every(Boolean)) {
                      next[index] = false;
                      setLockHint("不能锁满六格——至少留一格给硬造改写");
                      track("slot_lock_blocked", { index });
                      return prev;
                    }
                    setLockHint(null);
                    track("slot_lock_toggle", {
                      index,
                      locked: next[index] ? 1 : 0,
                    });
                    return next;
                  });
                }}
              />
              {lockedMask.some(Boolean) && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <p className="text-[12px] text-warn">
                    已锁 {lockedMask.filter(Boolean).length} 字，再生成会保留
                  </p>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      setLockedMask([false, false, false, false, false, false])
                    }
                    className="text-[12px] text-mute underline-offset-2 hover:text-text hover:underline"
                  >
                    清除锁定
                  </button>
                </div>
              )}
              {display &&
                (canMeme ? (
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
                ))}
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
