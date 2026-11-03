"use client";

import { useCallback, useState } from "react";
import { track } from "@vercel/analytics";
import {
  buildShareUrl,
  getOrCreateSharerId,
  renderShareCardPng,
  type ShareChannel,
} from "@/lib/share";

type Props = {
  display: string;
  gloss: string;
};

export function ShareBar({ display, gloss }: Props) {
  const [busy, setBusy] = useState<ShareChannel | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setHint(msg);
    window.setTimeout(() => setHint(null), 2800);
  }, []);

  const fireShareClick = useCallback((channel: ShareChannel) => {
    const sharerId = getOrCreateSharerId();
    track("share_click", {
      channel,
      has_watermark: true,
      sharer_id: sharerId,
    });
    return sharerId;
  }, []);

  const onCopyLink = useCallback(async () => {
    setBusy("copy");
    try {
      const sharerId = fireShareClick("copy");
      const url = buildShareUrl("copy", sharerId);
      await navigator.clipboard.writeText(url);
      flash("链接已复制（含水印站址）");
    } catch {
      flash("复制失败，请长按地址栏");
    } finally {
      setBusy(null);
    }
  }, [fireShareClick, flash]);

  const onCard = useCallback(async () => {
    setBusy("card");
    try {
      const sharerId = fireShareClick("card");
      const url = buildShareUrl("card", sharerId);
      const blob = await renderShareCardPng({
        display,
        gloss,
        shareUrl: url,
      });
      const file = new File([blob], "ky-zhyz-share.png", {
        type: "image/png",
      });

      // Prefer native share with the card file when available.
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
        share?: (data: ShareData) => Promise<void>;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "ky,zhyz",
          text: `${display}${gloss ? ` — ${gloss}` : ""}\n${url}`,
          url,
        });
        flash("分享卡已送出");
        return;
      }

      // Fallback: download PNG
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "ky-zhyz-share.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      flash("分享卡已下载（含水印+URL）");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        flash("已取消分享");
      } else {
        flash("分享卡生成失败，试试复制链接");
      }
    } finally {
      setBusy(null);
    }
  }, [display, gloss, fireShareClick, flash]);

  const onNative = useCallback(async () => {
    setBusy("native");
    try {
      const sharerId = fireShareClick("native");
      const url = buildShareUrl("native", sharerId);
      const text = `${display}${gloss ? `\n${gloss}` : ""}\n${url}`;
      if (navigator.share) {
        await navigator.share({
          title: "ky,zhyz",
          text,
          url,
        });
        flash("已调起系统分享");
      } else {
        await navigator.clipboard.writeText(text);
        flash("已复制文案+链接（本机无系统分享）");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        flash("已取消分享");
      } else {
        flash("分享失败，试试复制链接");
      }
    } finally {
      setBusy(null);
    }
  }, [display, gloss, fireShareClick, flash]);

  return (
    <div className="mt-5 border-t border-stroke pt-4">
      <p className="mb-2 text-center text-[12px] font-medium text-mute">
        一键分享 · 卡内含水印 URL
      </p>
      <div className="flex flex-wrap items-stretch justify-center gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onCard()}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border-2 border-magenta bg-magenta/15 px-3 font-body text-sm font-bold text-magenta transition hover:bg-magenta hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-magenta disabled:opacity-60 sm:flex-none sm:min-w-[8.5rem]"
        >
          {busy === "card" ? "出卡中…" : "生成分享卡"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onCopyLink()}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-lime/50 bg-lime/10 px-3 font-body text-sm font-bold text-lime transition hover:bg-lime hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-60 sm:flex-none sm:min-w-[7rem]"
        >
          {busy === "copy" ? "复制中…" : "复制链接"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onNative()}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-stroke bg-ink px-3 font-body text-sm font-medium text-mute transition hover:border-magenta/60 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-magenta disabled:opacity-60 sm:flex-none sm:min-w-[7rem]"
        >
          {busy === "native" ? "分享中…" : "系统分享"}
        </button>
      </div>
      {hint && (
        <p className="mt-2 text-center text-[12px] text-lime" role="status">
          {hint}
        </p>
      )}
    </div>
  );
}
