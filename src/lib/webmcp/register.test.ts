import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasModelContext,
  registerKyZhyzWebMcpTools,
  TOOL_NAMES,
} from "./register";
import type { KyZhyzWebMcpAdapters, WebMcpBoardSnapshot } from "./types";

type CapturedTool = {
  name: string;
  description: string;
  annotations?: Record<string, boolean>;
  inputSchema?: object;
  execute: (
    input: Record<string, unknown>,
    opts: { signal: AbortSignal },
  ) => Promise<unknown>;
};

function emptyBoard(over: Partial<WebMcpBoardSnapshot> = {}): WebMcpBoardSnapshot {
  return {
    scene: "",
    display: "",
    gloss: "",
    phrase: "",
    slots: null,
    locked: [false, false, false, false, false, false],
    memeAvailable: false,
    memeTitle: "",
    loading: false,
    error: null,
    ...over,
  };
}

describe("hasModelContext", () => {
  it("is false without document.modelContext", () => {
    // jsdom/node may lack modelContext
    expect(hasModelContext()).toBe(false);
  });
});

describe("registerKyZhyzWebMcpTools", () => {
  let captured: CapturedTool[];
  let registerTool: ReturnType<typeof vi.fn>;
  let board: WebMcpBoardSnapshot;
  let adapters: KyZhyzWebMcpAdapters;

  beforeEach(() => {
    captured = [];
    registerTool = vi.fn(async (tool: CapturedTool) => {
      captured.push(tool);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).document = {
      modelContext: { registerTool },
    };

    board = emptyBoard({
      scene: "排位连跪",
      display: "垮又再会硬造",
      gloss: "连跪甩锅",
      phrase: "垮又再会硬造",
      slots: [
        { char: "垮", index: 0, expected: "k", pass: true },
        { char: "又", index: 1, expected: "y", pass: true },
        { char: "再", index: 2, expected: "zh", pass: true },
        { char: "会", index: 3, expected: "h", pass: true },
        { char: "硬", index: 4, expected: "y", pass: true },
        { char: "造", index: 5, expected: "z", pass: true },
      ],
      memeAvailable: true,
      memeTitle: "排位",
    });

    adapters = {
      getBoard: () => board,
      setScene: (s) => {
        board = { ...board, scene: s };
      },
      applyLocks: (indices) => {
        if (!board.slots) {
          return {
            ok: false as const,
            error: "No phrase on the board yet. Generate first.",
            code: "NO_RESULT",
            retryable: false,
          };
        }
        const locked = [false, false, false, false, false, false];
        for (const i of indices) locked[i] = true;
        board = { ...board, locked };
        return { ok: true as const, locked };
      },
      generate: vi.fn(async ({ scene, lockIndices }) => {
        if (lockIndices) {
          const locked = [false, false, false, false, false, false];
          for (const i of lockIndices) locked[i] = true;
          board = { ...board, locked };
        }
        if (scene) board = { ...board, scene };
        return {
          ok: true as const,
          display: "垮又再会硬造",
          gloss: "连跪甩锅",
          phrase: "垮又再会硬造",
          attempts: 1,
          memeAvailable: true,
          memeTitle: "排位",
        };
      }),
      getSharerId: () => "deadbeef",
    };
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).document;
    vi.restoreAllMocks();
  });

  it("registers all four tools with AbortSignal", async () => {
    const ac = new AbortController();
    const names = await registerKyZhyzWebMcpTools(() => adapters, ac.signal);
    expect(names).toEqual([...TOOL_NAMES]);
    expect(registerTool).toHaveBeenCalledTimes(4);
    expect(captured.map((t) => t.name)).toEqual([...TOOL_NAMES]);
    // second arg includes signal
    expect(registerTool.mock.calls[0][1]).toEqual({ signal: ac.signal });
  });

  it("generate_phrase happy path", async () => {
    await registerKyZhyzWebMcpTools(() => adapters, new AbortController().signal);
    const tool = captured.find((t) => t.name === "generate_phrase")!;
    expect(tool.annotations).toEqual({ untrustedContentHint: true });
    const out = (await tool.execute(
      { scene: "奶茶加错糖" },
      { signal: new AbortController().signal },
    )) as Record<string, unknown>;
    expect(out.ok).toBe(true);
    expect(out.display).toBe("垮又再会硬造");
    expect(adapters.generate).toHaveBeenCalled();
  });

  it("generate_phrase missing scene resolves structured error", async () => {
    board = emptyBoard();
    await registerKyZhyzWebMcpTools(() => adapters, new AbortController().signal);
    const tool = captured.find((t) => t.name === "generate_phrase")!;
    const out = (await tool.execute(
      {},
      { signal: new AbortController().signal },
    )) as Record<string, unknown>;
    expect(out.error).toBeTruthy();
    expect(out.code).toBe("MISSING_SCENE");
    expect(out.retryable).toBe(false);
  });

  it("get_current_result is readOnly and returns board", async () => {
    await registerKyZhyzWebMcpTools(() => adapters, new AbortController().signal);
    const tool = captured.find((t) => t.name === "get_current_result")!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
    expect(tool.annotations?.untrustedContentHint).toBe(true);
    const out = (await tool.execute(
      {},
      { signal: new AbortController().signal },
    )) as Record<string, unknown>;
    expect(out.display).toBe("垮又再会硬造");
    expect(out.meme_available).toBe(true);
  });

  it("set_slot_locks forbids locking all six", async () => {
    await registerKyZhyzWebMcpTools(() => adapters, new AbortController().signal);
    const tool = captured.find((t) => t.name === "set_slot_locks")!;
    expect(tool.annotations).toBeUndefined();
    const out = (await tool.execute(
      { indices: [0, 1, 2, 3, 4, 5] },
      { signal: new AbortController().signal },
    )) as Record<string, unknown>;
    expect(out.code).toBe("LOCK_ALL_FORBIDDEN");
  });

  it("set_slot_locks happy path", async () => {
    await registerKyZhyzWebMcpTools(() => adapters, new AbortController().signal);
    const tool = captured.find((t) => t.name === "set_slot_locks")!;
    const out = (await tool.execute(
      { indices: [0, 1] },
      { signal: new AbortController().signal },
    )) as Record<string, unknown>;
    expect(out.ok).toBe(true);
    expect(out.locked_count).toBe(2);
  });

  it("get_share_payload builds wechat copy + url", async () => {
    await registerKyZhyzWebMcpTools(() => adapters, new AbortController().signal);
    const tool = captured.find((t) => t.name === "get_share_payload")!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
    const out = (await tool.execute(
      { platform: "wechat" },
      { signal: new AbortController().signal },
    )) as Record<string, unknown>;
    expect(out.platform).toBe("wechat");
    expect(String(out.copy)).toContain("垮又再会硬造");
    expect(String(out.url)).toContain("utm_medium=wechat");
    expect(String(out.url)).toContain("sharer_id=deadbeef");
  });

  it("get_share_payload NO_RESULT when empty board", async () => {
    board = emptyBoard();
    await registerKyZhyzWebMcpTools(() => adapters, new AbortController().signal);
    const tool = captured.find((t) => t.name === "get_share_payload")!;
    const out = (await tool.execute(
      { platform: "moments" },
      { signal: new AbortController().signal },
    )) as Record<string, unknown>;
    expect(out.code).toBe("NO_RESULT");
  });

  it("no-ops when modelContext missing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).document = {};
    const names = await registerKyZhyzWebMcpTools(
      () => adapters,
      new AbortController().signal,
    );
    expect(names).toEqual([]);
  });
});
