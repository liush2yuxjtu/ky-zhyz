import {
  extractHanChars,
  formatDisplay,
  validateKyZhyz,
  type ValidationResult,
} from "./validator";

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

/** Exported for developer hillclimb / evals — edit here, then `npm run eval:quality`. */
export const SYSTEM = `你是「ky,zhyz」造句机。用户丢一个场景，你必须【一次】给出恰好 6 个汉字。

【最高优先级：声母】从左到右必须是：
1 k · 2 y · 3 zh · 4 h · 5 y · 6 z
第3字只能是「这/震/詹/长(zhǎng)/涨/仗/着…」等 zh 声母字；第6字必须是 z 声母（在/哉/咋/揍/作/种zhong/洲zhou 皆可）。
输出前请逐格默念声母；有一格不对就整句重写，不要凑合。

【第二优先级：主题唯一性】六字要让人一眼认出【这个】场景。把场景核心实体/动作写进 phrase（或强可回指）。换一个无关场景后，这六字应对不上号。
【网感】贴吧/抽象/口头禅，像真人嘴炮，不是说明书/新闻标题。
【禁万能壳】禁止「可以这很野种」「可以这很X种」空壳，除非「野种」真是该场景核心梗。「狂野震撼亚洲」也仅当场景真偏狂野/震撼时可用。

只输出 JSON：{"phrase":"六个汉字","gloss":"一句话说明怎么扣题"}。不要 markdown。

合格短例（声母已过，学结构勿照抄）：
- 场景「排队买奶茶加错糖」→ {"phrase":"客爷这喝冤哉","gloss":"顾客对店员这单糖加错的窝火"}
- 场景「詹皇甩锅」→ {"phrase":"靠腰詹皇佯作","gloss":"靠腰吐槽詹皇甩锅还假装没事"}
- 场景「周一被老板画饼」→ {"phrase":"空言这哄员工","gloss":"老板空言画饼哄员工"}

坏例（禁止）：
- 任意场景都回「可以这很野种」
- 为了扣题牺牲声母（如「空口画饼真绝」第2格kou≠y）
- 场景是奶茶，却写成球星黑话且与奶茶无关`;

function buildUser(scene: string, repair?: string): string {
  if (!repair) {
    return `场景：${scene}\n请一次性输出合格 JSON（one-shot，不会给你第二次机会）。`;
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
      temperature: 0.9,
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
