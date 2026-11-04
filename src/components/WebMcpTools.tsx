"use client";

import { useEffect, type RefObject } from "react";
import {
  hasModelContext,
  registerKyZhyzWebMcpTools,
} from "@/lib/webmcp/register";
import type { KyZhyzWebMcpAdapters } from "@/lib/webmcp/types";

/**
 * Registers native document.modelContext tools once on mount.
 * Adapters are read via ref so registration stays stable across React renders.
 * Feature-detects modelContext; no-ops when absent (AbortController cleanup).
 */
export function WebMcpTools({
  adaptersRef,
}: {
  adaptersRef: RefObject<KyZhyzWebMcpAdapters | null>;
}) {
  useEffect(() => {
    if (!hasModelContext()) return;
    const controller = new AbortController();
    void registerKyZhyzWebMcpTools(() => {
      const adapters = adaptersRef.current;
      if (!adapters) {
        throw new Error("WebMCP adapters not ready");
      }
      return adapters;
    }, controller.signal);
    return () => controller.abort();
  }, [adaptersRef]);

  return null;
}
