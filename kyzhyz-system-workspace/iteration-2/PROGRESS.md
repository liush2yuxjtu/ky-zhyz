# SYSTEM hillclimb — iteration-2 PROGRESS

**Time (Asia/Taipei):** 2026/11/3 下午7:45:34  
**Config:** `with_skill` = current SYSTEM (rewrite vs iteration-1)  
**Hypothesis:** Bank-only chars + check field + legal theme anchors + temp 0.25 → lift one-shot pinyin; keep 网感/禁壳.  
**Evals:** 28 / 28  
**Mean expectation pass rate:** 92.1%  
**Evals with 100% expectations:** 21/28  
**JUDGE:** off  
**MAX_ATTEMPTS:** 1

## How to review

1. Open static viewer: [`review/index.html`](./review/index.html)
2. Outputs tab — qualitative phrase / meme
3. Benchmark tab — pass rates
4. Reply with feedback (chat notes or `feedback.json`) **before** rewriting SYSTEM

## Per-eval

| Eval | Pass% | Phrase | Meme |
|------|-------|--------|------|
| lebron-slam | 100% (5/5) | 靠腰詹皇又作 | lebron/keyword |
| lebron-name | 100% (5/5) | 靠腰詹皇又砸 | lebron/keyword |
| canyon-samus | 100% (5/5) | 靠又转皇野砸 | canyon/keyword |
| cxk-basketball | 100% (5/5) | 坤又这黑一遭 | caixukun/keyword |
| lei-jun | 100% (5/5) | 空言这哄又栽 | leijun/keyword |
| paper-review | 80% (4/5) | 看言这狠要砸 | generic-abstract/fallback |
| milk-tea | 100% (6/6) | 坑饮这喝冤种 | generic-abstract/fallback |
| kaoyan | 100% (6/6) | 考研这毁一栽 | zhangxuefeng/keyword |
| monday-work | 100% (6/6) | 空言这哄又栽 | generic-abstract/fallback |
| overtime | 100% (5/5) | 苦夜这活又砸 | generic-abstract/fallback |
| subway | 100% (5/5) | 靠拥这狠一栽 | generic-abstract/fallback |
| delivery | 80% (4/5) | 快言这火一砸 | generic-abstract/fallback |
| rent | 100% (5/5) | 坑呀涨狠要砸 | generic-abstract/fallback |
| gym | 100% (5/5) | 卡又这狠要砸 | generic-abstract/fallback |
| game-rank | 100% (5/5) | 坑友这火又栽 | generic-abstract/fallback |
| stock | 100% (5/5) | 亏呀这还一栽 | generic-abstract/fallback |
| hospital | 80% (4/5) | 看又这活冤种 | generic-abstract/fallback |
| parent-call | 80% (4/5) | 空又这哄要栽 | generic-abstract/fallback |
| interview | 40% (2/5) | (fail: 这波没凑齐 ky,zhyz，点一下再试一次就好。) | generic-abstract/fallback |
| bilibili | 100% (5/5) | 看页这黑又砸 | generic-abstract/fallback |
| cat-vet | 80% (4/5) | 看医这狠要砸 | generic-abstract/fallback |
| iphone-drop | 100% (5/5) | 快呀这狠一砸 | generic-abstract/fallback |
| diet | 100% (5/5) | 快夜这狠要炸 | generic-abstract/fallback |
| poison-shell-meme | 100% (5/5) | 靠哟这黑雨砸 | generic-abstract/fallback |
| lbj-english | 100% (4/4) | 靠腰詹皇又作 | lebron/keyword |
| hotpot | 40% (2/5) | (fail: 这波没凑齐 ky,zhyz，点一下再试一次就好。) | generic-abstract/fallback |
| deadline | 100% (5/5) | 快夜这活要栽 | generic-abstract/fallback |
| sleep | 100% (5/5) | 苦夜这黑又栽 | generic-abstract/fallback |


## vs iteration-1

| Metric | iteration-1 | iteration-2 | Delta |
|--------|-------------|-------------|-------|
| Mean expectation pass | 72.7% | 92.1% | +19.4 pp |
| Full-pass evals (100%) | 7/28 | 21/28 | +14 |
| One-shot pinyin FAIL (no phrase) | 9 | 2 | -7 |

**Hypothesis (held):** bank-only chars + `check` field + legal theme anchors + temp 0.25 → lift one-shot pinyin while keeping 网感/禁壳.

**Remaining FAIL-ish:** interview, hotpot (pinyin miss); paper-review/delivery/hospital/parent-call/cat-vet (theme clue miss at 80%).

## Next

- Human reviews viewer
- Then edit `src/lib/deepseek.ts` SYSTEM → `iteration-3` with `old_skill` snapshot of this SYSTEM
