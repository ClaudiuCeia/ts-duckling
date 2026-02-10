/**
 * Cooperative async scanning.
 *
 * Reimplements the `manyTill(any(entities, skip, anyChar), eof)` scan loop
 * from the sync path, but yields to the event loop periodically via
 * `scheduler.yield()` (with `setTimeout(0)` fallback) so the browser can
 * paint and handle input.
 *
 * @module
 */

import { type Context, type Parser, recognizeAt } from "@claudiu-ceia/combine";
import { __, dot, word } from "./common.ts";

type NonEmptyArray<T> = [T, ...T[]];

const yieldToEventLoop: () => Promise<void> = (() => {
  // deno-lint-ignore no-explicit-any
  const s = (globalThis as any).scheduler;
  return typeof s?.yield === "function"
    ? () => s.yield()
    : () => new Promise<void>((r) => setTimeout(r, 0));
})();

/**
 * Options for the cooperative async scan.
 *
 * @experimental Async scanning is experimental and may change.
 *
 * @property signal     - `AbortSignal` for cancellation.
 * @property yieldEvery - Yield to the event loop after this many scan
 *                        positions. Default `512`.
 */
export interface AsyncScanOptions {
  signal?: AbortSignal;
  yieldEvery?: number;
}

/**
 * Try to skip a "word." (word followed by non-word / space / eof),
 * or "__word " (word followed by space), or bare whitespace.
 *
 * Returns the new index if something was consumed, or -1 on failure.
 */
function trySkipUnstructured(ctx: Context): number {
  // dot(word) — word followed by non-word/space/eof
  const dotRes = dot(word)(ctx);
  if (dotRes.success) return dotRes.ctx.index;

  // __(word) — word followed by space
  const uRes = __(word)(ctx);
  if (uRes.success) return uRes.ctx.index;

  // bare whitespace
  const spc = /\s+/y;
  spc.lastIndex = ctx.index;
  const m = spc.exec(ctx.text);
  if (m) return ctx.index + m[0].length;

  return -1;
}

/**
 * Cooperative scan loop that extracts entities from `text`.
 *
 * @experimental Async scanning is experimental and may change.
 *
 * At each position it tries:
 * 1. All entity parsers via `recognizeAt` (picking the shortest advance).
 * 2. Skip unstructured text (word boundaries, whitespace).
 * 3. Skip a single character (guaranteed progress).
 *
 * After every `yieldEvery` positions it yields to the event loop.
 */
export async function asyncScan<T>(
  text: string,
  parsers: NonEmptyArray<Parser<T>>,
  opts: AsyncScanOptions = {},
): Promise<T[]> {
  const { signal, yieldEvery = 512 } = opts;

  const recognizer = recognizeAt(...parsers);
  const results: T[] = [];
  let index = 0;
  let steps = 0;

  // Skip optional leading whitespace (mirrors `optional(space())` in sync)
  const leadingSpc = /^\s+/.exec(text);
  if (leadingSpc) index = leadingSpc[0].length;

  while (index < text.length) {
    signal?.throwIfAborted();

    const ctx: Context = { text, index };

    // Try entity parsers
    const rec = recognizer(ctx);
    if (rec.success && rec.value.length > 0) {
      // Collect ALL matched values (mirroring the sync path's
      // `map(step(recognizeAt(...), "shortest"), recs => recs.map(r => r.value))`
      // which keeps every recognition but advances by the shortest).
      let shortestIndex = Number.POSITIVE_INFINITY;
      for (const r of rec.value) {
        results.push(r.value);
        if (r.ctx.index < shortestIndex) shortestIndex = r.ctx.index;
      }
      index = shortestIndex;
    } else {
      // Try to skip unstructured text
      const skipped = trySkipUnstructured(ctx);
      if (skipped > index) {
        index = skipped;
      } else {
        // Fallback: skip one character
        index++;
      }
    }

    // Yield periodically
    if (++steps % yieldEvery === 0) {
      await yieldToEventLoop();
    }
  }

  return results;
}
