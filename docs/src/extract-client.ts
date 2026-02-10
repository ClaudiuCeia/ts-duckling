import {
  Duckling,
  type AsyncScanOptions,
} from "@claudiu-ceia/ts-duckling";
import type { EntityResult } from "./types";
import { registry } from "./parsers";

export interface ExtractRequest {
  text: string;
  ids: string[];
  maxChars: number;
  signal?: AbortSignal;
}

export interface ExtractResult {
  entities: EntityResult[];
  ms: number;
  truncated: boolean;
  length: number;
}

export async function extract(req: ExtractRequest): Promise<ExtractResult> {
  const source = typeof req.text === "string" ? req.text : "";
  const max = Number.isFinite(req.maxChars)
    ? Math.max(0, Math.trunc(req.maxChars))
    : 0;
  const truncated = max > 0 && source.length > max;
  const input = truncated ? source.slice(0, max) : source;

  const parsers = Array.isArray(req.ids)
    ? req.ids.map((id) => registry[id]).filter(Boolean)
    : [];

  const opts: AsyncScanOptions = { signal: req.signal };

  const t0 = performance.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entities = (
    parsers.length > 0
      ? await Duckling(parsers as any).extractAsync(input, opts)
      : await Duckling().extractAsync(input, opts)
  ) as EntityResult[];
  const ms = performance.now() - t0;

  return { entities, ms, truncated, length: input.length };
}
