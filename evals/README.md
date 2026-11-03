# ky-zhyz quality evals（开发用）

给开发者 hillclimb `src/lib/deepseek.ts` 里的 `SYSTEM` 提示词用。  
**不进用户 UI**，也不接 Amplitude。

## 文件

| 文件 | 作用 |
|------|------|
| `gold.json` | ~28 条金标：场景、主题线索、禁壳正则、期望梗图 |
| `grade.ts` | 机检 grader：梗图 scene-first、毒测、可选 live 生成 / LLM judge |
| `../src/lib/deepseek.ts` → `SYSTEM` | 被优化的对象 |

## 默认（便宜，无 API）

```bash
npm run eval:quality
```

会跑：

1. **Hard**：`matchTopic` 对每条 gold 的 `expected_meme`（含 `poison_phrase` 毒测：奶茶/考研 +「可以这很野种」不得命中 lebron）
2. **Soft**：空壳正则探测器自检

不过硬门槛 → exit 1。

## Live 生成（要 DeepSeek key）

```bash
export DEEPSEEK_API_KEY=sk-...
EVAL_LIVE=1 npm run eval:quality
```

对每条 scene **只调一次** `generateKyZhyz`（`MAX_ATTEMPTS=1`），检查：

- 返回 `attempts === 1`
- PASS 句过拼音校验
- live 后的梗图仍 scene-first
- soft：是否空壳「可以这很X种」、是否碰到 `must_include_any` 主题线索

## LLM-as-judge（网感 / 主题唯一性）

```bash
EVAL_LIVE=1 EVAL_JUDGE=1 npm run eval:quality
```

对每条成功句再请 DeepSeek 打 1–5 分（网感、主题唯一性）。&lt;4 记 soft WARN，方便对比 SYSTEM 改动；默认不挡 hard。

## 推荐迭代顺序

1. 改 `SYSTEM`（或 meme 词表 / `matchTopic`）
2. `npm test`（单测）
3. `npm run eval:quality`（硬门槛）
4. `EVAL_LIVE=1 npm run eval:quality`（抽样语义）
5. 满意再 `EVAL_LIVE=1 EVAL_JUDGE=1` 看均分
6. 提交 / 部署

本地若要试验多轮 repair（勿用于生产）：

```bash
KY_ZHYZ_MAX_ATTEMPTS=3 EVAL_LIVE=1 npm run eval:quality
```

生产环境保持 `MAX_ATTEMPTS=1`（默认）。
