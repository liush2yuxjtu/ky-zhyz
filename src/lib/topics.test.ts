import { describe, expect, it } from "vitest";
import { matchTopic, memeSrc, getAllTopics } from "./topics";

describe("matchTopic", () => {
  it("loads 100 topics", () => {
    expect(getAllTopics().length).toBe(100);
  });

  it("hits lebron on 詹皇", () => {
    const m = matchTopic({ scene: "詹皇又野了一波" });
    expect(m.via).toBe("keyword");
    expect(m.topic.id).toBe("lebron");
    expect(memeSrc(m.topic)).toMatch(/^\/memes\//);
  });

  it("hits canyon on 三慕斯", () => {
    const m = matchTopic({ scene: "排位遇到三慕斯开大" });
    expect(m.topic.id).toBe("canyon");
  });

  it("falls back when no keyword", () => {
    const m = matchTopic({ scene: "今天午饭吃了面" });
    expect(m.via).toBe("fallback");
    expect(m.topic.id).toBe("generic-abstract");
  });
});
