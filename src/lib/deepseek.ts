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

function buildUser(scene: string, repair?: string): string {
  if (!repair) {
    return `场景：${scene}\n一次性输出合格 JSON。先按六格选字（优先口播表+合法锚点），默念 k-y-zh-h-y-z，再交卷。不会重试。`;
  }
  return `场景：${scene}\n上一版有格子首字母不合 ky,zhyz，已交回生成器：${repair}\n请输出新的 6 字 JSON，务必凑齐 k/y/zh/h/y/z。`;
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
  repair?: string,
): Promise<{ phrase: string; gloss: string; raw: string }> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.85,
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildUser(scene, repair) },
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
      return `第${s.index + 1}格「${s.char}」首字母不合 ky,zhyz：读音[${got}]，要求以[${s.expected}]开头（z 格：zhou/zhong 算过）`;
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
): Promise<GenerateResult> {
  let repair: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onProgress?.({ attempt, maxAttempts: MAX_ATTEMPTS });
    const { phrase, gloss } = await callDeepSeek(apiKey, scene, repair);
    const validation = validateKyZhyz(phrase);

    if (validation.pass) {
      return {
        ok: true,
        phrase: validation.chars.join(""),
        display: formatDisplay(validation.chars),
        gloss: gloss || "（无释义）",
        validation,
        attempts: attempt,
      };
    }

    if (attempt >= MAX_ATTEMPTS) break;

    repair = describeFail(validation);
    if (extractHanChars(phrase).length !== 6) {
      repair += "。必须恰好六个汉字。";
    }
  }

  return {
    ok: false,
    error: EXHAUSTED_ERROR,
    attempts: MAX_ATTEMPTS,
  };
}
