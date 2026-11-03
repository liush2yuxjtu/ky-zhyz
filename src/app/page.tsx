"use client";

import { useCallback, useState } from "react";
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
  lastPhrase?: string;
  lastGloss?: string;
  validation?: ValidationResult;
  attempts?: number;
  topic?: TopicPayload;
};

const EXAMPLES = [
  "詹皇又甩锅还说队友不懂球",
  "Canyon转会抱团被叫三慕斯",
  "蔡徐坤又被拿出来说篮球",
  "老板雷军发布会又 arc you ok",
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
      meme: { url: t.memeSrc, path: t.memeSrc.startsWith("/") ? t.memeSrc : undefined },
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
  const [passed, setPassed] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [memeOpen, setMemeOpen] = useState(false);
  const [topicMatch, setTopicMatch] = useState<TopicMatch | null>(null);

  const applyValidation = useCallback((v?: ValidationResult) => {
    if (!v) {
      setSlots(undefined);
      return;
    }
    setSlots(v.slots);
  }, []);

  const generate = useCallback(
    async (override?: string) => {
      const text = (override ?? scene).trim();
      if (!text) {
        setError("先写一句你想吐的场景");
        return;
      }
      setLoading(true);
      setError(null);
      setPassed(false);
      setMemeOpen(false);

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scene: text }),
        });
        const data = (await res.json()) as ApiOk | ApiFail;
        setAttempts(data.attempts ?? 0);

        const matched =
          topicFromPayload(data.topic) ??
          matchTopic({
            scene: text,
            phrase: data.ok ? data.phrase : data.lastPhrase,
            gloss: data.ok ? data.gloss : data.lastGloss,
          });
        setTopicMatch(matched);

        if (data.ok) {
          setDisplay(data.display);
          setGloss(data.gloss);
          applyValidation(data.validation);
          setPassed(true);
          setMemeOpen(true);
        } else {
          const chars = data.validation?.chars ?? [];
          const fallback =
            chars.length === 6
              ? `${chars[0]}${chars[1]}，${chars[2]}${chars[3]}${chars[4]}${chars[5]}`
              : data.lastPhrase ?? "";
          setDisplay(fallback);
          setGloss(data.lastGloss ?? "");
          applyValidation(data.validation);
          setPassed(false);
          setError(data.error || "没过校验");
        }
      } catch {
        setError("网络挂了，再点一次");
      } finally {
        setLoading(false);
      }
    },
    [scene, applyValidation],
  );

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-16 pt-10 sm:px-6">
      <header className="mb-10">
        <p className="mb-3 font-mono text-[11px] text-mute">
          NBA吧外溢 · 电竞二次绑定 · 声母硬校验 · 100人物词表触发
        </p>
        <h1 className="font-display text-[22px] leading-relaxed text-text sm:text-[28px]">
          <span className="text-magenta">ky</span>
          <span className="text-mute">,</span>
          <span className="text-lime">zhyz</span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mute">
          丢一句任何场景。DeepSeek 吐出六字；逐字注音器（含多音字）卡死
          <span className="text-text"> k / y / zh / h / y / z </span>
          。过检后按关键词命中人物主题弹真实表情包（不是随机 AI 图）。
        </p>
      </header>

      <section className="mb-8 rounded-lg border border-stroke bg-panel/90 p-4 shadow-[inset_0_0_0_1px_rgba(255,43,214,0.08)] sm:p-6">
        <SlotBoard slots={slots} filled={Boolean(slots)} />
        {display && (
          <p
            className={[
              "mt-5 text-center font-body text-3xl font-black tracking-wide sm:text-4xl",
              passed ? "text-magenta" : "text-warn",
            ].join(" ")}
          >
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
            模型尝试 {attempts} 次 · 校验器说了算
          </p>
        )}
      </section>

      <section className="rounded-lg border border-stroke bg-panel p-4 sm:p-5">
        <label
          htmlFor="scene"
          className="mb-2 block font-mono text-[11px] text-mute"
        >
          场景输入
        </label>
        <textarea
          id="scene"
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          rows={3}
          placeholder="例：排位遇到三慕斯开大还甩锅……"
          className="w-full resize-y rounded-md border border-stroke bg-ink px-3 py-3 font-body text-[15px] text-text outline-none placeholder:text-mute/60 focus:border-magenta focus:shadow-[0_0_0_3px_rgba(255,43,214,0.2)]"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setScene(ex);
                void generate(ex);
              }}
              className="rounded-full border border-stroke bg-panel-2 px-3 py-1 text-xs text-mute transition hover:border-lime hover:text-lime"
            >
              {ex}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void generate()}
          className="mt-4 w-full rounded-md border-2 border-magenta bg-magenta/15 py-3 font-body text-base font-bold text-magenta transition hover:bg-magenta hover:text-ink disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "正在硬凹声母……" : "翻译成 ky,zhyz"}
        </button>
        {error && (
          <p className="mt-3 rounded border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
            {error}
          </p>
        )}
      </section>

      {slots && (
        <section className="mt-6 overflow-hidden rounded-lg border border-stroke">
          <div className="border-b border-stroke bg-panel-2 px-4 py-2 font-mono text-[11px] text-mute">
            逐字注音检验器 · 多音字任一读音命中即 PASS
          </div>
          <ul className="divide-y divide-stroke bg-panel">
            {slots.map((s) => (
              <li
                key={s.index}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm"
              >
                <span className="font-mono text-mute">#{s.index + 1}</span>
                <span className="text-lg font-bold">{s.char || "∅"}</span>
                <span className="font-mono text-xs text-mute">
                  要 {s.expected}
                </span>
                <span className="font-mono text-xs text-text/80">
                  [{s.initials.join(" · ") || "—"}]
                </span>
                <span className="text-xs text-mute">
                  {s.readings.join(" / ")}
                </span>
                <span
                  className={[
                    "ml-auto font-display text-[10px]",
                    s.pass ? "text-lime" : "text-warn",
                  ].join(" ")}
                >
                  {s.pass ? "PASS" : "FAIL"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-12 border-t border-stroke pt-6 font-mono text-[10px] leading-relaxed text-mute">
        <p>
          表情：MemeCrafters/meme-generator（MIT）本地包 + ChineseBQB
          远程备份。人物词表 100 条见 /data/ky-zhyz-topics.json。
        </p>
        <p className="mt-1">
          deepseek-chat · 无 reasoner · pinyin-pro 多音字全读音
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
