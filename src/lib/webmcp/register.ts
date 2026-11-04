/// <reference types="webmcp-types" />

import {
  defineTool,
  registerTools,
  type ModelContextLike,
  type ToolRegistration,
} from "@nekuda/webmcp-sdk";
import {
  buildShareCopy,
  buildShareUrl,
  type ShareChannel,
} from "@/lib/share";
import type { KyZhyzWebMcpAdapters } from "./types";

const TOOL_NAMES = [
  "generate_phrase",
  "get_current_result",
  "set_slot_locks",
  "get_share_payload",
] as const;

export type RegisteredToolName = (typeof TOOL_NAMES)[number];

const BUILT_WITH = "webmcp-kit/connect-existing-tools@mcp" as const;

/** Bound just before registerTools; execute closes over this getter. */
let getAdaptersRef: (() => KyZhyzWebMcpAdapters) | null = null;

function getAdapters(): KyZhyzWebMcpAdapters {
  if (!getAdaptersRef) {
    throw new Error("WebMCP adapters not ready");
  }
  return getAdaptersRef();
}

export function hasModelContext(): boolean {
  return (
    typeof document !== "undefined" &&
    "modelContext" in document &&
    typeof document.modelContext?.registerTool === "function"
  );
}

function clipOutput(payload: unknown, max = 1500): unknown {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  if (raw.length <= max) return payload;
  if (typeof payload === "string") return `${raw.slice(0, max - 1)}…`;
  return {
    truncated: true,
    preview: raw.slice(0, max - 40),
    note: "Output truncated to 1500 chars; call get_current_result for a shorter snapshot.",
  };
}

