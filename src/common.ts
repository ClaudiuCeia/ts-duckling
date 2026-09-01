import {
  any,
  eof,
  failure,
  map,
  type Parser,
  regex,
  seqNonNull,
  skip1,
  space,
} from "@claudiu-ceia/combine";

export const dot = <T>(p: Parser<T>): Parser<T> =>
  map(
    seqNonNull(p, any(skip1(nonWord), skip1(space()), skip1(eof()))),
    ([m]) => m,
  );

export const __ = <T>(p: Parser<T>): Parser<T> =>
  map(seqNonNull(p, skip1(space())), ([m]) => m);

/**
 * Zero-width word boundary.
 *
 * Like `dot()` but does NOT consume the trailing delimiter. Succeeds if the
 * character immediately after the match is a non-word character or EOF.
 * Use this for parsers that must not swallow structural punctuation that
 * could belong to an adjacent entity.
 */
export const boundary = <T>(p: Parser<T>): Parser<T> => (ctx) => {
  const result = p(ctx);
  if (!result.success) return result;
  const after = result.ctx;
  if (after.index < after.text.length && /\w/.test(after.text[after.index])) {
    return failure(ctx, "word-boundary");
  }
  return result;
};

/**
 * Zero-width boundary with format-specific continuation rejection.
 *
 * Same as `boundary()`, but also rejects when the remaining text immediately
 * after the match tests positive against the anchored `extraPattern`. Use this
 * for parsers where certain non-word characters are structural (e.g. `-` in
 * UUID, `:` in IPv6, `.` in JWT) and must not continue a match.
 * When `extraLeftPattern` is provided, it is tested against the text before the
 * match to prevent the scanner from returning a valid suffix of a malformed
 * token.
 */
export const strictBoundary = <T>(
  p: Parser<T>,
  extraPattern: RegExp,
  extraLeftPattern?: RegExp,
): Parser<T> =>
(ctx) => {
  const result = p(ctx);
  if (!result.success) return result;

  if (ctx.index > 0) {
    const previous = ctx.text[ctx.index - 1];
    if (
      /\w/.test(previous) ||
      (extraLeftPattern?.test(ctx.text.slice(0, ctx.index)) ?? false)
    ) {
      return failure(ctx, "format-boundary");
    }
  }

  const after = result.ctx;
  if (after.index < after.text.length) {
    const c = after.text[after.index];
    if (/\w/.test(c) || extraPattern.test(after.text.slice(after.index))) {
      return failure(ctx, "format-boundary");
    }
  }
  return result;
};

export const nonWord = regex(/\W-?/, "non-word");
export const separator = __(nonWord);
export const word = regex(/\w+/, "word");

export type EntityLanguage<T, E> = T & { parser: Parser<E> };
