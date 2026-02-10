import { useState, useEffect, useRef } from "react";
import type { EntityResult } from "../types";

type Props = {
  entities: EntityResult[];
  anchor: HTMLElement | null;
  onClose: () => void;
};

export function Hovercard({ entities, anchor, onClose }: Props) {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Reset active tab when entities change
  useEffect(() => setActive(0), [entities]);

  // Position near anchor
  useEffect(() => {
    if (!anchor || !ref.current) return;
    const a = anchor.getBoundingClientRect();
    const c = ref.current.getBoundingClientRect();
    const margin = 12;

    let top = a.bottom + 10;
    if (top + c.height + margin > window.innerHeight) {
      top = a.top - c.height - 10;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - c.height - margin));

    let left = a.left;
    if (left + c.width + margin > window.innerWidth) {
      left = window.innerWidth - c.width - margin;
    }
    left = Math.max(margin, left);

    ref.current.style.left = `${Math.round(left)}px`;
    ref.current.style.top = `${Math.round(top)}px`;
  }, [anchor, entities, active]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!entities.length || !anchor) return null;

  const match = entities[active] ?? entities[0];

  return (
    <div
      ref={ref}
      className="fixed z-30 w-[min(520px,calc(100vw-2rem))]"
      role="dialog"
      aria-label="Match details"
    >
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Match
            </div>
            <div className="mt-1 truncate font-mono text-sm text-slate-900">
              {match.kind} &nbsp;"{match.text.length > 60 ? `${match.text.slice(0, 60)}…` : match.text}"
              &nbsp;[{match.start},{match.end}]
            </div>
            {entities.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {entities.map((e, i) => (
                  <button
                    key={`${e.kind}-${i}`}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      i === active
                        ? "border-teal-200 bg-teal-50 text-teal-900"
                        : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                    }`}
                  >
                    {e.kind} {e.end - e.start}c
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-300"
          >
            Close
          </button>
        </div>
        <div className="p-4">
          <pre className="max-h-[50vh] overflow-auto rounded-2xl border border-slate-200 bg-white p-4 font-mono text-xs leading-relaxed text-slate-900">
            {JSON.stringify(match, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
