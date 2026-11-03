"use client";

import type { CharVerdict } from "@/lib/validator";
import { KY_ZHYZ_INITIALS } from "@/lib/validator";

const LABELS = ["k", "y", "zh", "h", "y", "z"] as const;

type Props = {
  slots?: CharVerdict[];
  filled?: boolean;
};

export function SlotBoard({ slots, filled }: Props) {
  return (
    <div className="w-full">
      <div className="mb-3 flex items-end justify-between gap-3">
        <p className="font-mono text-[11px] tracking-widest text-mute">
          目标首字母 · k y · zh h y z
        </p>
        <p className="font-display text-[10px] leading-none text-magenta">
          ky,zhyz
        </p>
      </div>
      <div className="grid grid-cols-6 gap-2 sm:gap-3">
        {LABELS.map((label, i) => {
          const slot = slots?.[i];
          const char = slot?.char ?? "";
          const pass = slot?.pass;
          const show = Boolean(char);
          return (
            <div key={`${label}-${i}`} className="relative">
              {i === 2 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -left-2 top-1/2 hidden h-10 w-px -translate-y-1/2 bg-stroke sm:block"
                />
              )}
              <div
                className={[
                  "relative flex aspect-square flex-col items-center justify-center rounded-md border-2 bg-panel-2",
                  show && filled ? "slot-fill" : "",
                  show
                    ? pass
                      ? "border-lime shadow-[0_0_18px_rgba(57,255,20,0.35)]"
                      : "border-warn shadow-[0_0_14px_rgba(255,107,53,0.3)]"
                    : "border-stroke border-dashed",
                ].join(" ")}
              >
                <span
                  className={[
                    "font-body text-3xl font-black sm:text-4xl",
                    show
                      ? pass
                        ? "text-lime"
                        : "text-warn"
                      : "text-stroke",
                  ].join(" ")}
                >
                  {show ? char : "·"}
                </span>
                <span className="mt-1 font-mono text-[10px] uppercase text-mute">
                  {label}
                </span>
              </div>
              {show && slot && (
                <p className="mt-1 truncate text-center font-mono text-[10px] text-mute">
                  {slot.readings.slice(0, 2).join("/")}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {/* keep KY_ZHYZ_INITIALS referenced for tree-shake safety in tests */}
      <span className="sr-only">{KY_ZHYZ_INITIALS.join(",")}</span>
    </div>
  );
}
