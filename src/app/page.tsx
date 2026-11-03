"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MemePop } from "@/components/MemePop";
import { SlotBoard } from "@/components/SlotBoard";
import type { CharVerdict, ValidationResult } from "@/lib/validator";
import { matchTopic, type TopicMatch } from "@/lib/topics";

type TopicPayload = {
  id: string;
  name: string;
  note: string;
  phrase: string;
  matchedKeywords: string[];
  via: "keyword" | "fallback";
  score: number;
  memeSrc: string;
};

type ApiOk = {
  ok: true;
  phrase: string;
  display: string;
  gloss: string;
  validation: ValidationResult;
  attempts: number;
  topic?: TopicPayload;
};

type ApiFail = {
  ok: false;
  error: string;
  attempts?: number;
};

const EXAMPLES = [
  "詹皇又甩锅还说队友不懂球",
  "Canyon转会抱团被叫三慕斯",
  "蔡徐坤又被拿出来说篮球",
  "老板雷军发布会又 are you ok",
  "论文被审稿人批到体无完肤",
];

function topicFromPayload(t?: TopicPayload): TopicMatch | null {
  if (!t) return null;
  return {
    topic: {
      id: t.id,
      name: t.name,
      phrase: t.phrase,
      keywords: t.matchedKeywords,
      note: t.note,
      meme: {
        url: t.memeSrc,
        path: t.memeSrc.startsWith("/") ? t.memeSrc : undefined,
      },
    },
    score: t.score,
    matchedKeywords: t.matchedKeywords,
    via: t.via,
  };
}

export default function Home() {
  const [scene, setScene] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [display, setDisplay] = useState("");
  const [gloss, setGloss] = useState("");
  const [slots, setSlots] = useState<CharVerdict[] | undefined>();
  const [attempts, setAttempts] = useState(0);
  const [memeOpen, setMemeOpen] = useState(false);
  const [topicMatch, setTopicMatch] = useState<TopicMatch | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const generate = useCallback(
    async (override?: string) => {
      const text = (override ?? scene).trim();
      if (!text) {
        setError("先写一句你想吐的场景");
        textareaRef.current?.focus();
        return;
      }
      setLoading(true);
      setError(null);
      setMemeOpen(false);
      // Clear previous PASS while looping — never flash fail slots
      setDisplay("");
      setGloss("");
      setSlots(undefined);
      setTopicMatch(null);
      setAttempts(0);

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scene: text }),
        });
        const data = (await res.json()) as ApiOk | ApiFail;
        setAttempts(data.attempts ?? 0);

        if (data.ok && data.validation?.pass) {
          setDisplay(data.display);
          setGloss(data.gloss);
          setSlots(data.validation.slots);
          setTopicMatch(
            topicFromPayload(data.topic) ??
              matchTopic({
                scene: text,
                phrase: data.phrase,
                gloss: data.gloss,
              }),
          );
          setMemeOpen(true);
        } else {
          setDisplay("");
          setGloss("");
          setSlots(undefined);
          setTopicMatch(null);
          setError(
            (!data.ok && data.error) ||
              "这波没凑齐 ky,zhyz，点一下再试一次就好。",
          );
        }
      } catch {
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

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-28 pt-6 sm:px-6 sm:pb-16 sm:pt-10">
      <header className="mb-5 sm:mb-6">
        <h1 className="font-display text-[20px] leading-none text-text sm:text-[26px]">
          <span className="text-magenta">ky</span>
          <span className="text-mute">,</span>
          <span className="text-lime">zhyz</span>
        </h1>
        <p className="mt-2 text-[13px] leading-snug text-mute sm:text-sm">
          丢场景 → 服务端静默凑齐六字 → 你只看到过检答案
        </p>
      </header>

      {/* 1) Input first — above the fold */}
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
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={loading}
              onClick={() => {
                setScene(ex);
                void generate(ex);
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
          {loading ? "生成中…" : "翻译成 ky,zhyz"}
        </button>
        {error && !loading && (
          <p className="mt-3 rounded border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
            {error}
          </p>
        )}
      </section>

      {/* Sticky CTA on mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stroke bg-ink/95 p-3 backdrop-blur sm:hidden">
        <button
          type="button"
          disabled={loading}
          onClick={() => void generate()}
          className="w-full rounded-md border-2 border-magenta bg-magenta/20 py-3 font-body text-base font-bold text-magenta disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "生成中…" : "翻译成 ky,zhyz"}
        </button>
      </div>

      {/* 2) Result only after PASS (or compact loading) */}
      {(loading || showResult) && (
        <section className="mt-6 rounded-lg border border-stroke bg-panel/90 p-4 shadow-[inset_0_0_0_1px_rgba(255,43,214,0.08)] sm:p-6">
          {loading && (
            <p className="py-6 text-center font-mono text-sm text-magenta animate-pulse">
              生成中…
            </p>
          )}
          {showResult && (
            <>
              <SlotBoard slots={slots} filled />
              {display && (
                <p className="mt-5 text-center font-body text-3xl font-black tracking-wide text-magenta sm:text-4xl">
                  {display}
                </p>
              )}
              {gloss && (
                <p className="mt-2 text-center text-sm text-mute">{gloss}</p>
              )}
              {topicMatch && (
                <p className="mt-2 text-center font-mono text-[11px] text-lime/80">
                  主题 · {topicMatch.topic.name}
                  {topicMatch.via === "keyword"
                    ? ` · 词：${topicMatch.matchedKeywords.slice(0, 3).join("/")}`
                    : " · 兜底"}
                </p>
              )}
              {attempts > 0 && (
                <p className="mt-1 text-center font-mono text-[10px] text-mute">
                  已过检 · 内部尝试 {attempts} 次
                </p>
              )}
            </>
          )}
        </section>
      )}

      {showResult && slots && (
        <section className="mt-6 overflow-hidden rounded-lg border border-stroke">
          <div className="border-b border-stroke bg-panel-2 px-4 py-2 font-mono text-[11px] text-mute">
            已过检 · 六格首字母均合 ky,zhyz（多音字任一读音命中）
          </div>
          <ul className="divide-y divide-stroke bg-panel">
            {slots.map((s) => (
              <li
                key={s.index}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm"
              >
                <span className="font-mono text-mute">#{s.index + 1}</span>
                <span className="text-lg font-bold">{s.char}</span>
                <span className="font-mono text-xs text-mute">{s.expected}</span>
                <span className="font-mono text-xs text-text/80">
                  [{(s.bares ?? s.initials).join(" · ") || "—"}]
                </span>
                <span className="text-xs text-mute">
                  {s.readings.join(" / ")}
                </span>
                <span className="ml-auto font-display text-[10px] text-lime">
                  合
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-10 border-t border-stroke pt-5 font-mono text-[10px] leading-relaxed text-mute">
        <p>
          表情：MemeCrafters/meme-generator（MIT）本地包 + ChineseBQB
          远程备份。人物词表 100 条见 /data/ky-zhyz-topics.json。
        </p>
        <p className="mt-1">
          deepseek-chat · 无 reasoner · 服务端静默重试至过检
        </p>
      </footer>

      <MemePop
        open={memeOpen}
        onClose={() => setMemeOpen(false)}
        phrase={display}
        match={topicMatch}
      />
    </main>
  );
}
