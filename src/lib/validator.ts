import { pinyin } from "pinyin-pro";

/** Target slots for ky,zhyz — 可以这很野种 / 狂野震撼亚洲 */
export const KY_ZHYZ_INITIALS = ["k", "y", "zh", "h", "y", "z"] as const;

export type TargetInitial = (typeof KY_ZHYZ_INITIALS)[number];

export type CharVerdict = {
  char: string;
  index: number;
  expected: TargetInitial;
  /** All distinct Mandarin initials (for UI). */
  initials: string[];
  /** Full pinyin readings (with tone marks) for UI. */
  readings: string[];
  /** Tone-stripped bare syllables used for matching. */
  bares: string[];
  pass: boolean;
  /** Which bare syllable satisfied the slot, if any. */
  matchedBare: string | null;
  /** @deprecated alias of matchedBare for older UI; prefer matchedBare */
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

/** Lowercase letters only (strip tones / punctuation). */
export function bareSyllable(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z]/g, "");
}

/** Normalize a pinyin-pro initial: lowercase, letters only. */
export function normalizeInitial(raw: string): string {
  return bareSyllable(raw);
}

/**
 * Slot match on a tone-stripped syllable (or an initial string).
 *
 * - need `zh` (3rd slot): bare must start with digraph `zh` (zhen/zhe/zhou…)
 * - need single letter incl. `z` (6th): bare must start with that letter
 *   → `zhou` / `zhong` PASS the final z slot (they start with z)
 *
 * Never do `initial === 'z'` after extracting Mandarin initial `zh` —
 * that falsely fails 洲/zhou.
 */
export function syllableMatchesNeed(
  bareOrInitial: string,
  need: TargetInitial,
): boolean {
  const bare = bareSyllable(bareOrInitial);
  if (!bare) return false;
  if (need === "zh") return bare.startsWith("zh");
  return bare.startsWith(need);
}

/** @deprecated use syllableMatchesNeed */
export function initialMatches(
  actual: string,
  expected: TargetInitial,
): boolean {
  return syllableMatchesNeed(actual, expected);
}

/** All pronunciations for one character (多音字), with tone marks. */
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

/** Tone-less bare syllables for every reading. */
export function baresForChar(char: string): string[] {
  const syl = pinyin(char, {
    multiple: true,
    type: "array",
    toneType: "none",
  }) as string[];
  const arr = Array.isArray(syl) ? syl : [String(syl)];
  return [...new Set(arr.map(bareSyllable).filter(Boolean))];
}

/** All initials across every reading (UI only). */
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
    for (const s of baresForChar(char)) {
      const m = s.match(/^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])/);
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
        bares: [],
        pass: false,
        matchedBare: null,
        matchedInitial: null,
      });
      continue;
    }
    const readings = readingsForChar(char);
    const bares = baresForChar(char);
    const initials = initialsForChar(char);

    // Match against bare syllables first (zhou/zhong → z), then initials.
    let matchedBare: string | null = null;
    for (const bare of bares) {
      if (syllableMatchesNeed(bare, expected)) {
        matchedBare = bare;
        break;
      }
    }
    if (!matchedBare) {
      for (const init of initials) {
        if (syllableMatchesNeed(init, expected)) {
          matchedBare = init;
          break;
        }
      }
    }

    slots.push({
      char,
      index: i,
      expected,
      initials,
      readings,
      bares,
      pass: matchedBare !== null,
      matchedBare,
      matchedInitial: matchedBare,
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
