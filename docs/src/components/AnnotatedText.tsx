import type { EntityResult } from "../types";
import { kindClasses } from "../utils";

type Props = {
  text: string;
  entities: EntityResult[];
  limit?: number;
  onEntityClick: (entity: EntityResult, el: HTMLElement) => void;
};

/** Entities to show as annotations — pick shortest per start offset, suppress inner quantities. */
function displayEntities(entities: EntityResult[]): EntityResult[] {
  const ATOMIC = new Set(["ip", "url", "email", "uuid", "phone"]);

  // Group by start
  const byStart = new Map<number, EntityResult[]>();
  for (const e of entities) {
    const arr = byStart.get(e.start) ?? [];
    arr.push(e);
    byStart.set(e.start, arr);
  }

  // Pick one representative per start
  const display: EntityResult[] = [];
  for (const [, arr] of [...byStart.entries()].sort(([a], [b]) => a - b)) {
    const atomic = arr.filter((e) => ATOMIC.has(e.kind));
    const pool = atomic.length ? atomic : arr;
    const chosen = [...pool].sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
    display.push(chosen);
  }

  // Remove quantity spans that sit inside atomic entities
  const atomicSpans = entities
    .filter((e) => ATOMIC.has(e.kind))
    .map((e) => ({ start: e.start, end: e.end }));

  return display.filter((e) => {
    if (e.kind !== "quantity") return true;
    return !atomicSpans.some((a) => e.start >= a.start && e.end <= a.end);
  });
}

export function AnnotatedText({ text, entities, limit, onEntityClick }: Props) {
  const view = typeof limit === "number" ? text.slice(0, limit) : text;
  const shown = displayEntities(entities);
  const sorted = [...shown].sort((a, b) => a.start - b.start);

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const e of sorted) {
    if (e.start < cursor || e.start > view.length) continue;
    const end = Math.min(e.end, view.length);

    if (e.start > cursor) {
      parts.push(view.slice(cursor, e.start));
    }

    // Count how many total matches exist at this start offset
    const groupCount = entities.filter((x) => x.start === e.start).length;

    parts.push(
      <span
        key={`${e.start}-${e.end}-${e.kind}`}
        className={`ent relative cursor-pointer rounded-md px-1 py-0.5 text-slate-900 outline-1 ${kindClasses(e.kind)}`}
        onClick={(ev) => onEntityClick(e, ev.currentTarget)}
      >
        {view.slice(e.start, end)}
        {groupCount > 1 && (
          <span className="pointer-events-none absolute -right-1 -top-1 h-2 w-2 rounded-full bg-slate-400/80" />
        )}
      </span>,
    );
    cursor = end;
  }

  if (cursor < view.length) {
    parts.push(view.slice(cursor));
  }

  return (
    <div className="min-h-30 rounded-2xl border border-slate-200 bg-white p-4 font-mono text-sm leading-relaxed text-slate-900 whitespace-pre-wrap">
      {parts}
    </div>
  );
}
