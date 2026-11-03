import {
  extractHanChars,
  formatDisplay,
  validateKyZhyz,
  type ValidationResult,
} from "./validator";

const API_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const MAX_ATTEMPTS = 5;

export type GenerateOk = {
  ok: true;
  phrase: string;
  display: string;
  gloss: string;
  validation: ValidationResult;
  attempts: number;
};

export type GenerateFail = {
  ok: false;
  error: string;
  lastPhrase?: string;
  lastGloss?: string;
  validation?: ValidationResult;
  attempts: number;
};

export type GenerateResult = GenerateOk | GenerateFail;

type ModelJson = { phrase?: string; gloss?: string };

const SYSTEM = `你是「ky,zhyz」造句机。用户会描述一个场景/情绪/吐槽，你必须把它翻译成恰好 6 个汉字，拼音声母严格对应：
第1字 k · 第2字 y · 第3字 zh · 第4字 h · 第5字 y · 第6字 z
（经典模板：可以这很野种 / 狂野震撼亚洲）

规则：
1. 只输出一个 JSON 对象，不要 markdown，不要解释，不要思考过程。
2. 格式：{"phrase":"六个汉字","gloss":"一句话说明这六字怎么扣题"}
3. phrase 必须恰好 6 个汉字，可含顿号/逗号但汉字必须正好 6 个。
4. 第3字声母必须是 zh（这/震/长zhǎng…）；第6字声母可为 z 或 zh（种/洲/在…皆可，亚文化惯例）。
5. 尽量搞笑、抽象、贴吧味；扣住用户场景。
6. 若收到「交回生成器」反馈，说明上一版某些字的拼音声母不合 ky,zhyz（不是注音标注错误），必须整句重写到六格全合。`;

function buildUser(scene: string, repair?: string): string {
  if (!repair) {
    return `场景：${scene}\n请输出 JSON。`;
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

function describeFail(v: ValidationResult): string {
  if (!v.lengthOk) {
    return `汉字数=${v.chars.length}（需要恰好6），得到「${v.chars.join("")}」。请重写。`;
  }
  const bad = v.slots
    .filter((s) => !s.pass)
    .map((s) => {
      const got = s.initials.join("/") || "无声母";
      return `第${s.index + 1}格「${s.char}」首字母不合 ky,zhyz：实得[${got}]，要求[${s.expected}]`;
    });
  return (
    "以下格子首字母不合 ky,zhyz，请交回生成器重写整句（不要解释，只出新 JSON）：" +
    bad.join("；")
  );
}

export async function generateKyZhyz(
  scene: string,
  apiKey: string,
): Promise<GenerateResult> {
  let repair: string | undefined;
  let lastPhrase = "";
  let lastGloss = "";
  let lastValidation: ValidationResult | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { phrase, gloss } = await callDeepSeek(apiKey, scene, repair);
    lastPhrase = phrase;
    lastGloss = gloss;
    const validation = validateKyZhyz(phrase);
    lastValidation = validation;

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

    repair = describeFail(validation);
    // also nudge with extracted chars
    if (extractHanChars(phrase).length !== 6) {
      repair += "。必须恰好六个汉字。";
    }
  }

  return {
    ok: false,
    error: "多次交回生成器后仍有格子首字母不合 ky,zhyz，换个场景再试。",
    lastPhrase,
    lastGloss,
    validation: lastValidation,
    attempts: MAX_ATTEMPTS,
  };
}
