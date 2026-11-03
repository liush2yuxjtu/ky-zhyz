import {
  extractHanChars,
  formatDisplay,
  validateKyZhyz,
  type ValidationResult,
} from "./validator";
import { SYSTEM_PROMPT } from "./system-prompt";

const API_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

/** Production default: one-shot. Override with KY_ZHYZ_MAX_ATTEMPTS for local experiments. */
export const MAX_ATTEMPTS = Math.max(
  1,
  Number.parseInt(process.env.KY_ZHYZ_MAX_ATTEMPTS ?? "1", 10) || 1,
);

export type GenerateOk = {
  ok: true;
  phrase: string;
  display: string;
  gloss: string;
  /** Always a full PASS validation — never partial/fail slots. */
  validation: ValidationResult;
  attempts: number;
};

/**
 * Exhausted retries. No failing phrase/slots — client must not render those.
 */
export type GenerateFail = {
  ok: false;
  error: string;
  attempts: number;
};

export type GenerateResult = GenerateOk | GenerateFail;

export type AttemptProgress = {
  attempt: number;
  maxAttempts: number;
};

type ModelJson = { phrase?: string; gloss?: string };


/** Exported for developer hillclimb / evals — edit src/lib/system-prompt.txt (+ sync .ts), then `npm run eval:iteration`. */
export const SYSTEM = SYSTEM_PROMPT;

/** Cap client avoid list — han-only phrases, max 8. */
export function sanitizeAvoid(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const chars = extractHanChars(item);
    if (chars.length !== 6) continue;
    const phrase = chars.join("");
    if (seen.has(phrase)) continue;
    seen.add(phrase);
    out.push(phrase);
    if (out.length >= 8) break;
  }
  return out;
}

function sameSlotOverlap(a: string, b: string): number {
  const ca = extractHanChars(a);
  const cb = extractHanChars(b);
  if (ca.length !== 6 || cb.length !== 6) return 0;
  let n = 0;
  for (let i = 0; i < 6; i++) if (ca[i] === cb[i]) n++;
  return n;
}

function diversityHint(scene: string, avoid: string[]): string {
  // Per-call entropy so identical scenes diverge across clicks
  const salt =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? (crypto.getRandomValues(new Uint32Array(1))[0]! % 900) + 100
      : Math.floor(Math.random() * 900 + 100);
  const styles = [
    "偏嘴炮短促",
    "偏自嘲苦笑",
    "偏暴躁吐槽",
    "偏阴阳怪气",
    "偏贴吧回帖口吻",
    "偏抽象发疯",
  ];
  const pivots = [
    "必须换掉第1–2格锚点字",
    "必须换掉第4格动词/形容词",
    "必须换掉第5–6格收束",
    "禁用「这…又… / X友…栽」万能骨架",
    "换一条全新口播路径，勿微调旧句",
  ];
  const style = styles[salt % styles.length];
  const pivot = pivots[salt % pivots.length];
  let avoidLine = "";
  if (avoid.length) {
    avoidLine = `\n避用整句（本会话已出过）：${avoid.map((p) => `「${p}」`).join("、")}。禁止原样复用；与任一避用句同位置重叠不得超过 2 字。`;
  }
  return `本次口味：${style}（盐${salt}；${pivot}）。禁止复用「X这狠要砸 / 空言这哄 / 这火一栽 / 坑友这黑又栽」空骨架；换锚点字与动词。${avoidLine}`;
}

function buildUser(scene: string, avoid: string[], repair?: string): string {
  if (!repair) {
    return `场景：${scene}\n${diversityHint(scene, avoid)}\n一次性输出合格 JSON。先按六格选字（优先口播表+合法锚点），默念 k-y-(z|zh)-h-y-z，再交卷。不会重试。`;
  }
  return `场景：${scene}\n${diversityHint(scene, avoid)}\n上一版不可用，已交回生成器：${repair}\n请输出新的 6 字 JSON，务必凑齐 k/y/(z|zh)/h/y/z，且勿撞避用句。`;
}

function parseModelContent(content: string): ModelJson {
  const trimmed = content.trim();
  const fence = trimmed.match(/\{[\s\S]*\}/);
  const raw = fence ? fence[0] : trimmed;
  try {
    return JSON.parse(raw) as ModelJson;
  } catch {
    return {};
  }
}

