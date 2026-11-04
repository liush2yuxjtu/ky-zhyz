"use client";

import { useEffect, type RefObject } from "react";
import {
  hasModelContext,
  registerKyZhyzWebMcpTools,
} from "@/lib/webmcp/register";
import type { KyZhyzWebMcpAdapters } from "@/lib/webmcp/types";

/**
 * Registers ky,zhyz WebMCP tools via @nekuda/webmcp-sdk once on mount.
 * Adapters are read via ref so registration stays stable across React renders.
 * Feature-detects modelContext; no-ops when absent. Cleanup via reg.unregister().
 */
export function WebMcpTools({
  adaptersRef,
}: {
  adaptersRef: RefObject<KyZhyzWebMcpAdapters | null>;
}) {
  useEffect(() => {
    if (!hasModelContext()) return;
    const reg = registerKyZhyzWebMcpTools(() => {
      const adapters = adaptersRef.current;
      if (!adapters) {
        throw new Error("WebMCP adapters not ready");
      }
      return adapters;
    });
    return () => reg.unregister();
  }, [adaptersRef]);

  return null;
}
