# ky,zhyz WebMCP — Autonomous Stages 1–4

Product: Next.js client toy — scene → six-char ky,zhyz (k/y/(z|zh)/h/y/z) + gloss; SlotBoard locks; ShareBar (WeChat/Moments/Weibo); optional meme.

## Stage 1 — Goals portfolio

### G1 Generate phrase from scene (P0)
- Ideal: PASS six-char phrase + gloss for the user's scene, board updates.
- Context: scene text (≤500); optional avoid list from session; optional locks.
- Boundary: do not invent a scene when empty — ask/clarify; generation is routine (no payment) — no consequentialHint.

### G2 Regenerate keeping locked chars (P0)
- Ideal: rewrite unlocked slots while keeping locked chars; board updates.
- Context: existing PASS board + lock mask (1–5 locks; never all six).
- Boundary: refuse lock-all; if no result yet, ask to generate first.

### G3 Read current result (P1)
- Ideal: agent can report phrase, gloss, locks, meme availability without mutating.
- Context: after at least one successful generate (or empty state).
- Boundary: none beyond read-only.

### G4 Prepare China share payload (P1)
- Ideal: WeChat 口令 / Moments caption / Weibo title + attributed URL (utm + sharer_id).
- Context: current display + gloss.
- Boundary: string build only (no download/post); do not post to social without user.

### G5 Meme topic (folded into G3)
- Ideal: know whether「看梗图」is available; title if any.
- Folded into `get_current_result` (no separate tool).

## Stage 2 — Starting states (per goal)

| Goal | Route | Loaded | Agent | Constraints |
|------|-------|--------|-------|-------------|
| G1 | `/` | empty or prior scene | fresh or mid-chat | API key server-side; network |
| G2 | `/` | slots filled; some locks | knows prior phrase | cannot lock 6/6 |
| G3 | `/` | empty OR filled | — | — |
| G4 | `/` | filled display+gloss | — | needs result |

Pruned: battery, DPI, GPU.

## Stage 3 — Role-plays (self-critique after each)

### G1 Turn — generate
- User: "帮我把『排位连跪被坑队友甩锅』翻成 ky,zhyz"
- Intent: extract scene; call generate_phrase
- Call: `generate_phrase({ scene: "排位连跪被坑队友甩锅" })`
- Tool: `{ ok:true, display:"…", gloss:"…", phrase:"…", attempts:1, meme_available:true }`
- UI: SlotBoard fills; ShareBar appears
- Agent: presents phrase + gloss; offers lock/regenerate or share
- Self-critique: tone concise OK; scene present so no clarify; autonomous OK (non-consequential)

### G2 Turn — locks then regenerate
- User: "锁住前两个字，其余重造"
- Intent: set locks [0,1]; regenerate with current scene
- Calls: `set_slot_locks({ indices:[0,1] })` then `generate_phrase({})` (uses current scene + locks)
- Tool: locks ok → generate ok with same first two chars
- UI: lock chips; "带着锁字再生成"
- Self-critique: clarify if no board; refuse lock-all

### G3 Turn — read
- User: "现在板上是啥？"
- Call: `get_current_result({})`
- Tool: structured board snapshot (or empty hint)
- Self-critique: read-only; untrustedContent on phrase/gloss

### G4 Turn — share
- User: "给我微信口令文案"
- Call: `get_share_payload({ platform: "wechat" })`
- Tool: `{ platform, copy, url }` — agent shows copy; user pastes
- Self-critique: no auto-post; untrustedContent on copy

## Stage 4 — Variations

1. Missing scene → generate_phrase returns `{ error, code:"MISSING_SCENE", retryable:false }`; agent asks for scene.
2. set_slot_locks with no board → `NO_RESULT`.
3. lock indices [0,1,2,3,4,5] → `LOCK_ALL_FORBIDDEN`.
4. get_share_payload with empty board → `NO_RESULT`.
5. Coreference "再来一次" → generate_phrase without scene (reuse current).
6. Service fail → `{ code:"GENERATE_FAILED", retryable:true }`.

## Consolidated tools (Stage 5 input)
1. generate_phrase
2. get_current_result
3. set_slot_locks
4. get_share_payload
