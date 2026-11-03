/**
 * skill-creator-shaped SYSTEM hillclimb runner for ky-zhyz.
 *
 * Layout (matches aggregate_benchmark.py + eval-viewer):
 *   kyzhyz-system-workspace/iteration-N/
 *     SYSTEM.txt
 *     eval-<name>/
 *       eval_metadata.json
 *       with_skill/run-1/outputs/{phrase.json,meme.json,raw.txt,transcript.md}
 *       with_skill/run-1/grading.json
 *       with_skill/run-1/timing.json
 *     benchmark.json / benchmark.md
 *     review/index.html
 *     PROGRESS.md
 *
 * `with_skill` = CURRENT SYSTEM under test (viewer color-coding).
 * Future iterations may add `old_skill` snapshot of a previous SYSTEM.
 *
 * Usage:
 *   EVAL_LIVE=1 npx tsx evals/run_iteration.ts
 *   EVAL_LIVE=1 EVAL_JUDGE=1 npx tsx evals/run_iteration.ts --iteration 1
 *   EVAL_LIVE=1 npx tsx evals/run_iteration.ts --limit 12   # stratified subset
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  cpSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { matchTopic } from "../src/lib/topics";
import { validateKyZhyz } from "../src/lib/validator";
import { generateKyZhyz, SYSTEM, MAX_ATTEMPTS } from "../src/lib/deepseek";

type Checks = {
  must_include_any?: string[];
  must_not_phrase_patterns?: string[];
  expected_meme: string | { must_not_topic: string } | { id_contains: string };
  poison_phrase?: string;
};

type EvalCase = {
  id: number;
  name: string;
  prompt: string;
  expected_output: string;
  expectations: string[];
  checks: Checks;
};

type EvalsFile = {
  skill_name: string;
  description?: string;
  evals: EvalCase[];
};

type GradedExpectation = {
  text: string;
  passed: boolean;
  evidence: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SKILL_CREATOR =
  "/home/box/agent-data/workflows/grok-skill-creator-cowork-style";

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

const LIVE = process.env.EVAL_LIVE === "1";
const JUDGE = process.env.EVAL_JUDGE === "1";
const apiKey = process.env.DEEPSEEK_API_KEY ?? "";

const SHELL_RE = /^可以这很.+种$/;

function parseArgs() {
  const argv = process.argv.slice(2);
  let iteration = 1;
  let limit: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--iteration" && argv[i + 1]) {
      iteration = Number(argv[++i]) || 1;
    } else if (argv[i] === "--limit" && argv[i + 1]) {
      limit = Number(argv[++i]) || null;
    }
  }
  return { iteration, limit };
}

function checkExpectedMeme(
  expected: Checks["expected_meme"],
  topicId: string,
  via: string,
): { ok: boolean; msg: string } {
  if (expected === "fallback") {
    const ok = via === "fallback" || topicId === "generic-abstract";
    return {
      ok,
      msg: ok ? `meme=fallback (${topicId})` : `want fallback got ${topicId} via=${via}`,
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

/** Stratify: keep all celeb/poison first, then fill daily until limit. */
function selectEvals(all: EvalCase[], limit: number | null): EvalCase[] {
  if (!limit || limit >= all.length) return all;
  const priority = all.filter(
    (e) =>
      e.checks.poison_phrase ||
      (typeof e.checks.expected_meme === "string" &&
        e.checks.expected_meme !== "fallback"),
  );
  const rest = all.filter((e) => !priority.includes(e));
  const out = [...priority];
  for (const e of rest) {
    if (out.length >= limit) break;
    out.push(e);
  }
  return out.slice(0, limit);
}

