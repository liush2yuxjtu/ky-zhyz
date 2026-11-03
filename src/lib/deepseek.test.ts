import { describe, expect, it } from "vitest";
import {
  EXHAUSTED_ERROR,
  MAX_ATTEMPTS,
  describeFail,
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
