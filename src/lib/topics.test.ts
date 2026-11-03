import { describe, expect, it } from "vitest";
import {
  matchTopic,
  memeSrc,
  getAllTopics,
  stripTemplateNoise,
} from "./topics";

describe("matchTopic", () => {
  it("loads 100 topics", () => {
    expect(getAllTopics().length).toBe(100);
  });

  it("lebron keywords no longer include 野种 / kyzhyz pollution", () => {
    const lebron = getAllTopics().find((t) => t.id === "lebron");
    expect(lebron).toBeTruthy();
    const bad = (lebron?.keywords ?? []).filter((k) =>
      /野种|kyzhyz|ky,?zhyz/i.test(k),
    );
    expect(bad).toEqual([]);
  });

  it("hits lebron on 詹皇 / 詹姆斯", () => {
    const m1 = matchTopic({ scene: "詹皇又甩锅还说队友不懂球" });
    expect(m1.via).toBe("keyword");
    expect(m1.topic.id).toBe("lebron");
    expect(memeSrc(m1.topic)).toMatch(/^\/memes\//);

    const m2 = matchTopic({ scene: "詹姆斯今天又打铁了" });
    expect(m2.topic.id).toBe("lebron");
  });

  it("hits canyon on 三慕斯", () => {
    const m = matchTopic({ scene: "排位遇到三慕斯开大" });
    expect(m.topic.id).toBe("canyon");
  });

  it("奶茶 must NOT match lebron even if phrase is 可以这很野种", () => {
    const milk = matchTopic({
      scene: "排队半小时买奶茶还加错糖",
      phrase: "可以这很野种",
      gloss: "吐槽奶茶",
    });
    expect(milk.topic.id).not.toBe("lebron");
    expect(milk.via).toBe("fallback");
  });

  it("考研 scene-first hits zhangxuefeng, never lebron via 野种", () => {
    const kao = matchTopic({
      scene: "考研英语阅读又错一片",
      phrase: "可以这很野种",
      gloss: "野种",
    });
    expect(kao.topic.id).not.toBe("lebron");
    expect(kao.topic.id).toBe("zhangxuefeng");
    expect(kao.via).toBe("keyword");
  });

  it("周一上班 / daily scene → honest fallback", () => {
    const m = matchTopic({
      scene: "周一上班被老板画饼",
      phrase: "可以这很野种",
    });
    expect(m.via).toBe("fallback");
    expect(m.topic.id).toBe("generic-abstract");
  });

  it("falls back when no keyword", () => {
    const m = matchTopic({ scene: "今天午饭吃了面" });
    expect(m.via).toBe("fallback");
    expect(m.topic.id).toBe("generic-abstract");
  });

  it("stripTemplateNoise removes shell tokens", () => {
    expect(stripTemplateNoise("可以这很野种")).not.toContain("野种");
    expect(stripTemplateNoise("ky,zhyz 野种")).not.toMatch(/野种|ky/i);
  });
});
