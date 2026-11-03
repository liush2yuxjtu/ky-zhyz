# ky-zhyz SYSTEM hillclimb progress

Goal: raise LLM-judge means (网感 / 主题唯一性) toward ≥4.0 on live successes, keep one-shot `MAX_ATTEMPTS=1`, hard meme guards green, kill empty shells.

Reproduce:

```bash
cd /workspace/ky-zhyz
set -a && source .env.local && set +a
npm run eval:quality                          # cheap hard meme/poison
EVAL_LIVE=1 EVAL_JUDGE=1 npm run eval:iteration
# or a numbered round:
EVAL_LIVE=1 EVAL_JUDGE=1 npx tsx evals/run_iteration.ts --iteration N
```

Artifacts: `kyzhyz-system-workspace/iteration-N/` (SYSTEM.txt, grading, `review/index.html`).

## Scoreboard

| Round | SYSTEM change (1 line) | hard | soft / live | judge mean 网感 | judge mean 主题 | notes |
|-------|------------------------|------|-------------|-----------------|-----------------|-------|
| R0 | Baseline (pre-hillclimb SYSTEM in `deepseek.ts`) | 28/28 | live 18/28, soft WARN≈27 | **3.06** | **3.44** | First `EVAL_LIVE+JUDGE` via `grade.ts`. Heavy 文言壳「客爷…冤哉」「冤哉」; 10 one-shot pinyin fails. |
| R1 | Long prompt: char banks + ban 文言 + force scene nouns | 28/28 | live 12/28, WARN 28 | **2.75** | **3.33** | Regressed. Model copied new shell「X这火一炸/栽」; more pinyin fails. |
| R2 | Diverse examples + ban「这火一炸」template | 28/28 | live ~8/28 (JUDGE harness mid-rewrite) | n/a (grade.ts lost JUDGE) | n/a | Parallel skill-creator scaffold landed (`eval:iteration`). Treat as failed exploration. |
| iter1 | Same as R0 SYSTEM; skill-creator baseline **no JUDGE** | 28/28 meme | live **19/28**, mean exp pass **73%** | — | — | Workspace baseline. Phrases still often「客爷…冤哉」. |
| iter2 | Strict banks + anchors + temp **0.7** | 28/28 | live **7/28**, exp pass **52%** | **3.57** | **3.71** | Best *conditional* quality, worst live rate. Over-constrained. |
| iter3 | Shorter “同义变形” SYSTEM, temp **0.9** | 28/28 | live **11/28**, exp pass **55%** | **3.09** | **3.55** | Slight live recovery; judge slipped. |
| iter4 | **Surgical** edit of R0: fix bad examples, ban 文言壳, 同义变形 tip | 28/28 | live **21/28**, exp pass **73%** | **3.33** | **3.52** | Best live among JUDGE rounds. Milk-tea→`坑饮这喝冤种`. |
| **iter5 (ship)** | Same surgical SYSTEM via `system-prompt.txt`; temp **0.85** | 28/28 | live **18/28**, exp pass **70%** | **3.50** | **3.61** | Best judge means with acceptable live. Still **short of ≥4.0**. |

Hard meme/poison stayed green every round. Empty shell「可以这很X种」did not reappear on live successes after R0.

## Before → after (worst cases)

| Scene | R0 / early | Best later | Delta |
|-------|------------|------------|-------|
| 排队买奶茶加错糖 | `客爷这喝冤哉` (网感2/主题4, 文言) | `坑饮这喝冤种` (网感4/主题3–4) | Dropped 客爷/哉 shell; kept drink anchor |
| 周一老板画饼 | `空言这哄愚众/愚者` (文言, 末字曾教坏「工」g≠z) | `空言这哄员种/栽` | Fixed example pinyin; less 愚* |
| 詹皇甩锅 | `靠腰詹皇倚责` (网感3) / often LIVE fail | `靠腰詹皇又作/砸` (网感4/主题3–4) | More stable celebrity hit |
| 外卖迟到 | `客爷这活冤哉` (网感2) | `扣爷这盒一砸` / `快怨这盒已砸` | Scene object「盒」in phrase |
| 排位连跪 | weak / fail | `坑友这火一栽` / `坑友这活冤种` | Teammate anchor |

## What worked / what did not

- **Worked:** Fixing *wrong* few-shot examples (「空言这哄员工」末字非法); banning 文言 default; 同义变形 tip; keeping prompt short; temp ~0.85–0.9 for live rate.
- **Did not:** Very long char-bank prompts (R1/iter2) → template collapse + pinyin death; temp 0.7 → live collapse; never reached mean judge ≥4.0 under one-shot.
- **Ceiling:** Six fixed initials + theme uniqueness + 网感 in one shot is tight. Further gains likely need either (a) silent ≤1 server repair (product option 6), (b) richer few-shots per domain, or (c) judge rubric calibration — not more prompt length.

## Shipped SYSTEM

Source of truth: `src/lib/system-prompt.txt` (imported as `SYSTEM_PROMPT` → `SYSTEM` in `src/lib/deepseek.ts`).  
Temperature: **0.85**. `MAX_ATTEMPTS=1`.

Selected round: **iter5** (best judge with live ≈ R0). If live rate is preferred over judge, prefer **iter4** snapshot under `kyzhyz-system-workspace/iteration-4/SYSTEM.txt` (same text, noisier temp env at the time).

## Next developer knobs

1. Re-run `EVAL_LIVE=1 EVAL_JUDGE=1 npm run eval:iteration` after any SYSTEM edit; compare `benchmark.md` + judge means in grading evidence.
2. Consider enabling `KY_ZHYZ_MAX_ATTEMPTS=2` only in eval to measure ceiling vs one-shot.
3. Tighten z-slot matching if product intent is “true z only, plus zhou/zhong whitelist” (today `bare.startsWith("z")` also accepts **zh*** syllables like 整/住).

## Note (iteration-2 executor)

Programmatic grader hillclimb **iteration-2** (bank anchors + check field + temp 0.25) measured:
- mean expectation pass **92.1%** (vs iter1 72.7%)
- full-pass **21/28**, one-shot pinyin FAIL **2** (vs 9)

A later JUDGE-oriented “surgical” SYSTEM at temp 0.85 was briefly on main with reported live ~18/28; production restored to iteration-2 SYSTEM because hard-gate pass rate is the developer gate for one-shot pinyin.
