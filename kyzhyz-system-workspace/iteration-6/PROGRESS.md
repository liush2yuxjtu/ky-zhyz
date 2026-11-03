# SYSTEM hillclimb — iteration-6 PROGRESS

**Time (Asia/Taipei):** 2026/11/3 下午8:13:18  
**Config:** `with_skill` = current SYSTEM (rewrite vs iteration-5)  
**Hypothesis:** Bank-only chars + check field + legal theme anchors + temp 0.25 → lift one-shot pinyin; keep 网感/禁壳.  
**Evals:** 36 / 36  
**Mean expectation pass rate:** 98.3%  
**Evals with 100% expectations:** 35/36  
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
| lebron-name | 40% (2/5) | (fail: 这波没凑齐 ky,zhyz，点一下再试一次就好。) | lebron/keyword |
| canyon-samus | 100% (5/5) | 靠又转会野砸 | canyon/keyword |
| cxk-basketball | 100% (5/5) | 坤又这黑要砸 | caixukun/keyword |
| lei-jun | 100% (5/5) | 空言这哄又栽 | leijun/keyword |
| paper-review | 100% (5/5) | 苦研这狠要砸 | generic-abstract/fallback |
| milk-tea | 100% (6/6) | 坑饮这喝冤种 | generic-abstract/fallback |
| kaoyan | 100% (6/6) | 考研这狠要砸 | zhangxuefeng/keyword |
| monday-work | 100% (6/6) | 空言这哄员种 | generic-abstract/fallback |
| overtime | 100% (5/5) | 苦夜这活要炸 | generic-abstract/fallback |
| subway | 100% (5/5) | 靠拥这狠要砸 | generic-abstract/fallback |
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
| diet | 100% (5/5) | 快夜这狠要砸 | generic-abstract/fallback |
| poison-shell-meme | 100% (5/5) | 看云这黑又砸 | generic-abstract/fallback |
| lbj-english | 100% (4/4) | 靠腰詹皇又作 | lebron/keyword |
| hotpot | 100% (5/5) | 空又这火要砸 | generic-abstract/fallback |
| deadline | 100% (5/5) | 快又这活要砸 | generic-abstract/fallback |
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
- Then edit `src/lib/deepseek.ts` SYSTEM → `iteration-7` with `old_skill` snapshot of this SYSTEM
