"use client";

import type { CharVerdict } from "@/lib/validator";
import { KY_ZHYZ_INITIALS } from "@/lib/validator";

const LABELS = ["k", "y", "z/zh", "h", "y", "z"] as const;

type Props = {
  /** Only pass confirmed PASS slots — never fail/red. */
  slots?: CharVerdict[];
  filled?: boolean;
  /** Length-6 lock mask; true = keep this char on regenerate. */
  locked?: boolean[];
  onToggleLock?: (index: number) => void;
  lockDisabled?: boolean;
};

export function SlotBoard({
  slots,
  filled,
  locked,
  onToggleLock,
  lockDisabled,
}: Props) {
  const canLock = Boolean(onToggleLock) && Boolean(slots?.length);

  return (
    <div className="w-full">
      <div className="mb-3 flex items-end justify-between gap-3">
        <p className="text-[13px] font-medium text-mute">
          {canLock ? "点格子锁定 · 再生成会保留" : "六字已齐"}
        </p>
        <p className="font-display text-[10px] leading-none text-magenta">
          ky,zhyz
        </p>
      </div>
      <div className="grid grid-cols-6 gap-2 sm:gap-3">
        {LABELS.map((label, i) => {
          const slot = slots?.[i];
          const char = slot?.char ?? "";
          const show = Boolean(char);
          const isLocked = Boolean(locked?.[i]);
          const inner = (
            <>
              <span
                className={[
                  "font-body text-3xl font-black sm:text-4xl",
                  show ? (isLocked ? "text-magenta" : "text-lime") : "text-stroke",
                ].join(" ")}
              >
                {show ? char : "·"}
              </span>
              <span className="mt-1 font-mono text-[10px] tabular-nums text-mute">
                {label}
              </span>
              {isLocked && (
                <span className="absolute right-1 top-1 text-[9px] font-bold text-magenta">
                  锁
                </span>
              )}
            </>
          );
          const boxClass = [
            "relative flex aspect-square w-full flex-col items-center justify-center rounded-md border-2 bg-panel-2",
            show && filled ? "slot-fill" : "",
            isLocked
              ? "border-magenta shadow-[0_4px_16px_rgba(255,43,214,0.35)]"
              : show
                ? "border-lime shadow-[0_4px_16px_rgba(57,255,20,0.28)]"
                : "border-stroke border-dashed",
          ].join(" ");

          return (
            <div key={`${label}-${i}`} className="relative">
              {i === 2 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -left-2 top-1/2 hidden h-10 w-px -translate-y-1/2 bg-stroke sm:block"
                />
              )}
              {canLock && show ? (
                <button
                  type="button"
                  disabled={lockDisabled}
                  aria-pressed={isLocked}
                  aria-label={
                    isLocked
                      ? `解锁第${i + 1}格「${char}」`
                      : `锁定第${i + 1}格「${char}」`
                  }
                  onClick={() => onToggleLock?.(i)}
                  className={[
                    boxClass,
                    "transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-magenta disabled:opacity-60",
                  ].join(" ")}
                >
                  {inner}
                </button>
              ) : (
                <div className={boxClass}>{inner}</div>
              )}
            </div>
          );
        })}
      </div>
      <span className="sr-only">{KY_ZHYZ_INITIALS.join(",")}</span>
    </div>
  );
}
