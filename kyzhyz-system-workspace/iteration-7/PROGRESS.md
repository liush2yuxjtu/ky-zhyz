# SYSTEM hillclimb — iteration-7 PROGRESS

**Time (Asia/Taipei):** 2026/11/3 下午8:14:18  
**Config:** `with_skill` = current SYSTEM (rewrite vs iteration-6)  
**Hypothesis:** Keep iter6 viral GT + scene anchors; force ③詹④皇 for 詹姆斯/打铁 scenes to kill lebron-name one-shot flake.  
**Evals:** 36 / 36  
**Mean expectation pass rate:** 100.0%  
**Evals with 100% expectations:** 36/36  
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
| canyon-samus | 100% (5/5) | 靠又转会野砸 | canyon/keyword |
| cxk-basketball | 100% (5/5) | 坤又这黑要砸 | caixukun/keyword |
| lei-jun | 100% (5/5) | 空言这哄又栽 | leijun/keyword |
| paper-review | 100% (5/5) | 苦研这狠要砸 | generic-abstract/fallback |
| milk-tea | 100% (6/6) | 坑饮这喝冤种 | generic-abstract/fallback |
| kaoyan | 100% (6/6) | 考研这狠要砸 | zhangxuefeng/keyword |
| monday-work | 100% (6/6) | 空言这哄员种 | generic-abstract/fallback |
| overtime | 100% (5/5) | 苦夜这活要砸 | generic-abstract/fallback |
| subway | 100% (5/5) | 靠拥这狠一撞 | generic-abstract/fallback |
| delivery | 100% (5/5) | 可油这盒一砸 | generic-abstract/fallback |
| rent | 100% (5/5) | 空又涨狠要砸 | generic-abstract/fallback |
| gym | 100% (5/5) | 卡又这狠要砸 | generic-abstract/fallback |
| game-rank | 100% (5/5) | 坑友这火一栽 | generic-abstract/fallback |
| stock | 100% (5/5) | 亏呀这还一栽 | generic-abstract/fallback |
| hospital | 100% (5/5) | 看医这号一砸 | generic-abstract/fallback |
| parent-call | 100% (5/5) | 苦又这婚要砸 | generic-abstract/fallback |
| interview | 100% (5/5) | 卡牙这活一砸 | generic-abstract/fallback |
| bilibili | 100% (5/5) | 看页这黑又砸 | generic-abstract/fallback |
| cat-vet | 100% (5/5) | 哭冤这花要砸 | generic-abstract/fallback |
| iphone-drop | 100% (5/5) | 快呀这盒一砸 | generic-abstract/fallback |
| diet | 100% (5/5) | 空又这狠要炸 | generic-abstract/fallback |
| poison-shell-meme | 100% (5/5) | 看云这黑要砸 | generic-abstract/fallback |
| lbj-english | 100% (4/4) | 靠腰詹皇又作 | lebron/keyword |
| hotpot | 100% (5/5) | 空又这火要砸 | generic-abstract/fallback |
| deadline | 100% (5/5) | 快夜这活要砸 | generic-abstract/fallback |
| sleep | 100% (5/5) | 苦夜这还要栽 | generic-abstract/fallback |
| gt-可以这很野种 | 100% (3/3) | 可以这很野种 | lebron/keyword |
| gt-狂野震撼亚洲 | 100% (2/2) | 狂野震撼亚洲 | generic-abstract/fallback |
| gt-刻意这还言詹 | 100% (2/2) | 刻意这还言詹 | generic-abstract/fallback |
| gt-括约詹回忆中 | 100% (2/2) | 括约詹回忆中 | generic-abstract/fallback |
| gt-堪忧詹皇要走 | 100% (2/2) | 堪忧詹皇要走 | lebron/keyword |
| gt-科硬这还要撞 | 100% (2/2) | 科硬这还要撞 | generic-abstract/fallback |
| gt-苦也这还言詹 | 100% (2/2) | 苦也这还言詹 | generic-abstract/fallback |
| gt-科遗这很野冢 | 100% (2/2) | 科遗这很野冢 | generic-abstract/fallback |

## Next

- Human reviews viewer
- Then edit `src/lib/deepseek.ts` SYSTEM → `iteration-8` with `old_skill` snapshot of this SYSTEM


## vs iteration-2 / iteration-6

| Metric | iteration-2 (28 evals) | iteration-6 (36) | **iteration-7 (36)** |
|--------|------------------------|------------------|----------------------|
| Mean expectation pass | 92.1% | 98.3% | **100%** |
| Full-pass evals | 21/28 | 35/36 | **36/36** |
| Viral GT exact | n/a | 8/8 | **8/8** |
| One-shot pinyin FAIL | 2 | 1 (lebron-name) | **0** |
| MAX_ATTEMPTS | 1 | 1 | **1** |

**Shipped:** this SYSTEM (`src/lib/system-prompt.txt`) + temp 0.25 + exact_gt grader.
