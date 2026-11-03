# ky,zhyz

场景 → **一次**吐出六字（声母 k/y/zh/h/y/z）→ 过了才展示；不过则友好提示再点一次（不展示半成品）。

## Dev

```bash
export DEEPSEEK_API_KEY=sk-...
npm install
npm run dev
```

Open http://localhost:3000

## Test

```bash
npm test
npm run build
```

## Quality evals（开发 hillclimb SYSTEM）

见 [`evals/README.md`](evals/README.md)。

```bash
npm run eval:quality                 # 便宜：梗图硬门槛 + 毒测
EVAL_LIVE=1 npm run eval:quality     # 调 DeepSeek one-shot
EVAL_LIVE=1 EVAL_JUDGE=1 npm run eval:quality
```

改 `src/lib/deepseek.ts` 的 `SYSTEM` 后按上面顺序回归。

## API

`POST /api/generate` `{ "scene": "..." }` → SSE：`start` / `result`（PASS-only；失败无 slots）。

## Keyword meme pack

- Topics: `data/ky-zhyz-topics.json` — **100** topics（词表已去「野种/kyzhyz」污染）
- Matcher: `src/lib/topics.ts` — **scene-first**；phrase/gloss 去模板噪声后仅弱参考；无场景词 → `generic-abstract`
- Memes: `public/memes/*` — [MemeCrafters/meme-generator](https://github.com/MemeCrafters/meme-generator) (MIT) + ChineseBQB 备份 URL
- Provenance: `data/SOURCES.md`
- **Nothing is AI-generated.**