function gradeEval(args: {
  ev: EvalCase;
  live:
    | {
        ok: boolean;
        phrase?: string;
        gloss?: string;
        attempts: number;
        error?: string;
      }
    | null;
  judge?: { wanggan: number; unique: number; note: string };
}): {
  expectations: GradedExpectation[];
  summary: { passed: number; failed: number; total: number; pass_rate: number };
} {
  const { ev, live, judge } = args;
  const graded: GradedExpectation[] = [];

  // Map each human expectation string to a programmatic verdict.
  for (const text of ev.expectations) {
    const lower = text.toLowerCase();

    // Poison guard
    if (lower.includes("poison") || text.includes("野种") && text.includes("lebron")) {
      const phrase = ev.checks.poison_phrase ?? "可以这很野种";
      const match = matchTopic({
        scene: ev.prompt,
        phrase,
        gloss: "poison",
      });
      const polluted =
        match.topic.id === "lebron" && match.via === "keyword";
      const memeOk = checkExpectedMeme(
        ev.checks.expected_meme,
        match.topic.id,
        match.via,
      );
      const passed = !polluted && memeOk.ok;
      graded.push({
        text,
        passed,
        evidence: polluted
          ? `POLLUTION: poison phrase hit lebron via=keyword`
          : `poison match: ${memeOk.msg}; topic=${match.topic.id} via=${match.via}`,
      });
      continue;
    }

    // One-shot attempts
    if (lower.includes("attempts") || lower.includes("one-shot")) {
      if (!live) {
        graded.push({
          text,
          passed: false,
          evidence: "EVAL_LIVE not set — no generation run",
        });
        continue;
      }
      const passed = live.attempts === 1 && MAX_ATTEMPTS === 1;
      graded.push({
        text,
        passed,
        evidence: `attempts=${live.attempts}, MAX_ATTEMPTS=${MAX_ATTEMPTS}`,
      });
      continue;
    }

    // Pinyin / 6 han when succeeds
    if (
      lower.includes("k/y/zh/h/y/z") ||
      lower.includes("6 han") ||
      text.includes("声母")
    ) {
      if (!live) {
        graded.push({
          text,
          passed: false,
          evidence: "EVAL_LIVE not set — no generation run",
        });
        continue;
      }
      if (!live.ok || !live.phrase) {
        graded.push({
          text,
          passed: false,
          evidence: `generation failed (one-shot may miss pinyin): ${live.error ?? "ok=false"}`,
        });
        continue;
      }
      const v = validateKyZhyz(live.phrase);
      graded.push({
        text,
        passed: v.pass,
        evidence: v.pass
          ? `phrase=${live.phrase} pinyin PASS`
          : `phrase=${live.phrase} pinyin FAIL: ${JSON.stringify(v)}`,
      });
      continue;
    }

    // Empty shell
    if (
      lower.includes("empty-shell") ||
      text.includes("可以这很") ||
      lower.includes("shell")
    ) {
      if (!live?.ok || !live.phrase) {
        // If we have poison-only offline: skip as N/A-fail only when live missing
        if (!live) {
          graded.push({
            text,
            passed: true,
            evidence: "skipped live shell check (no LIVE); poison detector covered separately",
          });
          continue;
        }
        graded.push({
          text,
          passed: false,
          evidence: `no successful phrase to check shell (${live.error ?? "fail"})`,
        });
        continue;
      }
      const isShell = SHELL_RE.test(live.phrase);
      let patternHit = false;
      for (const p of ev.checks.must_not_phrase_patterns ?? []) {
        try {
          if (new RegExp(p).test(live.phrase)) patternHit = true;
        } catch {
          /* ignore */
        }
      }
      const passed = !isShell && !patternHit;
      graded.push({
        text,
        passed,
        evidence: passed
          ? `phrase=${live.phrase} not empty shell`
          : `shell/pattern hit on phrase=${live.phrase}`,
      });
      continue;
    }

    // Theme uniqueness
    if (
      lower.includes("theme") ||
      text.includes("主题") ||
      lower.includes("uniqu")
    ) {
      const must = ev.checks.must_include_any ?? [];
      if (must.length === 0) {
        graded.push({
          text,
          passed: true,
          evidence: "no must_include_any — theme soft-pass",
        });
        continue;
      }
      if (!live?.ok || !live.phrase) {
        graded.push({
          text,
          passed: false,
          evidence: `no phrase to check theme clues [${must.join("/")}]`,
        });
        continue;
      }
      const ok = themeHintOk(live.phrase, must);
      graded.push({
        text,
        passed: ok,
        evidence: ok
          ? `phrase=${live.phrase} hits theme clue`
          : `phrase=${live.phrase} misses all of [${must.join("/")}]`,
      });
      continue;
    }

    // Meme match (non-poison)
    if (lower.includes("meme") || text.includes("梗图") || text.includes("fallback")) {
      const phraseForMatch = live?.ok ? live.phrase : undefined;
      const match = matchTopic({
        scene: ev.prompt,
        phrase: phraseForMatch,
        gloss: live?.ok ? live.gloss : undefined,
      });
      // Also always verify scene-only / poison offline expectation
      const memeOk = checkExpectedMeme(
        ev.checks.expected_meme,
        match.topic.id,
        match.via,
      );
      // For celeb expected: prefer scene match; for fallback: scene must not celeb
      const sceneOnly = matchTopic({ scene: ev.prompt });
      const sceneOk = checkExpectedMeme(
        ev.checks.expected_meme,
        sceneOnly.topic.id,
        sceneOnly.via,
      );
      // Pass if scene-first match is correct (live phrase must not pollute away from expected)
      const passed = sceneOk.ok && memeOk.ok;
      graded.push({
        text,
        passed,
        evidence: `scene: ${sceneOk.msg}; with_phrase: ${memeOk.msg}`,
      });
      continue;
    }

    // Fallback: unknown expectation — try judge notes or mark unverified fail
    graded.push({
      text,
      passed: false,
      evidence: "No programmatic grader rule matched this expectation text",
    });
  }

  // Optional LLM judge as extra expectations
  if (JUDGE && judge && live?.ok && live.phrase) {
    graded.push({
      text: "LLM judge 网感 ≥ 4",
      passed: judge.wanggan >= 4,
      evidence: `wanggan=${judge.wanggan}/5 — ${judge.note}`,
    });
    graded.push({
      text: "LLM judge 主题唯一性 ≥ 4",
      passed: judge.unique >= 4,
      evidence: `unique=${judge.unique}/5 — ${judge.note}`,
    });
  }

  const passed = graded.filter((g) => g.passed).length;
  const total = graded.length;
  const failed = total - passed;
  return {
    expectations: graded,
    summary: {
      passed,
      failed,
      total,
      pass_rate: total ? passed / total : 0,
    },
  };
}