async function callDeepSeek(
  apiKey: string,
  scene: string,
  avoid: string[],
  repair?: string,
): Promise<{ phrase: string; gloss: string; raw: string }> {
  const seed =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? crypto.getRandomValues(new Uint32Array(1))[0]! >>> 0
      : Math.floor(Math.random() * 1_000_000_000);
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 1.15,
      top_p: 0.92,
      presence_penalty: 0.65,
      frequency_penalty: 0.45,
      seed,
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildUser(scene, avoid, repair) },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DeepSeek HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseModelContent(raw);
  const phrase = String(parsed.phrase ?? "").trim();
  const gloss = String(parsed.gloss ?? "").trim();
  return { phrase, gloss, raw };
}

/** Internal only — fed back to the model on multi-attempt experiments, never shown as the answer. */
export function describeFail(v: ValidationResult): string {
  if (!v.lengthOk) {
    return `汉字数=${v.chars.length}（需要恰好6），得到「${v.chars.join("")}」。请重写。`;
  }
  const bad = v.slots
    .filter((s) => !s.pass)
    .map((s) => {
      const got =
        (s.bares && s.bares.length ? s.bares.join("/") : s.initials.join("/")) ||
        "无读音";
      return `第${s.index + 1}格「${s.char}」首字母不合 ky,zhyz：读音[${got}]，要求以[${s.expected}]开头（第3格 z/zh 均可；末格 zhou/zhong 算过）`;
    });
  return (
    "以下格子首字母不合 ky,zhyz，请交回生成器重写整句（不要解释，只出新 JSON）：" +
    bad.join("；")
  );
}

export const EXHAUSTED_ERROR =
  "这波没凑齐 ky,zhyz，点一下再试一次就好。";

/**
 * One-shot by default (MAX_ATTEMPTS=1): single call → validate → PASS or friendly fail.
 * Failures never return phrase/slots to the client.
 * Multi-attempt + repair only when KY_ZHYZ_MAX_ATTEMPTS>1 (local experiments).
 */
export async function generateKyZhyz(
  scene: string,
  apiKey: string,
  onProgress?: (e: AttemptProgress) => void,
  avoidInput: string[] = [],
): Promise<GenerateResult> {
  const avoid = sanitizeAvoid(avoidInput);
  let repair: string | undefined;
  let attemptsUsed = 0;
  /** Up to 2 extra draws when PASS collides with avoid — not a ky,zhyz validation retry. */
  const maxDraws = MAX_ATTEMPTS + (avoid.length > 0 ? 2 : 0);

  for (let draw = 1; draw <= maxDraws; draw++) {
    attemptsUsed = draw;
    onProgress?.({ attempt: draw, maxAttempts: MAX_ATTEMPTS });
    const { phrase, gloss } = await callDeepSeek(apiKey, scene, avoid, repair);
    const validation = validateKyZhyz(phrase);

    if (validation.pass) {
      const clean = validation.chars.join("");
      const exact = avoid.includes(clean);
      const overlapped = avoid.some((a) => sameSlotOverlap(a, clean) >= 3);
      if ((exact || overlapped) && draw < maxDraws) {
        repair = `上一版「${clean}」与避用句撞车（原样或同位置重叠≥3）。必须整句换掉，换锚点与动词，同位置重叠≤2；禁止再出「${clean}」。`;
        continue;
      }
      // Never return an exact repeat of avoid, even on last draw.
      if (exact) {
        break;
      }
      return {
        ok: true,
        phrase: clean,
        display: formatDisplay(validation.chars),
        gloss: gloss || "（无释义）",
        validation,
        attempts: attemptsUsed,
      };
    }

    // Validation fail: only repair within MAX_ATTEMPTS (experiment mode).
    if (draw >= MAX_ATTEMPTS) {
      break;
    }
    repair = describeFail(validation);
    if (extractHanChars(phrase).length !== 6) {
      repair += "。必须恰好六个汉字。";
    }
  }

  return {
    ok: false,
    error: EXHAUSTED_ERROR,
    attempts: attemptsUsed || MAX_ATTEMPTS,
  };
}
