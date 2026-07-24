import {
  any,
  failure,
  optional,
  type Parser,
  seq,
  skip1,
  space,
  str,
  success,
} from "@claudiu-ceia/combine";

// Match string regardless of casing
export const fuzzyCase = (match: string): Parser<string> => {
  return (ctx) => {
    const endIdx = ctx.index + match.length;
    if (
      ctx.text.substring(ctx.index, endIdx).toLowerCase() ===
        match.toLowerCase()
    ) {
      return success({ ...ctx, index: endIdx }, match);
    } else {
      return failure(ctx, match);
    }
  };
};

/** Match a parser and return its value without consuming input. */
export const peekValue = <T>(parser: Parser<T>): Parser<T> => {
  return (ctx) => {
    const result = parser(ctx);
    if (result.success) {
      return success(ctx, result.value);
    }

    return failure(
      ctx,
      `lookahead failed, ${result.expected}`,
      [],
      result.stack,
    );
  };
};

/**
 * Match the remainder of an enumeration whose final item is explicitly
 * qualified, returning that final item.
 */
export const enumerationTail = <T, U>(
  item: Parser<T>,
  explicitItem: Parser<U>,
): Parser<U> => {
  const conjunction = any(
    seq(
      str(","),
      optional(space()),
      any(fuzzyCase("and"), fuzzyCase("or")),
      skip1(space()),
    ),
    seq(
      skip1(space()),
      any(fuzzyCase("and"), fuzzyCase("or")),
      skip1(space()),
    ),
  );
  const separator = seq(str(","), optional(space()));

  return (ctx) => {
    let cursor = ctx;

    while (true) {
      const conjunctionResult = conjunction(cursor);
      if (conjunctionResult.success) {
        const finalResult = explicitItem(conjunctionResult.ctx);
        if (finalResult.success) {
          return finalResult;
        }

        return failure(ctx, "enumeration ending in an explicit item");
      }

      const separatorResult = separator(cursor);
      if (!separatorResult.success) {
        return failure(ctx, "enumeration separator");
      }

      const itemResult = item(separatorResult.ctx);
      if (!itemResult.success || itemResult.ctx.index <= cursor.index) {
        return failure(ctx, "enumeration item");
      }

      cursor = itemResult.ctx;
    }
  };
};
