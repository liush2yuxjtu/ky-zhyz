/** Public China URL (Worker proxies to Vercel). Used in watermarks + share links. */
export const SITE_URL = "https://ky-zhyz.inkwellnote.com";
export const SITE_HOST = "ky-zhyz.inkwellnote.com";

const SHARER_ID_LS = "ky-zhyz-sharer-id";
const FROM_SHARE_SS = "ky-zhyz-from-share";
const INVITE_FIRED_SS = "ky-zhyz-invite-land-fired";

export type ShareChannel = "copy" | "native" | "card";

export type InviteLanding = {
  sharer_id: string;
  utm_source: string;
  utm_medium: string;
  landing_path: string;
};

function randomId(len = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(len);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

/** Stable visitor id for outbound share attribution (localStorage). */
export function getOrCreateSharerId(): string {
  try {
    const existing = localStorage.getItem(SHARER_ID_LS);
    if (existing && /^[a-z0-9]{6,16}$/i.test(existing)) return existing;
    const id = randomId(8);
    localStorage.setItem(SHARER_ID_LS, id);
    return id;
  } catch {
    return randomId(8);
  }
}

export function buildShareUrl(channel: ShareChannel, sharerId: string): string {
  const u = new URL(SITE_URL);
  u.searchParams.set("utm_source", "share");
  u.searchParams.set("utm_medium", channel);
  u.searchParams.set("sharer_id", sharerId);
  return u.toString();
}

/** Detect share/UTM landing; returns null when not a share visit. */
export function parseInviteLanding(
  search: string,
  pathname: string,
): InviteLanding | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const utmSource = (params.get("utm_source") || "").trim();
  const sharerId = (params.get("sharer_id") || "").trim();
  const isShare =
    utmSource.toLowerCase() === "share" || Boolean(sharerId);
  if (!isShare) return null;
  return {
    sharer_id: sharerId,
    utm_source: utmSource || "share",
    utm_medium: (params.get("utm_medium") || "").trim(),
    landing_path: pathname || "/",
  };
}

/** Stash share landing for new_generate (sessionStorage). */
export function markFromShare(landing: InviteLanding): void {
  try {
    sessionStorage.setItem(
      FROM_SHARE_SS,
      JSON.stringify({
        sharer_id: landing.sharer_id,
        at: Date.now(),
      }),
    );
  } catch {
    /* ignore */
  }
}

export type FromShareState = { sharer_id: string };

export function readFromShare(): FromShareState | null {
  try {
    const raw = sessionStorage.getItem(FROM_SHARE_SS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sharer_id?: string };
    if (!parsed || typeof parsed.sharer_id !== "string") return null;
    return { sharer_id: parsed.sharer_id };
  } catch {
    return null;
  }
}

/** Fire invite_land at most once per tab session for this landing URL. */
export function shouldFireInviteLand(landingKey: string): boolean {
  try {
    const prev = sessionStorage.getItem(INVITE_FIRED_SS);
    if (prev === landingKey) return false;
    sessionStorage.setItem(INVITE_FIRED_SS, landingKey);
    return true;
  } catch {
    return true;
  }
}

/** Consume from_share so new_generate fires only for the first success. */
export function consumeFromShare(): FromShareState | null {
  const state = readFromShare();
  if (!state) return null;
  try {
    sessionStorage.removeItem(FROM_SHARE_SS);
  } catch {
    /* ignore */
  }
  return state;
}

/**
 * Draw a shareable PNG card: six chars + gloss + brand URL watermark.
 * Returns a Blob (image/png).
 */
export async function renderShareCardPng(opts: {
  display: string;
  gloss: string;
  shareUrl: string;
}): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");

  // Background
  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, W, H);

  // Soft magenta glow
  const g1 = ctx.createRadialGradient(W / 2, 0, 40, W / 2, 180, 700);
  g1.addColorStop(0, "rgba(255,43,214,0.28)");
  g1.addColorStop(1, "rgba(255,43,214,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  // Panel
  const pad = 64;
  ctx.fillStyle = "#0c0c12";
  roundRect(ctx, pad, pad + 40, W - pad * 2, H - pad * 2 - 120, 28);
  ctx.fill();
  ctx.strokeStyle = "#2a2a3a";
  ctx.lineWidth = 4;
  roundRect(ctx, pad, pad + 40, W - pad * 2, H - pad * 2 - 120, 28);
  ctx.stroke();

  // Brand header
  ctx.textAlign = "center";
  ctx.font = "700 36px 'Noto Sans SC', 'PingFang SC', sans-serif";
  ctx.fillStyle = "#ff2bd6";
  ctx.fillText("ky", W / 2 - 70, pad + 120);
  ctx.fillStyle = "#8b8b9e";
  ctx.fillText(",", W / 2 - 18, pad + 120);
  ctx.fillStyle = "#39ff14";
  ctx.fillText("zhyz", W / 2 + 70, pad + 120);

  // Six-char display (strip commas for big glyph row if present)
  const phrase = opts.display.replace(/，/g, "").trim() || opts.display;
  ctx.fillStyle = "#ff2bd6";
  ctx.font = "900 96px 'Noto Sans SC', 'PingFang SC', sans-serif";
  // Fit text
  let size = 96;
  while (size > 48 && ctx.measureText(phrase).width > W - pad * 2 - 80) {
    size -= 4;
    ctx.font = `900 ${size}px 'Noto Sans SC', 'PingFang SC', sans-serif`;
  }
  ctx.fillText(phrase, W / 2, H / 2 - 40);

  // Gloss
  if (opts.gloss) {
    ctx.fillStyle = "#8b8b9e";
    ctx.font = "500 36px 'Noto Sans SC', 'PingFang SC', sans-serif";
    wrapText(ctx, opts.gloss, W / 2, H / 2 + 80, W - pad * 2 - 100, 48, 4);
  }

  // Watermark bar (Nikita: most-screenshotted area has brand+URL)
  ctx.fillStyle = "rgba(18,18,28,0.95)";
  ctx.fillRect(0, H - 140, W, 140);
  ctx.fillStyle = "#39ff14";
  ctx.font = "700 32px 'Noto Sans SC', 'PingFang SC', sans-serif";
  ctx.fillText("ky,zhyz", W / 2, H - 78);
  ctx.fillStyle = "#f2f2f7";
  ctx.font = "500 28px 'IBM Plex Mono', ui-monospace, monospace";
  ctx.fillText(SITE_HOST, W / 2, H - 36);

  // Tiny URL for scanners / long-press
  ctx.fillStyle = "#8b8b9e";
  ctx.font = "400 18px ui-monospace, monospace";
  const shortUrl =
    opts.shareUrl.length > 64 ? SITE_URL : opts.shareUrl;
  ctx.fillText(shortUrl, W / 2, H - 10);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("png failed"));
      },
      "image/png",
      0.92,
    );
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const chars = Array.from(text);
  const lines: string[] = [];
  let line = "";
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && chars.join("").length > lines.join("").length) {
    const last = lines[maxLines - 1] ?? "";
    lines[maxLines - 1] = last.slice(0, Math.max(0, last.length - 1)) + "…";
  }
  lines.forEach((ln, i) => {
    ctx.fillText(ln, x, y + i * lineHeight);
  });
}
