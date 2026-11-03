/**
 * Developer hillclimb grader for ky-zhyz SYSTEM prompt + meme matching.
 *
 * Default (cheap): hard meme guards + soft shell regex on poison_phrase / optional live phrase.
 * EVAL_LIVE=1  — call DeepSeek once per gold scene (one-shot), check pinyin + attempts===1
 * EVAL_JUDGE=1 — LLM-as-judge 网感/主题唯一性 (requires EVAL_LIVE=1 and DEEPSEEK_API_KEY)
 *
 * Usage:
 *   npx tsx evals/grade.ts
 *   EVAL_LIVE=1 npx tsx evals/grade.ts
 *   EVAL_LIVE=1 EVAL_JUDGE=1 npx tsx evals/grade.ts
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { matchTopic } from "../src/lib/topics";
import { validateKyZhyz } from "../src/lib/validator";
import { generateKyZhyz, MAX_ATTEMPTS } from "../src/lib/deepseek";

type ExpectedMeme =
  | "fallback"
  | string
  | { must_not_topic: string }
  | { id_contains: string };

type GoldCase = {
  id: string;
  scene: string;
  must_include_any?: string[];
  must_not_phrase_patterns?: string[];
  expected_meme: ExpectedMeme;
  notes?: string;
  poison_phrase?: string;
};

type Row = {
  id: string;
  hard: "PASS" | "FAIL";
  soft: "PASS" | "WARN" | "SKIP";
  judge?: string;
  detail: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const goldPath = resolve(__dirname, "gold.json");
const gold = JSON.parse(readFileSync(goldPath, "utf8")) as GoldCase[];

const LIVE = process.env.EVAL_LIVE === "1";
const JUDGE = process.env.EVAL_JUDGE === "1";
const apiKey = process.env.DEEPSEEK_API_KEY ?? "";

const SHELL_RE = /^可以这很.+种$/;

function checkExpectedMeme(
  expected: ExpectedMeme,
  topicId: string,
  via: string,
): { ok: boolean; msg: string } {
  if (expected === "fallback") {
    const ok = via === "fallback" || topicId === "generic-abstract";
    return {
      ok,
      msg: ok ? `meme=fallback` : `want fallback got ${topicId} via=${via}`,
    };
  }
  if (typeof expected === "string") {
    const ok = topicId === expected;
    return {
      ok,
      msg: ok ? `meme=${topicId}` : `want ${expected} got ${topicId}`,
    };
  }
  if ("must_not_topic" in expected) {
    const ok = topicId !== expected.must_not_topic;
    return {
      ok,
      msg: ok
        ? `meme≠${expected.must_not_topic} (got ${topicId})`
        : `forbidden topic ${expected.must_not_topic}`,
    };
  }
  if ("id_contains" in expected) {
    const ok = topicId.includes(expected.id_contains);
    return {
      ok,
      msg: ok
        ? `meme~${expected.id_contains}`
        : `want id containing ${expected.id_contains}, got ${topicId}`,
    };
  }
  return { ok: false, msg: "unknown expected_meme shape" };
}

function softPhraseFlags(
  phrase: string | undefined,
  patterns: string[] | undefined,
): string[] {
  const flags: string[] = [];
  if (!phrase) return flags;
  if (SHELL_RE.test(phrase)) flags.push("empty_shell:可以这很X种");
  for (const p of patterns ?? []) {
    try {
      if (new RegExp(p).test(phrase)) flags.push(`pattern:${p}`);
    } catch {
      /* ignore bad regex */
    }
  }
  return flags;
}

function themeHintOk(phrase: string, mustAny: string[] | undefined): boolean {
  if (!mustAny || mustAny.length === 0) return true;
  return mustAny.some((t) => phrase.includes(t));
}

async function judgePhrase(
  scene: string,
  phrase: string,
  gloss: string,
): Promise<{ wanggan: number; unique: number; note: string }> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0,
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            '你是严格的中文互联网文案评审。只输出 JSON：{"wanggan":1-5,"unique":1-5,"note":"一句理由"}。wanggan=贴吧/抽象/口头禅味；unique=六字能否一眼回指该场景（禁万能壳）。',
        },
        {
          role: "user",
          content: `场景：${scene}\n六字：${phrase}\ngloss：${gloss}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`judge HTTP ${res.status}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  const m = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(m ? m[0] : raw) as {
    wanggan?: number;
    unique?: number;
    note?: string;
  };
  return {
    wanggan: Number(parsed.wanggan) || 0,
    unique: Number(parsed.unique) || 0,
    note: String(parsed.note ?? ""),
  };
}

