import { pinyin } from "pinyin-pro";

/** Target initials for ky,zhyz — 可以这很野种 / 狂野震撼亚洲 */
export const KY_ZHYZ_INITIALS = ["k", "y", "zh", "h", "y", "z"] as const;

export type TargetInitial = (typeof KY_ZHYZ_INITIALS)[number];

export type CharVerdict = {
  char: string;
  index: number;
  expected: TargetInitial;
  /** All distinct initials from every reading (tone-stripped, lowercased). */
  initials: string[];
  /** Full pinyin readings (with tone marks) for UI. */
  readings: string[];
  pass: boolean;
  matchedInitial: string | null;
};

export type ValidationResult = {
  phrase: string;
  chars: string[];
  lengthOk: boolean;
  slots: CharVerdict[];
  pass: boolean;
};

const HAN_RE = /[\u3400-\u9fff\uf900-\ufaff]/g;

/** Pull exactly the Han characters; ignore punctuation/spaces/Latin. */
export function extractHanChars(text: string): string[] {
  return text.match(HAN_RE) ?? [];
}

/** Normalize a pinyin-pro initial: lowercase, letters only. */
export function normalizeInitial(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Slot match rule:
 * - expected digraph (zh): initial must equal zh
 * - expected single letter (k/y/h/z): first letter of initial must match
 *   so 种/洲 (zh) still pass the final "z" slot (meme convention)
 */
export function initialMatches(
  actual: string,
  expected: TargetInitial,
): boolean {
  const a = normalizeInitial(actual);
  if (!a) return false;
  if (expected.length > 1) return a === expected;
  return a.charAt(0) === expected;
}

/** All pronunciations for one character (多音字). */
export function readingsForChar(char: string): string[] {
  const multi = pinyin(char, {
    multiple: true,
    type: "array",
    toneType: "symbol",
  }) as string[];
  const list = Array.isArray(multi) ? multi : [String(multi)];
  const uniq = [...new Set(list.map((s) => s.trim()).filter(Boolean))];
  return uniq.length ? uniq : [pinyin(char, { toneType: "symbol" })];
}

/** All initials across every reading. */
export function initialsForChar(char: string): string[] {
  const direct = pinyin(char, {
    pattern: "initial",
    multiple: true,
    type: "array",
    toneType: "none",
  }) as string[];
  const raw = Array.isArray(direct) ? direct : [String(direct)];
  const normalized = [
    ...new Set(raw.map(normalizeInitial).filter(Boolean)),
  ];

  if (!normalized.length) {
    const syl = pinyin(char, {
      multiple: true,
      type: "array",
      toneType: "none",
    }) as string[];
    const arr = Array.isArray(syl) ? syl : [String(syl)];
    for (const s of arr) {
      const m = s
        .toLowerCase()
        .match(/^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])/);
      if (m) normalized.push(m[1]);
    }
  }
  return [...new Set(normalized)];
}

export function validateKyZhyz(phrase: string): ValidationResult {
  const chars = extractHanChars(phrase);
  const lengthOk = chars.length === 6;
  const slots: CharVerdict[] = [];

  for (let i = 0; i < 6; i++) {
    const expected = KY_ZHYZ_INITIALS[i];
    const char = chars[i] ?? "";
    if (!char) {
      slots.push({
        char: "",
        index: i,
        expected,
        initials: [],
        readings: [],
        pass: false,
        matchedInitial: null,
      });
      continue;
    }
    const readings = readingsForChar(char);
    const initials = initialsForChar(char);
    let matchedInitial: string | null = null;
    for (const init of initials) {
      if (initialMatches(init, expected)) {
        matchedInitial = normalizeInitial(init);
        break;
      }
    }
    slots.push({
      char,
      index: i,
      expected,
      initials,
      readings,
      pass: matchedInitial !== null,
      matchedInitial,
    });
  }

  const pass = lengthOk && slots.every((s) => s.pass);
  return { phrase, chars, lengthOk, slots, pass };
}

/** Format display: XX，XXXX */
export function formatDisplay(chars: string[]): string {
  if (chars.length < 6) return chars.join("");
  return `${chars[0]}${chars[1]}，${chars[2]}${chars[3]}${chars[4]}${chars[5]}`;
}
