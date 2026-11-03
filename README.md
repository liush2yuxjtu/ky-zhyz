# ky,zhyz

场景 → 六字（声母 k/y/zh/h/y/z）→ 逐字注音校验 → 过了弹梗图。

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
```

## API

`POST /api/generate` `{ "scene": "..." }` → phrase + validation.


## Keyword meme pack

- Topics: `data/ky-zhyz-topics.json` — **100** hot ky,zhyz topics / centers
- Matcher: `src/lib/matchTopic.ts` — substring keyword hit on submit → popup meme
- Memes: `public/memes/*` — **60** files copied from [MemeCrafters/meme-generator](https://github.com/MemeCrafters/meme-generator) (MIT)
- Provenance: `public/memes/SOURCES.md`
- **Nothing is AI-generated.** Homemade SVG placeholders were removed. All popup images are real China-community 表情包 template frames.

On generate PASS: match scene+phrase keywords → show that topic's `memeSrc`; if no hit, fall back to `gorilla_throw` (real template).
