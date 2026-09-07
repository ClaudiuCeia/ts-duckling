import {
  type Context,
  any,
  eof,
  map,
  type Parser,
  regex,
  seqNonNull,
  skip1,
  space,
} from "@claudiu-ceia/combine";

export const extractionCache = Symbol("extraction cache");

type CachedContext = Context & {
  [extractionCache]?: Map<symbol, unknown>;
};

export function extractionCacheFor(ctx: Context): Map<symbol, unknown> {
  const cached = (ctx as CachedContext)[extractionCache];
  if (cached !== undefined) return cached;
  const cache = new Map<symbol, unknown>();
  (ctx as CachedContext)[extractionCache] = cache;
  return cache;
}

export const dot = <T>(p: Parser<T>): Parser<T> =>
  map(
    seqNonNull(p, any(skip1(nonWord), skip1(space()), skip1(eof()))),
    ([m]) => m,
  );

export const __ = <T>(p: Parser<T>): Parser<T> =>
  map(seqNonNull(p, skip1(space())), ([m]) => m);

export const nonWord = regex(/\W-?/, "non-word");
export const separator = __(nonWord);
export const word = regex(/\w+/, "word");

export type EntityLanguage<T, E> = T & { parser: Parser<E> };
