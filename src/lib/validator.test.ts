import { describe, expect, it } from "vitest";
import {
  baresForChar,
  formatDisplay,
  initialsForChar,
  syllableMatchesNeed,
  validateKyZhyz,
} from "./validator";

describe("syllableMatchesNeed", () => {
  it("3rd slot (need zh): z OR zh both PASS", () => {
    expect(syllableMatchesNeed("zhen", "zh")).toBe(true);
    expect(syllableMatchesNeed("zhe", "zh")).toBe(true);
    expect(syllableMatchesNeed("zhou", "zh")).toBe(true);
    expect(syllableMatchesNeed("za", "zh")).toBe(true);
    expect(syllableMatchesNeed("zai", "zh")).toBe(true);
    expect(syllableMatchesNeed("zui", "zh")).toBe(true);
    expect(syllableMatchesNeed("z", "zh")).toBe(true);
    expect(syllableMatchesNeed("chi", "zh")).toBe(false);
    expect(syllableMatchesNeed("shi", "zh")).toBe(false);
  });

  it("z slot: zhou/zhong PASS (start with z); never require initial===z", () => {
    expect(syllableMatchesNeed("zhou", "z")).toBe(true);
    expect(syllableMatchesNeed("zhong", "z")).toBe(true);
    expect(syllableMatchesNeed("zai", "z")).toBe(true);
    // Mandarin initial string "zh" must still pass z via startsWith('z')
    expect(syllableMatchesNeed("zh", "z")).toBe(true);
    expect(syllableMatchesNeed("chi", "z")).toBe(false);
  });
});

describe("validateKyZhyz", () => {
  it("passes classic 狂野震撼亚洲 including 洲/zhou on final z", () => {
    expect(baresForChar("洲")).toContain("zhou");
    const r = validateKyZhyz("狂野震撼亚洲");
    expect(r.lengthOk).toBe(true);
    expect(r.slots[5].char).toBe("洲");
    expect(r.slots[5].expected).toBe("z");
    expect(r.slots[5].pass).toBe(true);
    expect(r.pass).toBe(true);
    expect(r.slots.every((s) => s.pass)).toBe(true);
    expect(formatDisplay(r.chars)).toBe("狂野，震撼亚洲");
  });

  it("passes 可以这很野种 (种/zhong on final z)", () => {
    expect(baresForChar("种").some((b) => b.startsWith("z"))).toBe(true);
    const r = validateKyZhyz("可以，这很野种");
    expect(r.slots[5].pass).toBe(true);
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
    const initials = initialsForChar("长");
    expect(initials).toContain("zh");
    expect(initials).toContain("ch");
    const r = validateKyZhyz("可以长很野种");
    expect(r.slots[2].char).toBe("长");
    expect(r.slots[2].pass).toBe(true);
    expect(r.pass).toBe(true);
  });

  it("zai/zui satisfy 3rd slot (z counts as zh brand)", () => {
    expect(syllableMatchesNeed("zai", "zh")).toBe(true);
    const r = validateKyZhyz("可以在很野种");
    expect(r.slots[2].char).toBe("在");
    expect(r.slots[2].pass).toBe(true);
    expect(r.pass).toBe(true);
  });

  it("passes community 砍勇最会游走 (最=zui on slot 3)", () => {
    const r = validateKyZhyz("砍勇最会游走");
    expect(r.slots[2].char).toBe("最");
    expect(r.slots[2].pass).toBe(true);
    expect(r.pass).toBe(true);
  });
});