function normalizeIndices(raw: unknown): number[] | { error: string; code: string; retryable: boolean } {
  if (!Array.isArray(raw)) {
    return {
      error: "indices must be an array of slot numbers 0–5.",
      code: "INVALID_INDICES",
      retryable: false,
    };
  }
  const out: number[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    const n = typeof item === "number" ? item : Number(item);
    if (!Number.isInteger(n) || n < 0 || n > 5) {
      return {
        error: `Invalid slot index ${String(item)}. Use integers 0–5.`,
        code: "INVALID_INDICES",
        retryable: false,
      };
    }
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

type GeneratePhraseInput = {
  scene?: string;
  lock_indices?: number[];
};

type SetSlotLocksInput = {
  indices: number[];
};

type GetSharePayloadInput = {
  platform: string;
};

/**
 * Case-2 migration: same wire names/schemas/handlers, registered through
 * @nekuda/webmcp-sdk defineTool + registerTools.
 */
export const generatePhraseTool = defineTool<GeneratePhraseInput>({
  stableKey: "adopted.generate_phrase",
  name: "generate_phrase",
  source: "merchant_authored",
  description:
    "Turns a scene into a six-character ky,zhyz phrase with gloss and updates the board. Use when the user wants a new or locked regenerate for a rant scene.",
  inputSchema: {
    type: "object",
    properties: {
      scene: {
        type: "string",
        description:
          "Scene to translate; omit to reuse the current scene on the page",
      },
      lock_indices: {
        type: "array",
        items: { type: "integer", minimum: 0, maximum: 5 },
        description:
          "Optional slot indices 0–5 to keep; cannot lock all six",
      },
    },
  },
  annotations: {
    untrustedContentHint: true,
  },
  async execute(input, context) {
    try {
      const adapters = getAdapters();
      const sceneIn =
        typeof input.scene === "string" ? input.scene.trim() : undefined;
      let lockIndices: number[] | undefined;
      if (input.lock_indices !== undefined) {
        const norm = normalizeIndices(input.lock_indices);
        if ("error" in norm) return norm;
        lockIndices = norm;
      }
      const board = adapters.getBoard();
      const scene = sceneIn || board.scene.trim();
      if (!scene) {
        return {
          error:
            "No scene yet. Ask the user for a short rant scene, then call generate_phrase with scene.",
          code: "MISSING_SCENE",
          retryable: false,
        };
      }
      if (sceneIn) adapters.setScene(sceneIn);
      // SDK: context.signal is the agent cancel (Chrome 153+); older Chrome omits context.
      const result = await adapters.generate({
        scene,
        lockIndices,
        signal: context?.signal,
      });
      if (!result.ok) {
        return {
          error: result.error,
          code: "GENERATE_FAILED",
          retryable: true,
        };
      }
      return clipOutput({
        ok: true,
        display: result.display,
        gloss: result.gloss,
        phrase: result.phrase,
        attempts: result.attempts,
        meme_available: result.memeAvailable,
        meme_title: result.memeTitle || undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "generate failed";
      return {
        error: msg,
        code: "GENERATE_FAILED",
        retryable: true,
      };
    }
  },
});

export const getCurrentResultTool = defineTool({
  stableKey: "adopted.get_current_result",
  name: "get_current_result",
  source: "merchant_authored",
  description:
    "Reads the current phrase, gloss, locks, and meme availability. Use when summarizing the board or before sharing without changing anything.",
  inputSchema: {
    type: "object",
    properties: {},
  },
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: true,
  },
  async execute() {
    try {
      const board = getAdapters().getBoard();
      if (!board.slots || !board.display) {
        return clipOutput({
          empty: true,
          scene: board.scene || null,
          hint: "No phrase on the board yet. Call generate_phrase with a scene first.",
          loading: board.loading,
          error: board.error,
        });
      }
      return clipOutput({
        scene: board.scene,
        display: board.display,
        gloss: board.gloss,
        phrase: board.phrase,
        locked: board.locked,
        slots: board.slots.map((s) => ({
          index: s.index,
          char: s.char,
          expected: s.expected,
          pass: s.pass,
        })),
        meme_available: board.memeAvailable,
        meme_title: board.memeTitle || undefined,
        loading: board.loading,
        error: board.error,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "read failed";
      return { error: msg, code: "READ_FAILED", retryable: false };
    }
  },
});

export const setSlotLocksTool = defineTool<SetSlotLocksInput>({
  stableKey: "adopted.set_slot_locks",
  name: "set_slot_locks",
  source: "merchant_authored",
  description:
    "Locks or clears character slots on the board before a regenerate. Use when the user wants to keep some chars and rewrite the rest.",
  inputSchema: {
    type: "object",
    properties: {
      indices: {
        type: "array",
        items: { type: "integer", minimum: 0, maximum: 5 },
        description:
          "Slot indices 0–5 to lock; empty array clears all locks",
      },
    },
    required: ["indices"],
  },
  async execute(input) {
    try {
      const norm = normalizeIndices(input.indices);
      if ("error" in norm) return norm;
      if (norm.length === 6) {
        return {
          error:
            "Cannot lock all six slots — leave at least one free to rewrite. Ask the user which slots to keep.",
          code: "LOCK_ALL_FORBIDDEN",
          retryable: false,
        };
      }
      const applied = getAdapters().applyLocks(norm);
      if (!applied.ok) {
        return {
          error: applied.error,
          code: applied.code,
          retryable: applied.retryable,
        };
      }
      return {
        ok: true,
        locked: applied.locked,
        locked_count: applied.locked.filter(Boolean).length,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "lock failed";
      return { error: msg, code: "LOCK_FAILED", retryable: false };
    }
  },
});

export const getSharePayloadTool = defineTool<GetSharePayloadInput>({
  stableKey: "adopted.get_share_payload",
  name: "get_share_payload",
  source: "merchant_authored",
  description:
    "Builds China-social share copy and an attributed URL for the current phrase. Use when the user wants WeChat paste text, Moments caption, or Weibo title—without posting.",
  inputSchema: {
    type: "object",
    properties: {
      platform: {
        type: "string",
        enum: ["wechat", "moments", "weibo", "copy"],
        description: "Share channel that shapes the copy template",
      },
    },
    required: ["platform"],
  },
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: true,
  },
  async execute(input) {
    try {
      const platform = String(input.platform || "") as ShareChannel;
      if (!["wechat", "moments", "weibo", "copy"].includes(platform)) {
        return {
          error:
            'platform must be one of: "wechat", "moments", "weibo", "copy".',
          code: "INVALID_PLATFORM",
          retryable: false,
        };
      }
      const board = getAdapters().getBoard();
      if (!board.display) {
        return {
          error:
            "No phrase to share yet. Call generate_phrase first, then get_share_payload.",
          code: "NO_RESULT",
          retryable: false,
        };
      }
      const sharerId = getAdapters().getSharerId();
      const url = buildShareUrl(platform, sharerId);
      const copy = buildShareCopy({
        display: board.display,
        gloss: board.gloss,
        url,
        platform,
      });
      return clipOutput({
        platform,
        copy,
        url,
        host: "ky-zhyz.inkwellnote.com",
        note: "Show copy to the user to paste; do not post automatically.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "share build failed";
      return { error: msg, code: "SHARE_FAILED", retryable: false };
    }
  },
});

export const KY_ZHYZ_WEBMCP_TOOLS = [
  generatePhraseTool,
  getCurrentResultTool,
  setSlotLocksTool,
  getSharePayloadTool,
] as const;

export type RegisterKyZhyzOptions = {
  signal?: AbortSignal;
  /** Injectable surface for tests; defaults to document.modelContext. */
  modelContext?: ModelContextLike;
};

/**
 * Bind adapters and register all four tools via the SDK.
 * No-ops (empty registration handle) when modelContext is absent and none was injected.
 * Cleanup: call the returned `unregister()` (or abort `options.signal`).
 */
export function registerKyZhyzWebMcpTools(
  getAdaptersFn: () => KyZhyzWebMcpAdapters,
  options: RegisterKyZhyzOptions = {},
): ToolRegistration {
  getAdaptersRef = getAdaptersFn;

  if (!options.modelContext && !hasModelContext()) {
    const ac = new AbortController();
    return {
      ready: Promise.resolve([]),
      current: () => [],
      unregister: () => {
        /* no-op */
      },
      signal: ac.signal,
    };
  }

  return registerTools([...KY_ZHYZ_WEBMCP_TOOLS], {
    signal: options.signal,
    modelContext: options.modelContext,
    tracking: { builtWith: BUILT_WITH },
  });
}

export { TOOL_NAMES, BUILT_WITH };
