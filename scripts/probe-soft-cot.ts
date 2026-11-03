/**
 * Local probe: flash + thinking disabled + soft CoT prompt + JSON extract.
 */
import { existsSync, readFileSync } from "node:fs";
import { probeDeepSeekOnce } from "../src/lib/deepseek";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
  console.error("missing DEEPSEEK_API_KEY");
  process.exit(1);
}

const scenes = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "一个网名照烧猪排的人网恋被骗八千",
      "奶茶加错糖",
      "房租又涨",
    ];

async function main() {
  for (const scene of scenes) {
    const t0 = Date.now();
    const r = await probeDeepSeekOnce(scene, apiKey);
    const ms = Date.now() - t0;
    console.log(
      JSON.stringify(
        {
          scene,
          ms,
          model: r.model,
          thinkingFlag: r.thinking,
          reasoningEffort: r.reasoningEffort,
          reasoningLen: (r.reasoningContent || "").length,
          pass: r.validation.pass,
          phrase: r.phrase,
          gloss: r.gloss,
          rawHead: (r.raw || "").slice(0, 280).replace(/\n/g, " | "),
        },
        null,
        2,
      ),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
