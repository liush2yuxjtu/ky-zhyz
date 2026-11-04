export type WebMcpSlotSnap = {
  char: string;
  index: number;
  expected: string;
  pass: boolean;
};

export type WebMcpBoardSnapshot = {
  scene: string;
  display: string;
  gloss: string;
  phrase: string;
  slots: WebMcpSlotSnap[] | null;
  locked: boolean[];
  memeAvailable: boolean;
  memeTitle: string;
  loading: boolean;
  error: string | null;
};

export type WebMcpGenerateOk = {
  ok: true;
  display: string;
  gloss: string;
  phrase: string;
  attempts: number;
  memeAvailable: boolean;
  memeTitle: string;
};

export type WebMcpGenerateFail = {
  ok: false;
  error: string;
};

export type KyZhyzWebMcpAdapters = {
  getBoard: () => WebMcpBoardSnapshot;
  setScene: (scene: string) => void;
  /** Apply lock indices (0–5). Empty clears. Returns structured failure if invalid. */
  applyLocks: (
    indices: number[],
  ) =>
    | { ok: true; locked: boolean[] }
    | { ok: false; error: string; code: string; retryable: boolean };
  /**
   * Run the same generate path as the UI (updates board).
   * lockIndices if provided are applied first.
   */
  generate: (opts: {
    scene?: string;
    lockIndices?: number[];
    signal?: AbortSignal;
  }) => Promise<WebMcpGenerateOk | WebMcpGenerateFail>;
  getSharerId: () => string;
};
