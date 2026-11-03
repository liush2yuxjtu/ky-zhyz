import { describe, expect, it } from "vitest";
import {
  buildShareCopy,
  buildShareUrl,
  buildWeiboShareUrl,
  isWeChatUA,
  parseInviteLanding,
  shareCardFilename,
  SITE_HOST,
  SITE_URL,
} from "./share";

describe("parseInviteLanding", () => {
  it("detects utm_source=share", () => {
    const landing = parseInviteLanding(
      "?utm_source=share&utm_medium=moments&sharer_id=abc12345",
      "/",
    );
    expect(landing).toEqual({
      sharer_id: "abc12345",
      utm_source: "share",
      utm_medium: "moments",
      landing_path: "/",
    });
  });

  it("detects sharer_id alone", () => {
    const landing = parseInviteLanding("?sharer_id=xyz99999", "/");
    expect(landing?.sharer_id).toBe("xyz99999");
    expect(landing?.utm_source).toBe("share");
  });

  it("ignores normal landings", () => {
    expect(parseInviteLanding("", "/")).toBeNull();
    expect(parseInviteLanding("?utm_source=twitter", "/")).toBeNull();
  });

  it("accepts china platform mediums", () => {
    for (const medium of ["wechat", "moments", "weibo", "xhs"] as const) {
      const landing = parseInviteLanding(
        `?utm_source=share&utm_medium=${medium}&sharer_id=deadbeef`,
        "/",
      );
      expect(landing?.utm_medium).toBe(medium);
    }
  });
});

describe("buildShareUrl", () => {
  it("embeds utm + sharer_id on China SITE_URL", () => {
    const url = buildShareUrl("wechat", "deadbeef");
    expect(url.startsWith(SITE_URL)).toBe(true);
    expect(url.includes("vercel.app")).toBe(false);
    const u = new URL(url);
    expect(u.searchParams.get("utm_source")).toBe("share");
    expect(u.searchParams.get("utm_medium")).toBe("wechat");
    expect(u.searchParams.get("sharer_id")).toBe("deadbeef");
  });

  it("supports moments / weibo / xhs mediums", () => {
    expect(new URL(buildShareUrl("moments", "a1b2c3d4")).searchParams.get("utm_medium")).toBe(
      "moments",
    );
    expect(new URL(buildShareUrl("weibo", "a1b2c3d4")).searchParams.get("utm_medium")).toBe(
      "weibo",
    );
    expect(new URL(buildShareUrl("xhs", "a1b2c3d4")).searchParams.get("utm_medium")).toBe(
      "xhs",
    );
  });
});

describe("buildShareCopy", () => {
  const base = {
    display: "垮又再会",
    gloss: "场面已经写完了",
    url: `${SITE_URL}/?utm_source=share&utm_medium=wechat&sharer_id=deadbeef`,
  };

  it("wechat copy includes phrase, gloss, CTA, and SITE_HOST url", () => {
    const text = buildShareCopy({ ...base, platform: "wechat" });
    expect(text).toContain("「垮又再会」");
    expect(text).toContain("场面已经写完了");
    expect(text).toContain("ky,zhyz");
    expect(text).toContain(SITE_HOST);
    expect(text).toContain("sharer_id=deadbeef");
  });

  it("weibo title is shorter and has no raw multiline url dump", () => {
    const text = buildShareCopy({ ...base, platform: "weibo" });
    expect(text).toContain("垮又再会");
    expect(text.length).toBeLessThan(80);
    expect(text.includes("\n")).toBe(false);
  });

  it("moments caption points at SITE_HOST", () => {
    const text = buildShareCopy({ ...base, platform: "moments" });
    expect(text).toContain(SITE_HOST);
    expect(text).toContain("垮又再会");
  });
});

describe("buildWeiboShareUrl", () => {
  it("builds encoded weibo intent", () => {
    const url = buildShareUrl("weibo", "deadbeef");
    const title = buildShareCopy({
      display: "垮又再会",
      gloss: "短注",
      url,
      platform: "weibo",
    });
    const intent = buildWeiboShareUrl({ url, title });
    expect(intent.startsWith("https://service.weibo.com/share/share.php")).toBe(
      true,
    );
    const u = new URL(intent);
    expect(u.searchParams.get("url")).toBe(url);
    expect(u.searchParams.get("title")).toBe(title);
  });
});

describe("isWeChatUA", () => {
  it("detects MicroMessenger", () => {
    expect(isWeChatUA("Mozilla/5.0 MicroMessenger/8.0.0")).toBe(true);
    expect(isWeChatUA("Mozilla/5.0 (iPhone) Safari/604.1")).toBe(false);
  });
});

describe("shareCardFilename", () => {
  it("sanitizes display into ky-zhyz-*.png", () => {
    expect(shareCardFilename("垮，又，再，会")).toBe("ky-zhyz-垮又再会.png");
    expect(shareCardFilename("a/b\\c")).toMatch(/^ky-zhyz-.+\.png$/);
  });
});
