# diversity probe

## Before (prod, no avoid) — 2026-11-03
scene: 打游戏被队友骂菜，还被挂机
runs: 6
unique: 4 (exact dup「坑友这黑又栽」×2; near-dup 坑友骨架)

1. FAIL
2. 坑友这火又栽
3. 坑友这黑又栽
4. 坑友嘴黑又栽
5. 坑友这狠又炸
6. 坑友这黑又栽

## After (avoid list + seed/penalties + collision redraw) — 2026-11-03
scene: 打游戏被队友骂菜，还被挂机
runs: 6
unique: 6
max same-slot overlap: 4 (still family resemblance; no exact dup)

1. 坑友这火怨炸
2. 坑友遭黑要栽
3. 坑友这活冤炸
4. 坑友这黑要炸
5. 快言贼火要栽
6. 坑友组黑夜炸

temperature: 1.15 + presence/frequency penalty + per-call seed
client: session avoid[] (last 8 PASS phrases)
server: overlap≥3 → up to 2 redraws; exact avoid never returned
