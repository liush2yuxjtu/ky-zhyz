import { describe, expect, it } from "vitest";
import {
  formatDisplay,
  initialsForChar,
  validateKyZhyz,
} from "./validator";

describe("validateKyZhyz", () => {
  it("passes classic 狂野震撼亚洲", () => {
    const r = validateKyZhyz("狂野震撼亚洲");
    expect(r.lengthOk).toBe(true);
    expect(r.pass).toBe(true);
    expect(r.slots.every((s) => s.pass)).toBe(true);
    expect(formatDisplay(r.chars)).toBe("狂野，震撼亚洲");
  });

  it("passes 可以这很野种", () => {
    const r = validateKyZhyz("可以，这很野种");
    expect(r.pass).toBe(true);
    expect(formatDisplay(r.chars)).toBe("可以，这很野种");
  });

  it("fails a wrong phrase", () => {
    const r = validateKyZhyz("今天天气真好");
    expect(r.lengthOk).toBe(true);
    expect(r.pass).toBe(false);
    expect(r.slots.some((s) => !s.pass)).toBe(true);
  });

  it("fails wrong length", () => {
    const r = validateKyZhyz("狂野");
    expect(r.lengthOk).toBe(false);
    expect(r.pass).toBe(false);
  });

  it("多音字: 长 can supply zh for slot 2", () => {
    // 可 + 以 + 长(zhǎng) + 很 + 野 + 种
    const initials = initialsForChar("长");
    expect(initials).toContain("zh");
    expect(initials).toContain("ch");
    const r = validateKyZhyz("可以长很野种");
    expect(r.slots[2].char).toBe("长");
    expect(r.slots[2].pass).toBe(true);
    expect(r.pass).toBe(true);
  });
});