async function main() {
  console.log(`ky-zhyz eval:quality — cases=${gold.length} LIVE=${LIVE} JUDGE=${JUDGE} MAX_ATTEMPTS=${MAX_ATTEMPTS}`);
  if (LIVE && !apiKey) {
    console.error("EVAL_LIVE=1 requires DEEPSEEK_API_KEY");
    process.exit(2);
  }
  if (JUDGE && !LIVE) {
    console.error("EVAL_JUDGE=1 requires EVAL_LIVE=1");
    process.exit(2);
  }

  const rows: Row[] = [];
  let hardFail = 0;
  let softWarn = 0;

  for (const c of gold) {
    const parts: string[] = [];
    let hard: Row["hard"] = "PASS";
    let soft: Row["soft"] = "SKIP";
    let judgeStr: string | undefined;

    // --- Hard: meme guards (always) ---
    const match = matchTopic({
      scene: c.scene,
      phrase: c.poison_phrase,
      gloss: c.poison_phrase ? "poison" : undefined,
    });
    const memeCheck = checkExpectedMeme(
      c.expected_meme,
      match.topic.id,
      match.via,
    );
    if (!memeCheck.ok) {
      hard = "FAIL";
      parts.push(`MEME ${memeCheck.msg}`);
    } else {
      parts.push(memeCheck.msg);
    }

    // Explicit pollution: 野种 phrase must never yield celebrity when scene lacks celeb kw
    if (c.poison_phrase && match.topic.id === "lebron" && match.via === "keyword") {
      hard = "FAIL";
      parts.push("POLLUTION 野种→lebron");
    }

    let livePhrase: string | undefined;
    let liveGloss: string | undefined;
    let liveAttempts: number | undefined;

    if (LIVE) {
      const result = await generateKyZhyz(c.scene, apiKey);
      liveAttempts = result.attempts;
      if (result.attempts !== 1 && MAX_ATTEMPTS === 1) {
        hard = "FAIL";
        parts.push(`attempts=${result.attempts} want 1`);
      }
      if (!result.ok) {
        // one-shot may legitimately fail pinyin — soft warn, not always hard fail
        soft = "WARN";
        parts.push(`LIVE fail: ${result.error}`);
      } else {
        livePhrase = result.phrase;
        liveGloss = result.gloss;
        const v = validateKyZhyz(result.phrase);
        if (!v.pass) {
          hard = "FAIL";
          parts.push("pinyin FAIL on returned PASS (bug)");
        } else {
          parts.push(`phrase=${result.phrase}`);
        }
        // live meme should still respect scene-first
        const liveMatch = matchTopic({
          scene: c.scene,
          phrase: result.phrase,
          gloss: result.gloss,
        });
        const liveMeme = checkExpectedMeme(
          c.expected_meme,
          liveMatch.topic.id,
          liveMatch.via,
        );
        if (!liveMeme.ok) {
          // celebrity expected_meme is hard; fallback expected is hard
          hard = "FAIL";
          parts.push(`LIVE_MEME ${liveMeme.msg}`);
        }

        const flags = softPhraseFlags(result.phrase, c.must_not_phrase_patterns);
        if (flags.length) {
          soft = "WARN";
          parts.push(`soft ${flags.join(",")}`);
        } else if (soft === "SKIP") {
          soft = "PASS";
        }

        if (
          c.must_include_any &&
          c.must_include_any.length > 0 &&
          !themeHintOk(result.phrase, c.must_include_any)
        ) {
          soft = "WARN";
          parts.push(
            `theme_hint miss (want any of ${c.must_include_any.join("/")})`,
          );
        }

        if (JUDGE) {
          try {
            const j = await judgePhrase(
              c.scene,
              result.phrase,
              result.gloss || "",
            );
            judgeStr = `网感${j.wanggan}/主题${j.unique} ${j.note}`;
            if (j.wanggan < 4 || j.unique < 4) {
              soft = "WARN";
              parts.push(`judge below 4`);
            }
          } catch (e) {
            soft = "WARN";
            parts.push(`judge error: ${e instanceof Error ? e.message : e}`);
          }
        }
      }
      void liveAttempts;
      void liveGloss;
      void livePhrase;
    } else {
      // offline soft: flag poison_phrase shells
      const flags = softPhraseFlags(
        c.poison_phrase,
        c.must_not_phrase_patterns,
      );
      // poison_phrase is intentionally a bad shell — soft check documents detector works
      if (c.poison_phrase && SHELL_RE.test(c.poison_phrase)) {
        soft = "PASS";
        parts.push("shell_detector ok");
      } else if (flags.length) {
        soft = "WARN";
        parts.push(flags.join(","));
      } else {
        soft = "SKIP";
      }
    }

    if (hard === "FAIL") hardFail += 1;
    if (soft === "WARN") softWarn += 1;

    rows.push({
      id: c.id,
      hard,
      soft,
      judge: judgeStr,
      detail: parts.join(" | "),
    });
  }

  for (const r of rows) {
    const j = r.judge ? ` | ${r.judge}` : "";
    console.log(
      `[${r.hard}] soft=${r.soft} ${r.id} — ${r.detail}${j}`,
    );
  }

  console.log(
    `\nSummary: ${rows.length - hardFail}/${rows.length} hard PASS, soft WARN=${softWarn}, LIVE=${LIVE}`,
  );

  if (hardFail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
