import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUILT_WITH,
  generatePhraseTool,
  getCurrentResultTool,
  getSharePayloadTool,
  hasModelContext,
  registerKyZhyzWebMcpTools,
  setSlotLocksTool,
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
    opts?: { signal: AbortSignal },
  ) => Promise<unknown>;
};

function mockModelContext(registerTool: ReturnType<typeof vi.fn>) {
  return {
    registerTool,
    getTools: vi.fn(async () => []),
  };
}


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
      modelContext: mockModelContext(registerTool),
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

  it("registers all four tools via SDK with AbortSignal + builtWith", async () => {
    const ac = new AbortController();
    const reg = registerKyZhyzWebMcpTools(() => adapters, {
      signal: ac.signal,
      modelContext: mockModelContext(registerTool),
    });
    const results = await reg.ready;
    expect(results.map((r) => r.name)).toEqual([...TOOL_NAMES]);
    expect(results.every((r) => r.state === "registered")).toBe(true);
    expect(registerTool).toHaveBeenCalledTimes(4);
    expect(captured.map((t) => t.name)).toEqual([...TOOL_NAMES]);
    // SDK passes a per-tool register signal derived from the batch signal
    expect(registerTool.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(BUILT_WITH).toBe("webmcp-kit/connect-existing-tools@mcp");
    // stableKeys + explicit wire names on defineTool exports
    expect(generatePhraseTool.stableKey).toBe("adopted.generate_phrase");
    expect(generatePhraseTool.name).toBe("generate_phrase");
    expect(generatePhraseTool.source).toBe("merchant_authored");
    expect(getCurrentResultTool.stableKey).toBe("adopted.get_current_result");
    expect(setSlotLocksTool.stableKey).toBe("adopted.set_slot_locks");
    expect(getSharePayloadTool.stableKey).toBe("adopted.get_share_payload");
    reg.unregister();
  });

  it("generate_phrase happy path", async () => {
    registerKyZhyzWebMcpTools(() => adapters, {
      modelContext: mockModelContext(registerTool),
    });
    expect(generatePhraseTool.annotations).toEqual({
      untrustedContentHint: true,
    });
    const out = (await generatePhraseTool.execute(
      { scene: "奶茶加错糖" },
      { signal: new AbortController().signal },
    )) as Record<string, unknown>;
    expect(out.ok).toBe(true);
    expect(out.display).toBe("垮又再会硬造");
    expect(adapters.generate).toHaveBeenCalled();
  });

  it("generate_phrase missing scene resolves structured error", async () => {
    board = emptyBoard();
    registerKyZhyzWebMcpTools(() => adapters, {
      modelContext: mockModelContext(registerTool),
    });
    const out = (await generatePhraseTool.execute(
      {},
      { signal: new AbortController().signal },
    )) as Record<string, unknown>;
    expect(out.error).toBeTruthy();
    expect(out.code).toBe("MISSING_SCENE");
    expect(out.retryable).toBe(false);
  });

  it("get_current_result is readOnly and returns board", async () => {
    registerKyZhyzWebMcpTools(() => adapters, {
      modelContext: mockModelContext(registerTool),
    });
    expect(getCurrentResultTool.annotations?.readOnlyHint).toBe(true);
    expect(getCurrentResultTool.annotations?.untrustedContentHint).toBe(true);
    const out = (await getCurrentResultTool.execute(
      {},
      { signal: new AbortController().signal },
    )) as Record<string, unknown>;
    expect(out.display).toBe("垮又再会硬造");
    expect(out.meme_available).toBe(true);
  });

  it("set_slot_locks forbids locking all six", async () => {
    registerKyZhyzWebMcpTools(() => adapters, {
      modelContext: mockModelContext(registerTool),
    });
    expect(setSlotLocksTool.annotations).toBeUndefined();
    const out = (await setSlotLocksTool.execute(
      { indices: [0, 1, 2, 3, 4, 5] },
      { signal: new AbortController().signal },
    )) as Record<string, unknown>;
    expect(out.code).toBe("LOCK_ALL_FORBIDDEN");
  });

  it("set_slot_locks happy path", async () => {
    registerKyZhyzWebMcpTools(() => adapters, {
      modelContext: mockModelContext(registerTool),
    });
    const out = (await setSlotLocksTool.execute(
      { indices: [0, 1] },
      { signal: new AbortController().signal },
    )) as Record<string, unknown>;
    expect(out.ok).toBe(true);
    expect(out.locked_count).toBe(2);
  });

  it("get_share_payload builds wechat copy + url", async () => {
    registerKyZhyzWebMcpTools(() => adapters, {
      modelContext: mockModelContext(registerTool),
    });
    expect(getSharePayloadTool.annotations?.readOnlyHint).toBe(true);
    const out = (await getSharePayloadTool.execute(
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
    registerKyZhyzWebMcpTools(() => adapters, {
      modelContext: mockModelContext(registerTool),
    });
    const out = (await getSharePayloadTool.execute(
      { platform: "moments" },
      { signal: new AbortController().signal },
    )) as Record<string, unknown>;
    expect(out.code).toBe("NO_RESULT");
  });

  it("no-ops when modelContext missing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).document = {};
    const reg = registerKyZhyzWebMcpTools(() => adapters);
    const results = await reg.ready;
    expect(results).toEqual([]);
    expect(reg.current()).toEqual([]);
  });
});
