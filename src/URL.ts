import {
  any,
  type Context,
  defineLanguage,
  failure,
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
const tldParser = longestLiteral(tldList, { caseInsensitive: true });
const maxDomainLength = 253;
const maxHostScanLength = maxDomainLength + 3;
const maxIpv6HostLength = 47;
const maxLabelLength = 63;
const hostCharacter = /[\p{L}\p{M}\p{N}.-]/u;
const labelEdge = /[\p{L}\p{N}]/u;
const hostTerminators: ReadonlySet<string> = new Set([
  ":",
  "/",
  "?",
  "#",
  ".",
  ",",
  ";",
  "!",
  ")",
  "]",
  "}",
  '"',
  "'",
  ">",
  "\u2019",
  "\u201d",
]);

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

function characterAt(text: string, index: number): string {
  const codePoint = text.codePointAt(index);
  return codePoint === undefined ? "" : String.fromCodePoint(codePoint);
}

/**
 * Trim trailing characters from a URL suffix that are clearly unmatched
 * sentence/context punctuation rather than part of the URL itself.
 * Balanced brackets are kept by counting opens vs closes (e.g. "(foo)" is
 * preserved, but a lone ")" is trimmed).
 */
function trimUrlSuffix(s: string): string {
  const closingPairs: Record<string, string> = {
    ")": "(",
    "]": "[",
    "}": "{",
    "\u2019": "\u2018",
    "\u201d": "\u201c",
  };
  const openingPairs = new Map(
    Object.entries(closingPairs).map(([closer, opener]) => [opener, closer]),
  );
  const excessClosers = Object.fromEntries(
    Object.keys(closingPairs).map((closer) => [closer, 0]),
  ) as Record<string, number>;
  const quoteCounts: Record<string, number> = { '"': 0, "'": 0 };

  for (const character of s) {
    if (character in excessClosers) {
      excessClosers[character]++;
    } else {
      const closer = openingPairs.get(character);
      if (closer !== undefined) excessClosers[closer]--;
    }
    if (character in quoteCounts) quoteCounts[character]++;
  }

  let result = s;
  while (result.length > 0) {
    const last = result[result.length - 1];
    if (".,;!?".includes(last)) {
      result = result.slice(0, -1);
    } else if (last in excessClosers && excessClosers[last] > 0) {
      excessClosers[last]--;
      result = result.slice(0, -1);
    } else if (last in quoteCounts && quoteCounts[last] % 2 === 1) {
      quoteCounts[last]--;
      result = result.slice(0, -1);
    } else {
      break;
    }
  }
  return result;
}

function isHostTerminator(character: string): boolean {
  return character === "" || /\s/u.test(character) ||
    hostTerminators.has(character);
}

function isValidDnsName(host: string): boolean {
  if (host.length === 0 || host.length > maxDomainLength) return false;

  const labels = host.normalize("NFC").split(".");
  if (
    labels.some((label) => {
      const characters = [...label];
      return characters.length === 0 || characters.length > maxLabelLength ||
        !labelEdge.test(characters[0]) ||
        !labelEdge.test(characters[characters.length - 1]);
    })
  ) {
    return false;
  }

  try {
    const normalized = new globalThis.URL(`http://${host}/`).hostname;
    return normalized.length <= maxDomainLength &&
      normalized.split(".").every((label) => label.length <= maxLabelLength);
  } catch {
    return false;
  }
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

  if (text[start] === "[") {
    let closeBracket = -1;
    const searchEnd = Math.min(text.length, start + maxIpv6HostLength);
    for (let index = start + 1; index < searchEnd; index++) {
      if (text[index] === "]") {
        closeBracket = index;
        break;
      }
    }
    if (closeBracket === -1) return failure(ctx, "bracketed-host");

    const host = text.substring(start, closeBracket + 1);
    try {
      new globalThis.URL(`http://${host}/`);
    } catch {
      return failure(ctx, "IPv6 host");
    }

    const end = closeBracket + 1;
    if (!isHostTerminator(characterAt(text, end))) {
      return failure(ctx, "host boundary");
    }
    return success({ ...ctx, index: end }, host);
  }

  let end = start;
  while (end < text.length) {
    const character = characterAt(text, end);
    if (!hostCharacter.test(character)) break;
    end += character.length;
    if (end - start > maxHostScanLength) {
      return failure(ctx, "hostname length");
    }
  }

  let hostEnd = end;
  while (text[hostEnd - 1] === ".") hostEnd--;
  const host = text.substring(start, hostEnd);
  if (!isValidDnsName(host)) return failure(ctx, "hostname");
  if (!isHostTerminator(characterAt(text, end))) {
    return failure(ctx, "host boundary");
  }

  return success({ ...ctx, index: hostEnd }, host);
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
      while (
        end < text.length && end - start < 6 && text[end] >= "0" &&
        text[end] <= "9"
      ) end++;
      if (end === start) return failure(ctx, "port");
      if (
        end - start > 5 ||
        (end < text.length && text[end] >= "0" && text[end] <= "9")
      ) {
        return failure(ctx, "port length");
      }
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
    // Accept "/path", "?query", "#fragment", and a lone trailing "/".
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
        if (text[start] === "/") {
          return success({ ...ctx, index: end }, "/");
        }
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
    return (ctx) => {
      const hostResult = fullHostParser(ctx);
      if (!hostResult.success || hostResult.value.startsWith("[")) {
        return failure(ctx, "domain");
      }

      const separator = hostResult.value.lastIndexOf(".");
      if (separator <= 0) return failure(ctx, "domain TLD");

      const tldResult = s.TLD({ ...ctx, index: ctx.index + separator + 1 });
      if (!tldResult.success || tldResult.ctx.index !== hostResult.ctx.index) {
        return failure(ctx, "domain TLD");
      }

      return success(hostResult.ctx, hostResult.value);
    };
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
      (_parts, b, a) => url({ url: b.text.substring(b.index, a.index) }, b, a),
    );
  },
  Bare: (s): Parser<URLEntity> => {
    return map(
      seq(
        s.Domain,
        optional(seq(str(":"), s.Port)),
        optional(s.Suffix),
      ),
      (_parts, b, a) => url({ url: b.text.substring(b.index, a.index) }, b, a),
    );
  },
  parser: (s): Parser<URLEntity> => {
    return dot(any(s.Full, s.Bare));
  },
});
