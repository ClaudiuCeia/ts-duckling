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

type LiteralTrieNode = {
  children: Map<string, LiteralTrieNode>;
  literals?: string[];
};

/** Compile literals once and match the longest literal at the current index. */
export const longestLiteral = (
  literals: readonly string[],
  options: { caseInsensitive?: boolean } = {},
): Parser<string> => {
  const root: LiteralTrieNode = { children: new Map() };
  const caseInsensitive = options.caseInsensitive ?? false;
  const fold = caseInsensitive
    ? (character: string) => character.toUpperCase().toLowerCase()
    : (character: string) => character;

  for (const literal of literals) {
    let node = root;
    for (const character of literal) {
      for (const foldedCharacter of fold(character)) {
        let child = node.children.get(foldedCharacter);
        if (!child) {
          child = { children: new Map() };
          node.children.set(foldedCharacter, child);
        }
        node = child;
      }
    }
    (node.literals ??= []).push(literal);
  }

  return (ctx) => {
    let node = root;
    let index = ctx.index;
    let matchedLiteral: string | undefined;
    let matchedIndex = index;

    const updateMatch = () => {
      const candidates = node.literals;
      if (!candidates) return;

      if (!caseInsensitive) {
        matchedLiteral = candidates[0];
        matchedIndex = index;
        return;
      }

      const input = ctx.text.substring(ctx.index, index).toLowerCase();
      const candidate = candidates.find((literal) =>
        literal.length === index - ctx.index &&
        literal.toLowerCase() === input
      );
      if (candidate !== undefined) {
        matchedLiteral = candidate;
        matchedIndex = index;
      }
    };

    updateMatch();
    while (index < ctx.text.length) {
      const codePoint = ctx.text.codePointAt(index);
      if (codePoint === undefined) break;
      const character = String.fromCodePoint(codePoint);

      let nextNode: LiteralTrieNode | undefined = node;
      for (const foldedCharacter of fold(character)) {
        nextNode = nextNode.children.get(foldedCharacter);
        if (!nextNode) break;
      }
      if (!nextNode) break;

      node = nextNode;
      index += character.length;
      updateMatch();
    }

    return matchedLiteral === undefined
      ? failure(ctx, "literal")
      : success({ ...ctx, index: matchedIndex }, matchedLiteral);
  };
};

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
