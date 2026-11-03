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
 * Keyword-substring match over scene / phrase / gloss.
 * Score = sum of matched keyword lengths + 2 per hit.
 */
export function matchTopic(parts: {
  scene?: string;
  phrase?: string;
  gloss?: string;
}): TopicMatch {
  const hay = [parts.scene, parts.phrase, parts.gloss]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  let best: TopicMatch | null = null;

  for (const topic of data.topics) {
    const matched: string[] = [];
    let score = 0;
    for (const kw of topic.keywords) {
      const k = kw.toLowerCase();
      if (!k) continue;
      if (hay.includes(k)) {
        matched.push(kw);
        score += k.length;
      }
    }
    if (!matched.length) continue;
    score += matched.length * 2;
    if (
      !best ||
      score > best.score ||
      (score === best.score && matched.length > best.matchedKeywords.length)
    ) {
      best = { topic, score, matchedKeywords: matched, via: "keyword" };
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
