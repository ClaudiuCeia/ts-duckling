import {
  any,
  type Context,
  defineLanguage,
  failure,
  many1,
  map,
  optional,
  regex,
  seq,
  str,
  success,
} from "@claudiu-ceia/combine";
import type {
  Language as DefinedLanguage,
  Parser,
} from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { longestLiteral } from "./parsers.ts";
import tlds from "@data/tlds" with { type: "json" };

const tldList = tlds.values;
// TLD matching is case-insensitive (e.g. .COM and .com both match)
const tldParser = longestLiteral(tldList, { caseInsensitive: true });

/**
 * URL entity.
 */
export type URLEntity = Entity<
  "url",
  {
    url: string;
  }
>;

/**
 * Helper for constructing a `URLEntity`.
 */
export const url = (
  value: URLEntity["value"],
  before: Context,
  after: Context,
): URLEntity => {
  return ent(value, "url", before, after);
};

type URLOutputs = {
  Protocol: string;
  TLD: string;
  Port: number;
  Suffix: string;
  Domain: string;
  FullHost: string;
  Full: URLEntity;
  Bare: URLEntity;
  parser: URLEntity;
};

/**
 * Trim trailing characters from a URL suffix that are clearly unmatched
 * sentence/context punctuation rather than part of the URL itself.
 * Balanced brackets are kept (e.g. "(foo)" is preserved).
 */
function trimUrlSuffix(s: string): string {
  const closingPairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  let result = s;
  while (result.length > 0) {
    const last = result[result.length - 1];
    if (".,;!?".includes(last)) {
      result = result.slice(0, -1);
    } else if (last in closingPairs) {
      if (!result.includes(closingPairs[last])) {
        result = result.slice(0, -1);
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return result;
}

/**
 * Parser for the host component of a protocol-qualified URL (the part after
 * "://").  Accepts:
 *   - Bracketed IPv6 literals:  [2001:db8::1]
 *   - IPv4 literals:            127.0.0.1
 *   - localhost / internal names
 *   - Standard DNS names with hyphens and Unicode labels (münchen.de)
 *
 * No IANA TLD requirement — that is enforced only for bare domains.
 */
const fullHostParser: Parser<string> = (ctx) => {
  const text = ctx.text;
  const start = ctx.index;

  // Bracketed IPv6: [...]
  if (start < text.length && text[start] === "[") {
    const closeBracket = text.indexOf("]", start + 1);
    if (closeBracket !== -1) {
      return success(
        { ...ctx, index: closeBracket + 1 },
        text.substring(start, closeBracket + 1),
      );
    }
    return failure(ctx, "bracketed-host");
  }

  // Hostname: one or more DNS labels separated by dots.
  // A label starts and ends with a letter, digit, or Unicode char and
  // may contain hyphens internally (RFC 1123 + IDN).
  const isLabelStart = (ch: string): boolean => /[\p{L}\p{N}_]/u.test(ch);
  const isLabelMid = (ch: string): boolean => /[\p{L}\p{N}_\-]/u.test(ch);

  const parseLabelEnd = (pos: number): number => {
    if (pos >= text.length || !isLabelStart(text[pos])) return -1;
    let j = pos + 1;
    while (j < text.length && isLabelMid(text[j])) j++;
    // Labels must not end with a hyphen
    if (j > pos + 1 && text[j - 1] === "-") return -1;
    return j;
  };

  let pos = start;
  const firstEnd = parseLabelEnd(pos);
  if (firstEnd === -1) return failure(ctx, "hostname");
  pos = firstEnd;

  // Consume additional dot.label segments
  while (pos < text.length && text[pos] === ".") {
    const nextEnd = parseLabelEnd(pos + 1);
    if (nextEnd === -1) break;
    pos = nextEnd;
  }

  return success({ ...ctx, index: pos }, text.substring(start, pos));
};

/**
 * URL parser language (http/https/ftp with optional port, path, query, fragment).
 */
export const URL: DefinedLanguage<URLOutputs> = defineLanguage<URLOutputs>({
  Protocol: (): Parser<string> => {
    return any(regex(/https?/i, "http"), regex(/ftps?/i, "ftp"));
  },
  TLD: (): Parser<string> => {
    return tldParser;
  },
  Port: (): Parser<number> => {
    // Parse an integer port in the range 1-65535.
    // Rejects decimal-looking input (e.g. :1.5) by failing when a "." follows.
    return (ctx) => {
      const text = ctx.text;
      const start = ctx.index;
      let end = start;
      while (end < text.length && text[end] >= "0" && text[end] <= "9") end++;
      if (end === start) return failure(ctx, "port");
      if (end < text.length && text[end] === ".") {
        return failure(ctx, "port: not an integer");
      }
      const portNum = parseInt(text.substring(start, end), 10);
      if (portNum < 1 || portNum > 65535) {
        return failure(ctx, "port 1-65535");
      }
      return success({ ...ctx, index: end }, portNum);
    };
  },
  Suffix: (): Parser<string> => {
    // Accept "/path", "?query", "#fragment" but not a lone "/" at end.
    // Trailing unmatched closing punctuation (e.g. ")" or ".") is trimmed.
    return (ctx) => {
      const text = ctx.text;
      const start = ctx.index;
      if (start >= text.length || !/[/?#]/.test(text[start])) {
        return failure(ctx, "url-suffix");
      }
      let end = start + 1;
      while (end < text.length && !/\s/.test(text[end])) end++;
      if (end === start + 1) {
        // Lone /, ?, or # with nothing following it
        return failure(ctx, "url-suffix");
      }
      const raw = text.substring(start, end);
      const trimmed = trimUrlSuffix(raw);
      // If trimming left only the leading delimiter, reject
      if (trimmed.length <= 1) return failure(ctx, "url-suffix");
      return success({ ...ctx, index: start + trimmed.length }, trimmed);
    };
  },
  Domain: (s): Parser<string> => {
    // DNS label: starts/ends with alnum; hyphens are allowed internally.
    // Used for bare-domain detection, which requires a valid IANA TLD.
    const label = regex(
      /[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?/,
      "label",
    );
    return map(
      seq(
        map(
          many1(
            map(
              seq(label, str(".")),
              ([word, d]) => `${word}${d}`,
            ),
          ),
          (parts) => parts.join(""),
        ),
        map(s.TLD, (tld) => tld),
      ),
      (parts) => parts.join(""),
    );
  },
  FullHost: (): Parser<string> => {
    return fullHostParser;
  },
  Full: (s): Parser<URLEntity> => {
    return map(
      seq(
        s.Protocol,
        str("://"),
        s.FullHost,
        optional(seq(str(":"), s.Port)),
        optional(s.Suffix),
      ),
      (_parts, b, a) =>
        url({ url: b.text.substring(b.index, a.index) }, b, a),
    );
  },
  Bare: (s): Parser<URLEntity> => {
    return map(
      seq(
        s.Domain,
        optional(seq(str(":"), s.Port)),
        optional(s.Suffix),
      ),
      (_parts, b, a) =>
        url({ url: b.text.substring(b.index, a.index) }, b, a),
    );
  },
  parser: (s): Parser<URLEntity> => {
    return dot(any(s.Full, s.Bare));
  },
});
