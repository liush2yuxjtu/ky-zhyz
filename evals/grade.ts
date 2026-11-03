/**
 * Cheap offline hard-gate grader (meme/poison) — no API.
 * For full skill-creator hillclimb (outputs + grading.json + viewer):
 *   EVAL_LIVE=1 npm run eval:iteration
 *
 * Usage:
 *   npm run eval:quality
 *   EVAL_LIVE=1 npm run eval:quality   # thin live pass (delegates shape of old script)
 *   EVAL_LIVE=1 EVAL_JUDGE=1 npm run eval:quality
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { matchTopic } from "../src/lib/topics";
import { validateKyZhyz } from "../src/lib/validator";
import { generateKyZhyz, MAX_ATTEMPTS } from "../src/lib/deepseek";

type ExpectedMeme =
  | "fallback"
  | string
  | { must_not_topic: string }
  | { id_contains: string };

type Checks = {
  must_include_any?: string[];
  must_not_phrase_patterns?: string[];
  expected_meme?: ExpectedMeme;
  poison_phrase?: string;
  exact_gt?: boolean;
  ground_truth_phrases?: string[];
};

type EvalCase = {
  id: number;
  name: string;
  prompt: string;
  expected_output?: string;
  expectations?: string[];
  checks: Checks;
  ground_truth_phrases?: string[];
  notes?: string;
  slug?: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadDotEnvLocal() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotEnvLocal();

function loadEvals(): EvalCase[] {
  const evalsPath = resolve(__dirname, "evals.json");
  if (existsSync(evalsPath)) {
    const data = JSON.parse(readFileSync(evalsPath, "utf8")) as {
      evals: EvalCase[];
    };
    return data.evals;
  }
  // legacy gold.json fallback
  const goldPath = resolve(__dirname, "gold.json");
  const gold = JSON.parse(readFileSync(goldPath, "utf8")) as {
    id: string;
    scene: string;
    must_include_any?: string[];
    must_not_phrase_patterns?: string[];
    expected_meme: ExpectedMeme;
    poison_phrase?: string;
  }[];
  return gold.map((c, i) => ({
    id: i + 1,
    name: c.id,
    prompt: c.scene,
    checks: {
      must_include_any: c.must_include_any,
      must_not_phrase_patterns: c.must_not_phrase_patterns,
      expected_meme: c.expected_meme,
      poison_phrase: c.poison_phrase,
    },
  }));
}

const LIVE = process.env.EVAL_LIVE === "1";
const JUDGE = process.env.EVAL_JUDGE === "1";
const apiKey = process.env.DEEPSEEK_API_KEY ?? "";
const SHELL_RE = /^可以这很.+种$/;

function normalizeHan(s: string): string {
  return (s || "").replace(/[\s,，、。.!！？?；;：:\"'“”]/g, "");
}

function gtPhrases(c: EvalCase): string[] {
  const out = [
    ...(c.ground_truth_phrases ?? []),
    ...(c.checks.ground_truth_phrases ?? []),
  ];
  if (c.checks.exact_gt && c.expected_output) out.push(c.expected_output);
  return [...new Set(out.map(normalizeHan).filter(Boolean))];
}


function checkExpectedMeme(
  expected: ExpectedMeme | undefined,
  topicId: string,
  via: string,
): { ok: boolean; msg: string } {
  if (expected == null) {
    return { ok: true, msg: `meme unchecked (got ${topicId})` };
  }
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

async function main() {
  const cases = loadEvals();
  console.log(
    `ky-zhyz eval:quality — cases=${cases.length} LIVE=${LIVE} JUDGE=${JUDGE} MAX_ATTEMPTS=${MAX_ATTEMPTS}`,
  );
  console.log(
    `(For skill-creator workspace + viewer use: EVAL_LIVE=1 npm run eval:iteration)`,
  );

  if (LIVE && !apiKey) {
    console.error("EVAL_LIVE=1 requires DEEPSEEK_API_KEY");
    process.exit(2);
  }
  if (JUDGE && !LIVE) {
    console.error("EVAL_JUDGE=1 requires EVAL_LIVE=1");
    process.exit(2);
  }

  let hardFail = 0;
  let softWarn = 0;

  for (const c of cases) {
    const parts: string[] = [];
    let hard: "PASS" | "FAIL" = "PASS";
    let soft: "PASS" | "WARN" | "SKIP" = "SKIP";

    const match = matchTopic({
      scene: c.prompt,
      phrase: c.checks.poison_phrase,
      gloss: c.checks.poison_phrase ? "poison" : undefined,
    });
    const memeCheck = checkExpectedMeme(
      c.checks.expected_meme,
      match.topic.id,
      match.via,
    );
    if (c.checks.exact_gt) {
      // Viral GT gates on exact phrase under LIVE; meme topic is soft.
      parts.push(memeCheck.ok ? memeCheck.msg : `meme soft ${memeCheck.msg}`);
    } else if (!memeCheck.ok) {
      hard = "FAIL";
      parts.push(`MEME ${memeCheck.msg}`);
    } else {
      parts.push(memeCheck.msg);
    }

    if (
      c.checks.poison_phrase &&
      match.topic.id === "lebron" &&
      match.via === "keyword"
    ) {
      hard = "FAIL";
      parts.push("POLLUTION 野种→lebron");
    }

    if (LIVE) {
      const result = await generateKyZhyz(c.prompt, apiKey);
      if (result.attempts !== 1 && MAX_ATTEMPTS === 1) {
        hard = "FAIL";
        parts.push(`attempts=${result.attempts} want 1`);
      }
      if (!result.ok) {
        soft = "WARN";
        parts.push(`LIVE fail: ${result.error}`);
      } else {
        const v = validateKyZhyz(result.phrase);
        if (!v.pass) {
          hard = "FAIL";
          parts.push("pinyin FAIL on returned PASS (bug)");
        } else {
          parts.push(`phrase=${result.phrase}`);
        }
        const liveMatch = matchTopic({
          scene: c.prompt,
          phrase: result.phrase,
          gloss: result.gloss,
        });
        const liveMeme = checkExpectedMeme(
          c.checks.expected_meme,
          liveMatch.topic.id,
          liveMatch.via,
        );
        if (!liveMeme.ok && !c.checks.exact_gt) {
          hard = "FAIL";
          parts.push(`LIVE_MEME ${liveMeme.msg}`);
        } else if (!liveMeme.ok && c.checks.exact_gt) {
          parts.push(`LIVE_MEME soft ${liveMeme.msg}`);
        }
        const gts = gtPhrases(c);
        if (c.checks.exact_gt || gts.length) {
          const got = normalizeHan(result.phrase);
          if (gts.length && !gts.includes(got)) {
            hard = "FAIL";
            parts.push(`GT miss got=${got} want∈{${gts.join(",")}}`);
          } else if (gts.length) {
            parts.push(`GT hit=${got}`);
          }
        }
        if (SHELL_RE.test(result.phrase)) {
          if (c.checks.exact_gt) {
            if (soft === "SKIP") soft = "PASS";
            parts.push("shell_ok_for_exact_gt");
          } else {
            soft = "WARN";
            parts.push("empty_shell");
          }
        } else if (soft === "SKIP") {
          soft = "PASS";
        }
        const must = c.checks.must_include_any ?? [];
        if (must.length && !must.some((t) => result.phrase.includes(t))) {
          soft = "WARN";
          parts.push(`theme_hint miss (${must.join("/")})`);
        }
      }
    } else if (c.checks.poison_phrase && SHELL_RE.test(c.checks.poison_phrase)) {
      soft = "PASS";
      parts.push("shell_detector ok");
    }

    if (hard === "FAIL") hardFail += 1;
    if (soft === "WARN") softWarn += 1;
    console.log(
      `[${hard}] soft=${soft} ${c.name} — ${parts.join(" | ")}`,
    );
  }

  console.log(
    `\nSummary: ${cases.length - hardFail}/${cases.length} hard PASS, soft WARN=${softWarn}, LIVE=${LIVE}`,
  );
  if (hardFail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
