# Impeccable critique + triage — ky-zhyz home
Date: 2026-11-03 Asia/Taipei
Target: src/app/page.tsx (+ SlotBoard, MemePop)
Mode: Operate
⚠️ DEGRADED: single-context (Task subagent tool rejects `prompt`; Assessment A/B ran inline). Detector CLI: exit 0, findings []. Browser overlay skipped (computerUse/Task broken; Browser-use daemon down).

## Ship
Ready to ship: yes, with fixes (0 blocking after triage batch; should-fix addressed in same commit).

## Findings → triage

### should-fix (fix now)
1. Placeholder contrast `text-mute/60` on ink fails ~2.x:1 — criterion/a11y. Fix: use `text-mute` or dedicated `--mute-strong`.
2. Example chips `py-1 text-[12px]` touch targets <44px. Fix: `min-h-11 px-3`.
3. Kicker「试试」eyebrow above chips — craft-floor ban. Fix: drop label; chips speak alone (title attr keeps scene).
4. MemePop dialog: no Escape, no aria-modal, no initial focus. Fix: Escape + aria-modal + focus close.
5. SlotBoard slot3 label still `zh` only after z|zh rule. Fix: show `z/zh`.
6. `prefers-reduced-motion` global 0.01ms kill — audit flags. Fix: only kill decorative slot/meme animations.
7. Textarea cannot submit via Ctrl/Cmd+Enter. Fix: keydown handler.

### note
- Neon cyberpunk is product-specific (OK specificity), not generic SaaS cards.
- Sticky mobile CTA is good; desktop primary weight OK.
- Detector clean on TSX.

### dismissed
- Taste on magenta/lime palette (incumbent world).
- Full PRODUCT.md init (offer later).

## Questions skipped: user asked review+triage fix (GO); no command picker.
