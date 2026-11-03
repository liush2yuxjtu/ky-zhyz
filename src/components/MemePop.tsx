"use client";

import { useEffect } from "react";
import type { TopicMatch } from "@/lib/topics";
import { memeSrc } from "@/lib/topics";

type Props = {
  open: boolean;
  onClose: () => void;
  phrase: string;
  match: TopicMatch | null;
};

export function MemePop({ open, onClose, phrase, match }: Props) {
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(onClose, 3200);
    return () => window.clearTimeout(t);
  }, [open, onClose, phrase, match?.topic.id]);

  if (!open || !match) return null;

  const src = memeSrc(match.topic);
  const title = match.topic.name;
  const via =
    match.via === "keyword"
      ? `命中：${match.matchedKeywords.slice(0, 4).join(" · ")}`
      : "未命中人物词表 · 兜底表情";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-label="梗图触发"
      onClick={onClose}
    >
      <div
        className="meme-burst relative w-full max-w-sm rounded-lg border-2 border-magenta bg-panel p-3 shadow-[0_0_40px_rgba(255,43,214,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-1 text-center font-display text-[11px] text-lime">
          PASS
        </p>
        <p className="mb-2 text-center font-mono text-[10px] text-mute">
          {title} · {via}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={title}
          className="mx-auto max-h-56 w-auto rounded object-contain"
        />
        <p className="mt-3 text-center font-body text-xl font-black text-magenta">
          {phrase}
        </p>
        <p className="mt-1 text-center text-xs text-mute">{match.topic.note}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded border border-stroke bg-panel-2 py-2 font-mono text-xs text-mute hover:border-magenta hover:text-text"
        >
          关掉 · 继续野
        </button>
      </div>
    </div>
  );
}
