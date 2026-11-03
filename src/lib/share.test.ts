import { describe, expect, it } from "vitest";
import { buildShareUrl, parseInviteLanding, SITE_URL } from "./share";

describe("parseInviteLanding", () => {
  it("detects utm_source=share", () => {
    const landing = parseInviteLanding(
      "?utm_source=share&utm_medium=card&sharer_id=abc12345",
      "/",
    );
    expect(landing).toEqual({
      sharer_id: "abc12345",
      utm_source: "share",
      utm_medium: "card",
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
});

describe("buildShareUrl", () => {
  it("embeds utm + sharer_id on SITE_URL", () => {
    const url = buildShareUrl("copy", "deadbeef");
    expect(url.startsWith(SITE_URL)).toBe(true);
    const u = new URL(url);
    expect(u.searchParams.get("utm_source")).toBe("share");
    expect(u.searchParams.get("utm_medium")).toBe("copy");
    expect(u.searchParams.get("sharer_id")).toBe("deadbeef");
  });
});
