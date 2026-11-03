"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  phrase: string;
  title: string;
  memeSrc: string;
  note?: string;
};

export function MemePop({ open, onClose, phrase, title, memeSrc, note }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(onClose, 3200);
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, phrase, title, memeSrc]);

  if (!open || !memeSrc) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="梗图"
      onClick={onClose}
    >
      <div
        className="meme-burst relative w-full max-w-sm rounded-lg border-2 border-magenta bg-panel p-3 shadow-[0_8px_28px_rgba(255,43,214,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <p className="mb-2 text-center text-[12px] text-mute">
            {title}
          </p>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={memeSrc}
          alt={title || phrase}
          className="mx-auto max-h-56 w-auto rounded object-contain"
        />
        <p className="mt-3 text-center font-body text-xl font-black text-magenta">
          {phrase}
        </p>
        {note ? (
          <p className="mt-1 text-center text-xs text-mute">{note}</p>
        ) : null}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-3 min-h-11 w-full rounded border border-stroke bg-panel-2 py-2 font-mono text-xs text-mute hover:border-magenta hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-magenta"
        >
          关掉 · 继续野
        </button>
      </div>
    </div>
  );
}
