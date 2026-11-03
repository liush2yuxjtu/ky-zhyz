import topicsData from "../../data/ky-zhyz-topics.json";

export type TopicMeme = {
  /** Preferred: local MIT meme-generator asset under /public/memes */
  path?: string;
  /** Backup / secondary: ChineseBQB CDN URL */
  url: string;
  thumb?: string;
  source?: string;
  folder?: string;
  attribution?: string;
  localSource?: string;
};

export type Topic = {
  id: string;
  name: string;
  phrase: string;
  keywords: string[];
  note: string;
  meme: TopicMeme;
};

export type TopicMatch = {
  topic: Topic;
  score: number;
  matchedKeywords: string[];
  via: "keyword" | "fallback";
};

type TopicsFile = {
  topics: Topic[];
  fallback: Topic;
  fallbackId: string;
};

const data = topicsData as TopicsFile;

/** Tokens that must never drive celebrity/topic hits from phrase/gloss. */
export const TEMPLATE_NOISE = [
  "野种",
  "kyzhyz",
  "ky,zhyz",
  "ky zhyz",
  "可以这很",
  "这很",
  "可以",
  "狂野震撼亚洲",
  "狂野",
  "震撼",
  "亚洲",
] as const;

export function stripTemplateNoise(text: string): string {
  let out = text;
  for (const token of TEMPLATE_NOISE) {
    if (!token) continue;
    out = out.split(token).join(" ");
    // latin / mixed tokens: case-insensitive
    out = out.replace(new RegExp(escapeRegExp(token), "ig"), " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getAllTopics(): Topic[] {
  return data.topics;
}

export function getFallbackTopic(): Topic {
  return data.fallback;
}

export function memeSrc(topic: Topic): string {
  return topic.meme.path || topic.meme.url;
}

/**
 * Option A: only expose a meme URL on real keyword hits.
 * Fallback / score-0 / generic-abstract → null (hide「看梗图」).
 */
export function clientMemeSrc(match: TopicMatch): string | null {
  if (match.via !== "keyword" || match.score <= 0) return null;
  if (match.topic.id === "generic-abstract") return null;
  const src = memeSrc(match.topic);
  return src || null;
}

/**
 * Scene-first keyword match.
 * - Primary score from `scene` only.
 * - `phrase` / `gloss` are weak secondary, after stripping template noise
 *   (野种 / 可以这很 / kyzhyz …) so empty shells cannot hit celebrity bags.
 * - No scene keyword → honest fallback (generic-abstract), even if phrase
 *   alone would have matched a celebrity.
 */
export function matchTopic(parts: {
  scene?: string;
  phrase?: string;
  gloss?: string;
}): TopicMatch {
  const sceneHay = (parts.scene ?? "").toLowerCase();
  const weakHay = stripTemplateNoise(
    [parts.phrase, parts.gloss].filter(Boolean).join("\n"),
  ).toLowerCase();

  let best: TopicMatch | null = null;

  for (const topic of data.topics) {
    const matched: string[] = [];
    let score = 0;
    let sceneHits = 0;

    for (const kw of topic.keywords) {
      const k = kw.toLowerCase();
      if (!k) continue;
      if (sceneHay.includes(k)) {
        matched.push(kw);
        sceneHits += 1;
        // Strong: scene match
        score += k.length * 3 + 6;
      } else if (weakHay.includes(k)) {
        matched.push(`${kw}@weak`);
        // Weak: phrase/gloss only (post-noise)
        score += k.length * 0.5 + 1;
      }
    }

    // Require at least one scene hit for a non-fallback celebrity match.
    // Pure weak hits are ignored so 「可以这很野种」 cannot summon 勒布朗.
    if (sceneHits === 0) continue;
    if (!matched.length) continue;

    score += sceneHits * 2;
    if (
      !best ||
      score > best.score ||
      (score === best.score && sceneHits > countSceneMatches(best))
    ) {
      best = {
        topic,
        score,
        matchedKeywords: matched.filter((m) => !m.endsWith("@weak")),
        via: "keyword",
      };
    }
  }

  if (best) return best;
  return {
    topic: data.fallback,
    score: 0,
    matchedKeywords: [],
    via: "fallback",
  };
}

function countSceneMatches(m: TopicMatch): number {
  return m.matchedKeywords.length;
}
