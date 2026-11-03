# ky-zhyz SYSTEM hillclimb（skill-creator 形状）

给开发者优化 `src/lib/deepseek.ts` 里的 `SYSTEM` 用。  
**不是** Grok Bot skill；复用 Anthropic / Grok cowork **skill-creator** 的 evals → grade → aggregate → **static viewer** 流程。

## 文件

| 路径 | 作用 |
|------|------|
| `evals/evals.json` | skill-creator 金标：`prompt`(=scene)、`expectations[]`、`checks`（机检） |
| `evals/run_iteration.ts` | 跑 iteration-N：live 生成 → `grading.json` → aggregate → `review/index.html` |
| `evals/grade.ts` | 便宜 hard-gate（梗图/毒测，默认可无 API） |
| `evals/gold.json` | 旧扁平金标（已迁移到 evals.json；保留对照） |
| `kyzhyz-system-workspace/iteration-N/` | 每次 hillclimb 的产物 |

Helpers（不要改，直接调用）：

- `/home/box/agent-data/workflows/grok-skill-creator-cowork-style/scripts/aggregate_benchmark.py`
- `/home/box/agent-data/workflows/grok-skill-creator-cowork-style/eval-viewer/generate_review.py --static …`
- Grader 字段约定见同目录 `agents/grader.md`：`text` / `passed` / `evidence`

## Workspace 布局

```text
kyzhyz-system-workspace/
└── iteration-N/
    ├── SYSTEM.txt              # 本轮 SYSTEM 快照
    ├── PROGRESS.md
    ├── eval-<name>/
    │   ├── eval_metadata.json
    │   ├── grading.json          # 副本（方便浏览）
    │   └── with_skill/run-1/
    │       ├── outputs/          # phrase.json meme.json raw.txt transcript.md
    │       ├── grading.json      # aggregate 读取这里
    │       └── timing.json
    ├── benchmark.json
    ├── benchmark.md
    └── review/index.html         # 给人看的静态 viewer
```

`with_skill` = **当前** SYSTEM（viewer 配色约定）。下一轮可加 `old_skill` 快照做对比。

## 命令

```bash
# 1) 便宜硬门槛（梗图 scene-first + 野种毒测）— 默认无 API
npm run eval:quality

# 2) skill-creator iteration（要 DeepSeek key；写 workspace + viewer）
EVAL_LIVE=1 npm run eval:iteration
# 可选子集 / 下一轮：
EVAL_LIVE=1 npx tsx evals/run_iteration.ts --limit 12
EVAL_LIVE=1 npx tsx evals/run_iteration.ts --iteration 2

# 3) 附加 LLM judge（网感/主题 ≥4 写入额外 expectations）
EVAL_LIVE=1 EVAL_JUDGE=1 npm run eval:iteration
```

Key 从 `.env.local` 的 `DEEPSEEK_API_KEY` 读取。

## 推荐回路（先给人看再改 SYSTEM）

1. 确认 / 增补 `evals/evals.json`（discriminating expectations）
2. `EVAL_LIVE=1 npm run eval:iteration` → 打开 `kyzhyz-system-workspace/iteration-N/review/index.html`
3. 人在 chat 里给 feedback（或丢 `feedback.json`）
4. **再**改 `SYSTEM` → `iteration-(N+1)`，把上一轮 `SYSTEM.txt` 留作对照
5. 满意后再部署

**不要**在没给人看 static viewer 之前就大改 SYSTEM（skill-creator 铁律）。

## Expectations 质量（摘自 grader.md）

- 可验证、能区分好坏（对的过、错的挂）
- 避免「文件存在即可」式弱断言
- 毒测：日常 scene +「可以这很野种」**不得**命中 lebron
- 主题唯一性：`must_include_any` 线索至少命中一个
- one-shot：`attempts === 1`
