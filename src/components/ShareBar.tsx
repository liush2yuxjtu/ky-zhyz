"use client";

import { useCallback, useMemo, useState } from "react";
import { track } from "@vercel/analytics";
import {
  buildShareCopy,
  buildShareUrl,
  buildWeiboShareUrl,
  getOrCreateSharerId,
  isWeChatUA,
  renderShareCardPng,
  shareCardFilename,
  SITE_HOST,
  type ShareChannel,
} from "@/lib/share";

type Props = {
  display: string;
  gloss: string;
};

export function ShareBar({ display, gloss }: Props) {
  const [busy, setBusy] = useState<ShareChannel | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inWeChat = useMemo(() => isWeChatUA(), []);

  const flash = useCallback((msg: string) => {
    setHint(msg);
    window.setTimeout(() => setHint(null), 3600);
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

  const revokePreview = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  /** 存图发朋友圈 / 小红书：card PNG with moments UTM + QR. */
  const onMomentsCard = useCallback(async () => {
    setBusy("moments");
    revokePreview();
    try {
      const sharerId = fireShareClick("moments");
      const url = buildShareUrl("moments", sharerId);
      const blob = await renderShareCardPng({
        display,
        gloss,
        shareUrl: url,
      });
      const filename = shareCardFilename(display);
      const objectUrl = URL.createObjectURL(blob);

      // WeChat in-app: download attr often blocked → show image for 长按保存
      if (inWeChat) {
        setPreviewUrl(objectUrl);
        flash("长按图片保存 → 发朋友圈 / 发给好友");
        return;
      }

      // Outside WeChat: download, then optional native share with file
      const file = new File([blob], filename, { type: "image/png" });
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
        share?: (data: ShareData) => Promise<void>;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({
            files: [file],
            title: "ky,zhyz",
            text: buildShareCopy({
              display,
              gloss,
              url,
              platform: "moments",
            }),
          });
          flash("已存图 · 也可发小红书");
          URL.revokeObjectURL(objectUrl);
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            flash("已下载分享卡（可发朋友圈/小红书）");
            URL.revokeObjectURL(objectUrl);
            return;
          }
        }
      }

      flash("已下载 · 发朋友圈/小红书时带上图");
      URL.revokeObjectURL(objectUrl);
    } catch {
      flash("出图失败，试试复制微信文案");
    } finally {
      setBusy(null);
    }
  }, [display, gloss, fireShareClick, flash, inWeChat, revokePreview]);

  /** 复制微信口令文案（含归因链接）. */
  const onWechatCopy = useCallback(async () => {
    setBusy("wechat");
    try {
      const sharerId = fireShareClick("wechat");
      const url = buildShareUrl("wechat", sharerId);
      const text = buildShareCopy({
        display,
        gloss,
        url,
        platform: "wechat",
      });
      await navigator.clipboard.writeText(text);
      flash(
        inWeChat
          ? "文案已复制 · 粘贴发给好友"
          : "微信文案已复制 · 粘贴到聊天",
      );
    } catch {
      flash("复制失败，请手动抄链接");
    } finally {
      setBusy(null);
    }
  }, [display, gloss, fireShareClick, flash, inWeChat]);

  /** 微博一键分享 intent. */
  const onWeibo = useCallback(() => {
    setBusy("weibo");
    try {
      const sharerId = fireShareClick("weibo");
      const url = buildShareUrl("weibo", sharerId);
      const title = buildShareCopy({
        display,
        gloss,
        url,
        platform: "weibo",
      });
      const intent = buildWeiboShareUrl({ url, title });
      window.open(intent, "_blank", "noopener,noreferrer");
      flash("已打开微博分享");
    } catch {
      flash("微博打开失败，试试复制链接");
    } finally {
      setBusy(null);
    }
  }, [display, gloss, fireShareClick, flash]);

  const onCopyLink = useCallback(async () => {
    setBusy("copy");
    try {
      const sharerId = fireShareClick("copy");
      const url = buildShareUrl("copy", sharerId);
      await navigator.clipboard.writeText(url);
      flash(`链接已复制 · ${SITE_HOST}`);
    } catch {
      flash("复制失败，请长按地址栏");
    } finally {
      setBusy(null);
    }
  }, [fireShareClick, flash]);

  const onNative = useCallback(async () => {
    setBusy("native");
    try {
      const sharerId = fireShareClick("native");
      const url = buildShareUrl("native", sharerId);
      const text = buildShareCopy({
        display,
        gloss,
        url,
        platform: "native",
      });
      if (navigator.share) {
        await navigator.share({
          title: "ky,zhyz",
          text,
          url,
        });
        flash("已调起系统分享");
      } else {
        await navigator.clipboard.writeText(text);
        flash("已复制文案+链接");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        flash("已取消分享");
      } else {
        flash("分享失败，试试复制微信文案");
      }
    } finally {
      setBusy(null);
    }
  }, [display, gloss, fireShareClick, flash]);

  return (
    <div className="mt-5 border-t border-stroke pt-4">
      <p className="mb-2 text-center text-[12px] font-medium text-mute">
        {inWeChat
          ? "微信内：存图长按保存 · 或复制文案发给好友"
          : "分享到国内平台 · 卡内含水印+二维码"}
      </p>
      <div className="flex flex-wrap items-stretch justify-center gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onMomentsCard()}
          className="inline-flex min-h-11 flex-[1_1_100%] items-center justify-center rounded-md border-2 border-magenta bg-magenta/15 px-3 font-body text-sm font-bold text-magenta transition hover:bg-magenta hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-magenta disabled:opacity-60 sm:flex-none sm:min-w-[10rem]"
        >
          {busy === "moments" ? "出图中…" : "存图发朋友圈"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onWechatCopy()}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-lime/50 bg-lime/10 px-3 font-body text-sm font-bold text-lime transition hover:bg-lime hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-60 sm:flex-none sm:min-w-[8rem]"
        >
          {busy === "wechat" ? "复制中…" : "复制微信文案"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={onWeibo}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-stroke bg-ink px-3 font-body text-sm font-medium text-text transition hover:border-magenta/60 hover:text-magenta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-magenta disabled:opacity-60 sm:flex-none sm:min-w-[7rem]"
        >
          {busy === "weibo" ? "打开中…" : "微博分享"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onCopyLink()}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-stroke bg-ink px-3 font-body text-sm font-medium text-mute transition hover:border-lime/40 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-60 sm:flex-none sm:min-w-[6.5rem]"
        >
          {busy === "copy" ? "复制中…" : "复制链接"}
        </button>
        {!inWeChat && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void onNative()}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-stroke bg-ink px-3 font-body text-sm font-medium text-mute transition hover:border-magenta/40 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-magenta disabled:opacity-60 sm:flex-none sm:min-w-[6.5rem]"
          >
            {busy === "native" ? "分享中…" : "系统分享"}
          </button>
        )}
      </div>
      {hint && (
        <p className="mt-2 text-center text-[12px] text-lime" role="status">
          {hint}
        </p>
      )}
      {previewUrl && (
        <div className="mt-3 rounded-md border border-stroke bg-ink/80 p-3">
          <p className="mb-2 text-center text-[12px] text-mute">
            长按下方图片 → 保存到相册 → 发朋友圈
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="ky,zhyz 分享卡"
            className="mx-auto max-h-[70vh] w-full max-w-sm rounded-md"
          />
          <button
            type="button"
            onClick={revokePreview}
            className="mt-2 w-full min-h-10 rounded-md border border-stroke text-sm text-mute hover:text-text"
          >
            收起预览
          </button>
        </div>
      )}
    </div>
  );
}
