/**
 * Local probe: DeepSeek flash (thinking disabled by default; soft CoT in prompt).
 * Does not hit the public API route — imports probeDeepSeekOnce only.
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
  console.error("Missing DEEPSEEK_API_KEY");
  process.exit(1);
}

const foodLeakRe = /油|猪|排|烧|照|饭|面|餐/;

async function run(label: string, scene: string) {
  console.log("\n====", label, "====");
  console.log("scene:", scene);
  const t0 = Date.now();
  try {
    const r = await probeDeepSeekOnce(scene, apiKey!);
    const ms = Date.now() - t0;
    const phrase = r.validation.chars.join("") || r.phrase;
    const leak = foodLeakRe.test(phrase);
    console.log(
      JSON.stringify(
        {
          model: r.model,
          thinking: r.thinking,
          reasoningEffort: r.reasoningEffort,
          ms,
          phrase,
          display: r.display,
          gloss: r.gloss,
          pass: r.validation.pass,
          foodishLeakInPhrase: leak,
          reasoningExcerpt: (r.reasoningContent || "").slice(0, 400),
          reasoningLen: (r.reasoningContent || "").length,
          rawExcerpt: (r.raw || "").slice(0, 200),
        },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error("FAIL", e);
    process.exitCode = 1;
  }
}

async function main() {
  const scam = "一个网名照烧猪排的人网恋被骗八千";
  await run("scam-1", scam);
  await run("scam-2", scam);
  await run("scam-3", scam);
  await run("control-奶茶", "奶茶");
}

main();