async function main() {
  const { iteration, limit } = parseArgs();
  const evalsPath = join(ROOT, "evals", "evals.json");
  const data = JSON.parse(readFileSync(evalsPath, "utf8")) as EvalsFile;
  const selected = selectEvals(data.evals, limit);

  if (!LIVE) {
    console.error(
      "run_iteration.ts requires EVAL_LIVE=1 (use npm run eval:quality for offline hard gates)",
    );
    process.exit(2);
  }
  if (!apiKey) {
    console.error("DEEPSEEK_API_KEY missing (.env.local or env)");
    process.exit(2);
  }

  const ws = join(ROOT, "kyzhyz-system-workspace", `iteration-${iteration}`);
  mkdirSync(ws, { recursive: true });
  writeFileSync(join(ws, "SYSTEM.txt"), SYSTEM, "utf8");

  // Snapshot previous SYSTEM for A/B context (skill-creator old_skill analog)
  if (iteration > 1) {
    const prevSys = join(
      ROOT,
      "kyzhyz-system-workspace",
      `iteration-${iteration - 1}`,
      "SYSTEM.txt",
    );
    if (existsSync(prevSys)) {
      cpSync(prevSys, join(ws, "SYSTEM.prev.txt"));
      const oldSkillDir = join(ws, "old_skill");
      mkdirSync(oldSkillDir, { recursive: true });
      cpSync(prevSys, join(oldSkillDir, "SYSTEM.txt"));
      writeFileSync(
        join(oldSkillDir, "README.md"),
        [
          `# old_skill baseline`,
          ``,
          `Snapshot of iteration-${iteration - 1} SYSTEM before this rewrite.`,
          `Full graded outputs live in ../iteration-${iteration - 1}/.`,
          ``,
        ].join("\n"),
        "utf8",
      );
    }
  }

  console.log(
    `iteration-${iteration}: ${selected.length}/${data.evals.length} evals, JUDGE=${JUDGE}, MAX_ATTEMPTS=${MAX_ATTEMPTS}`,
  );
  console.log(`workspace: ${ws}`);

  const progressRows: {
    name: string;
    pass_rate: number;
    passed: number;
    total: number;
    phrase: string;
    meme: string;
  }[] = [];

  for (const ev of selected) {
    const evalDir = join(ws, `eval-${ev.name}`);
    const runDir = join(evalDir, "with_skill", "run-1");
    const outputsDir = join(runDir, "outputs");
    mkdirSync(outputsDir, { recursive: true });

    writeFileSync(
      join(evalDir, "eval_metadata.json"),
      JSON.stringify(
        {
          eval_id: ev.id,
          eval_name: ev.name,
          prompt: ev.prompt,
          expected_output: ev.expected_output,
          assertions: ev.expectations,
        },
        null,
        2,
      ) + "\n",
    );

    const t0 = Date.now();
    let live: {
      ok: boolean;
      phrase?: string;
      gloss?: string;
      attempts: number;
      error?: string;
      raw?: string;
    };
    try {
      const result = await generateKyZhyz(ev.prompt, apiKey);
      if (result.ok) {
        live = {
          ok: true,
          phrase: result.phrase,
          gloss: result.gloss,
          attempts: result.attempts,
          raw: JSON.stringify(
            { phrase: result.phrase, gloss: result.gloss, display: result.display },
            null,
            2,
          ),
        };
      } else {
        live = {
          ok: false,
          attempts: result.attempts,
          error: result.error,
        };
      }
    } catch (e) {
      live = {
        ok: false,
        attempts: 0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
    const durationMs = Date.now() - t0;

    const memeMatch = matchTopic({
      scene: ev.prompt,
      phrase: live.phrase,
      gloss: live.gloss,
    });

    writeFileSync(
      join(outputsDir, "phrase.json"),
      JSON.stringify(
        {
          ok: live.ok,
          phrase: live.phrase ?? null,
          gloss: live.gloss ?? null,
          attempts: live.attempts,
          error: live.error ?? null,
        },
        null,
        2,
      ) + "\n",
    );
    writeFileSync(
      join(outputsDir, "meme.json"),
      JSON.stringify(
        {
          topic_id: memeMatch.topic.id,
          via: memeMatch.via,
          expected: ev.checks.expected_meme,
          src: memeMatch.topic.meme?.src ?? null,
        },
        null,
        2,
      ) + "\n",
    );
    writeFileSync(
      join(outputsDir, "raw.txt"),
      live.ok
        ? `phrase=${live.phrase}\ngloss=${live.gloss}\nattempts=${live.attempts}\n`
        : `FAIL attempts=${live.attempts}\nerror=${live.error}\n`,
    );
    writeFileSync(
      join(outputsDir, "transcript.md"),
      [
        `## Eval Prompt\n\n${ev.prompt}\n`,
        `## Expected\n\n${ev.expected_output}\n`,
        `## Result\n\n`,
        live.ok
          ? `- phrase: ${live.phrase}\n- gloss: ${live.gloss}\n- attempts: ${live.attempts}\n- meme: ${memeMatch.topic.id} via=${memeMatch.via}\n`
          : `- FAIL: ${live.error}\n- attempts: ${live.attempts}\n`,
      ].join("\n"),
    );

    let judge:
      | { wanggan: number; unique: number; note: string }
      | undefined;
    if (JUDGE && live.ok && live.phrase) {
      try {
        judge = await judgePhrase(ev.prompt, live.phrase, live.gloss ?? "");
        writeFileSync(
          join(outputsDir, "judge.json"),
          JSON.stringify(judge, null, 2) + "\n",
        );
      } catch (e) {
        writeFileSync(
          join(outputsDir, "judge.json"),
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }) + "\n",
        );
      }
    }

    const grading = gradeEval({ ev, live, judge });
    writeFileSync(
      join(runDir, "grading.json"),
      JSON.stringify(
        {
          expectations: grading.expectations,
          summary: grading.summary,
          timing: {
            total_duration_seconds: durationMs / 1000,
            executor_duration_seconds: durationMs / 1000,
          },
          eval_feedback: {
            overall:
              "Programmatic grader mapped expectation text → hard checks (pinyin, attempts, theme, shell, meme, poison).",
            suggestions: [],
          },
        },
        null,
        2,
      ) + "\n",
    );
    // Also sibling copy for task layout convenience
    writeFileSync(
      join(evalDir, "grading.json"),
      readFileSync(join(runDir, "grading.json")),
    );

    writeFileSync(
      join(runDir, "timing.json"),
      JSON.stringify(
        {
          duration_ms: durationMs,
          total_duration_seconds: durationMs / 1000,
        },
        null,
        2,
      ) + "\n",
    );

    progressRows.push({
      name: ev.name,
      pass_rate: grading.summary.pass_rate,
      passed: grading.summary.passed,
      total: grading.summary.total,
      phrase: live.phrase ?? `(fail: ${live.error ?? "?"})`,
      meme: `${memeMatch.topic.id}/${memeMatch.via}`,
    });

    console.log(
      `[${(grading.summary.pass_rate * 100).toFixed(0)}%] ${ev.name} — ${live.phrase ?? live.error} | meme=${memeMatch.topic.id}`,
    );
  }

  // Aggregate via skill-creator helper
  const agg = spawnSync(
    "python3",
    [
      join(SKILL_CREATOR, "scripts", "aggregate_benchmark.py"),
      ws,
      "--skill-name",
      data.skill_name,
      "--skill-path",
      join(ROOT, "src/lib/deepseek.ts"),
    ],
    { encoding: "utf8" },
  );
  process.stdout.write(agg.stdout || "");
  process.stderr.write(agg.stderr || "");
  if (agg.status !== 0) {
    console.error("aggregate_benchmark.py failed", agg.status);
    process.exit(1);
  }

  // Patch metadata for clarity
  const benchPath = join(ws, "benchmark.json");
  if (existsSync(benchPath)) {
    const bench = JSON.parse(readFileSync(benchPath, "utf8")) as {
      metadata: Record<string, unknown>;
      runs: { eval_id: number; eval_name?: string }[];
      notes: string[];
    };
    bench.metadata.executor_model = "deepseek-chat";
    bench.metadata.analyzer_model = "programmatic+optional-judge";
    bench.metadata.runs_per_configuration = 1;
    bench.metadata.configuration_note =
      iteration > 1
        ? `with_skill = rewritten SYSTEM (iteration-${iteration}); old_skill/SYSTEM.txt = iteration-${iteration - 1} snapshot`
        : "with_skill = current SYSTEM in src/lib/deepseek.ts (baseline iteration; no rewrite yet)";
    // Attach eval_name for viewer headers
    for (const run of bench.runs) {
      const ev = selected.find((e) => e.id === run.eval_id);
      if (ev) run.eval_name = ev.name;
    }
    bench.notes = [
      iteration > 1
        ? `Iteration-${iteration} rewrite. SYSTEM.txt = new; SYSTEM.prev.txt / old_skill = prior SYSTEM. Compare vs iteration-${iteration - 1}.`
        : "Iteration baseline: CURRENT SYSTEM snapshot in SYSTEM.txt — do not rewrite until human reviews static viewer.",
      `Evals run: ${selected.map((e) => e.name).join(", ")}`,
      JUDGE
        ? "EVAL_JUDGE=1: wanggan/unique ≥4 appended as extra expectations."
        : "Run with EVAL_JUDGE=1 for soft 网感/主题 scores.",
    ];
    writeFileSync(benchPath, JSON.stringify(bench, null, 2) + "\n");
  }

  // Static viewer
  const reviewDir = join(ws, "review");
  mkdirSync(reviewDir, { recursive: true });
  const reviewOut = join(reviewDir, "index.html");
  const reviewArgs = [
    join(SKILL_CREATOR, "eval-viewer", "generate_review.py"),
    ws,
    "--skill-name",
    data.skill_name,
    "--benchmark",
    join(ws, "benchmark.json"),
    "--static",
    reviewOut,
  ];
  if (iteration > 1) {
    const prevWs = join(
      ROOT,
      "kyzhyz-system-workspace",
      `iteration-${iteration - 1}`,
    );
    if (existsSync(prevWs)) {
      reviewArgs.push("--previous-workspace", prevWs);
    }
  }
  const rev = spawnSync("python3", reviewArgs, { encoding: "utf8" });
  process.stdout.write(rev.stdout || "");
  process.stderr.write(rev.stderr || "");
  if (rev.status !== 0) {
    console.error("generate_review.py failed", rev.status);
    process.exit(1);
  }

  // PROGRESS.md
  const meanPass =
    progressRows.reduce((s, r) => s + r.pass_rate, 0) /
    (progressRows.length || 1);
  const hardAllPass = progressRows.filter((r) => r.pass_rate === 1).length;
  const progressMd = `# SYSTEM hillclimb — iteration-${iteration} PROGRESS

**Time (Asia/Taipei):** ${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}  
**Config:** \`with_skill\` = current SYSTEM${iteration > 1 ? ` (rewrite vs iteration-${iteration - 1})` : " (baseline)"}  
**Hypothesis:** ${iteration > 1 ? "Bank-only chars + check field + legal theme anchors + temp 0.25 → lift one-shot pinyin; keep 网感/禁壳." : "Baseline — no rewrite."}  
**Evals:** ${progressRows.length} / ${data.evals.length}  
**Mean expectation pass rate:** ${(meanPass * 100).toFixed(1)}%  
**Evals with 100% expectations:** ${hardAllPass}/${progressRows.length}  
**JUDGE:** ${JUDGE ? "on" : "off"}  
**MAX_ATTEMPTS:** ${MAX_ATTEMPTS}

## How to review

1. Open static viewer: [\`review/index.html\`](./review/index.html)
2. Outputs tab — qualitative phrase / meme
3. Benchmark tab — pass rates
4. Reply with feedback (chat notes or \`feedback.json\`) **before** rewriting SYSTEM

## Per-eval

| Eval | Pass% | Phrase | Meme |
|------|-------|--------|------|
${progressRows
  .map(
    (r) =>
      `| ${r.name} | ${(r.pass_rate * 100).toFixed(0)}% (${r.passed}/${r.total}) | ${r.phrase.replace(/\|/g, "\\|")} | ${r.meme} |`,
  )
  .join("\n")}

## Next

- Human reviews viewer
- Then edit \`src/lib/deepseek.ts\` SYSTEM → \`iteration-${iteration + 1}\` with \`old_skill\` snapshot of this SYSTEM
`;

  writeFileSync(join(ws, "PROGRESS.md"), progressMd, "utf8");
  console.log(`\nPROGRESS: ${join(ws, "PROGRESS.md")}`);
  console.log(`REVIEW:   ${reviewOut}`);
  console.log(`Mean pass rate: ${(meanPass * 100).toFixed(1)}%`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
