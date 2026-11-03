import { describe, expect, it } from "vitest";
import {
  EXHAUSTED_ERROR,
  MAX_ATTEMPTS,
  describeFail,
  extractJsonObject,
  sanitizeAvoid,
  sanitizeLocks,
  locksSatisfied,
  type GenerateFail,
  type GenerateOk,
} from "./deepseek";
import { validateKyZhyz } from "./validator";

describe("generate contract (PASS-only to client)", () => {
  it("production MAX_ATTEMPTS defaults to one-shot", () => {
    expect(MAX_ATTEMPTS).toBe(1);
  });

  it("describeFail lists bad slots for model feedback only", () => {
    const v = validateKyZhyz("今天天气真好");
    expect(v.pass).toBe(false);
    const msg = describeFail(v);
    expect(msg).toContain("首字母不合 ky,zhyz");
    expect(msg).toContain("交回生成器");
  });

  it("PASS result always has validation.pass true", () => {
    const v = validateKyZhyz("狂野震撼亚洲");
    const ok: GenerateOk = {
      ok: true,
      phrase: v.chars.join(""),
      display: "狂野，震撼亚洲",
      gloss: "demo",
      validation: v,
      attempts: 1,
    };
    expect(ok.validation.pass).toBe(true);
    expect(ok.validation.slots.every((s) => s.pass)).toBe(true);
    expect(ok.attempts).toBe(1);
  });

  it("FAIL result exposes only friendly error + attempts (no slots)", () => {
    const fail: GenerateFail = {
      ok: false,
      error: EXHAUSTED_ERROR,
      attempts: 1,
    };
    expect(fail.ok).toBe(false);
    expect(fail.error).toBe(EXHAUSTED_ERROR);
    expect(fail.attempts).toBe(1);
    expect(fail).not.toHaveProperty("validation");
    expect(fail).not.toHaveProperty("lastPhrase");
    expect(fail).not.toHaveProperty("display");
  });
});

describe("sanitizeAvoid", () => {
  it("keeps only exact 6-han phrases, deduped, max 8", () => {
    expect(
      sanitizeAvoid([
        "坑友这黑又栽",
        "坑友这黑又栽",
        "abc",
        "七个汉字啊太多了",
        "狂野震撼亚洲",
        123,
        null,
      ]),
    ).toEqual(["坑友这黑又栽", "狂野震撼亚洲"]);
  });
});

describe("sanitizeLocks", () => {
  it("keeps fitting slot chars and rejects all-six lock", () => {
    const locks = sanitizeLocks({ 0: "苦", 1: "饮" });
    expect(locks[0]).toBe("苦");
    expect(locks[1]).toBe("饮");
    expect(locks[2]).toBeNull();
    expect(locksSatisfied(["苦", "饮", "这", "盒", "冤", "卒"], locks)).toBe(
      true,
    );
    expect(locksSatisfied(["坑", "饮", "这", "盒", "冤", "卒"], locks)).toBe(
      false,
    );
  });

  it("drops chars that miss the slot initial", () => {
    const locks = sanitizeLocks({ 0: "奶" }); // nai — not k
    expect(locks[0]).toBeNull();
  });
});

describe("extractJsonObject", () => {
  it("parses bare JSON", () => {
    expect(
      extractJsonObject(
        '{"phrase":"坑饮这喝冤种","gloss":"奶茶加错糖"}',
      ),
    ).toEqual({ phrase: "坑饮这喝冤种", gloss: "奶茶加错糖" });
  });

  it("extracts JSON after soft CoT and prefers phrase object", () => {
    const raw = `主事件是网恋被骗。
声母自检：k-y-zh-h-y-z。
{"noise":true}
最终：{"check":"k-y-zh-h-y-z","phrase":"哭冤装哄又栽","gloss":"网恋被骗装甜哄又栽"}`;
    expect(extractJsonObject(raw)).toMatchObject({
      phrase: "哭冤装哄又栽",
      gloss: "网恋被骗装甜哄又栽",
    });
  });

  it("reads fenced json blocks", () => {
    const raw =
      'think...\n```json\n{"phrase":"空又涨狠要砸","gloss":"房租又涨"}\n```';
    expect(extractJsonObject(raw)).toEqual({
      phrase: "空又涨狠要砸",
      gloss: "房租又涨",
    });
  });

  it("returns empty on garbage", () => {
    expect(extractJsonObject("no json here")).toEqual({});
  });
});
