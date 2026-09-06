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
import tlds from "../data/tlds.json" with { type: "json" };

const tldList = tlds.values;
const tldParser = longestLiteral(tldList, { caseInsensitive: true });
const normalizedTlds = new Set(
  tldList.map((tld) => tld.normalize("NFC").toLowerCase()),
);
const maxDomainLength = 253;
const maxHostScanLength = maxDomainLength + 3;
const maxIpv6HostLength = 47;
const maxLabelLength = 63;
const hostCharacter = /[\p{L}\p{M}\p{N}.-]/u;
const labelStart = /[\p{L}\p{N}]/u;
const labelEnd = /[\p{L}\p{M}\p{N}]/u;
const textTerminators: ReadonlySet<string> = new Set([
  "<",
  ",",
  ";",
  "!",
  ")",
  "]",
  "}",
  '"',
  "'",
  ">",
  "`",
  "\u2013",
  "\u2014",
  "\u2018",
  "\u2019",
  "\u201c",
  "\u201d",
  "\u2026",
]);
const suffixTerminators: ReadonlySet<string> = new Set([
  "<",
  ">",
  "`",
  "\u2013",
  "\u2014",
  "\u2018",
  "\u2019",
  "\u201c",
  "\u201d",
  "\u2026",
]);
const authorityDelimiters: ReadonlySet<string> = new Set([":", "/", "?", "#"]);
const hostTerminators: ReadonlySet<string> = new Set([
  ":",
  "/",
  "?",
  "#",
  ".",
  ...textTerminators,
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
  return (
    character === "" || /\s/u.test(character) || hostTerminators.has(character)
  );
}

function isTextTerminator(character: string): boolean {
  return (
    character === "" || /\s/u.test(character) || textTerminators.has(character)
  );
}

function hasProtocolAt(text: string, index: number): boolean {
  return /^(?:https?|ftps?):\/\//i.test(text.substring(index, index + 9));
}

function hasSchemeAuthorityPrefix(text: string, index: number): boolean {
  const start = Math.max(0, index - maxDomainLength - 16);
  const match = /(?:https?|ftps?):\/\/([^\s/?#]*)$/i.exec(
    text.substring(start, index),
  );
  if (!match) return false;

  const authority = match[1];
  for (let separator = authority.length - 1; separator >= 0; separator--) {
    const character = authority[separator];
    if (!textTerminators.has(character)) {
      continue;
    }
    if (
      separator === 0 ||
      (!hostCharacter.test(authority[separator - 1]) &&
        authority[separator - 1] !== "]")
    ) {
      continue;
    }

    try {
      if (new globalThis.URL(`http://${authority.slice(0, separator)}/`).host) {
        return false;
      }
    } catch {
      // Keep looking for an earlier delimiter after a complete authority.
    }
  }
  return true;
}

function hasInvalidBareStart(ctx: Context): boolean {
  if (ctx.index === 0) return false;
  if (hasSchemeAuthorityPrefix(ctx.text, ctx.index)) return true;

  const previous = ctx.text[ctx.index - 1];
  if (previous === ".") return ctx.text[ctx.index - 2] !== ".";
  return /[\p{L}\p{M}\p{N}_@/-]/u.test(previous);
}

function hasInvalidFullStart(ctx: Context): boolean {
  if (ctx.index === 0) return false;
  return /[\p{L}\p{M}\p{N}]/u.test(ctx.text[ctx.index - 1]);
}

function hasInvalidAuthorityContinuation(ctx: Context): boolean {
  return (
    ctx.text[ctx.index] === ":" &&
    !isTextTerminator(characterAt(ctx.text, ctx.index + 1))
  );
}

function hasKnownTld(text: string, start: number): boolean {
  let index = start;
  while (index < text.length && index - start <= maxHostScanLength) {
    const character = characterAt(text, index);
    if (!hostCharacter.test(character)) break;
    index += character.length;
  }

  let host = text.substring(start, index);
  while (host.endsWith(".")) host = host.slice(0, -1);
  const separator = host.lastIndexOf(".");
  if (separator <= 0) return false;

  return normalizedTlds.has(
    host
      .slice(separator + 1)
      .normalize("NFC")
      .toLowerCase(),
  );
}

function isTrailingPeriodRun(text: string, index: number): boolean {
  while (text[index] === ".") index++;
  return isTextTerminator(characterAt(text, index));
}

function enclosingQuote(text: string, index: number): string {
  const minimum = Math.max(0, index - maxDomainLength - 16);
  let start = index;
  while (start > minimum && !/\s/u.test(text[start - 1])) start--;
  const quote = text[start];
  return quote === '"' || quote === "'" ? quote : "";
}

function isValidDnsName(host: string): boolean {
  if (host.length === 0 || host.length > maxDomainLength) return false;

  const labels = host.normalize("NFC").split(".");
  if (
    labels.some((label) => {
      const characters = [...label];
      return (
        characters.length === 0 ||
        characters.length > maxLabelLength ||
        !labelStart.test(characters[0]) ||
        !labelEnd.test(characters[characters.length - 1])
      );
    })
  ) {
    return false;
  }

  try {
    const normalized = new globalThis.URL(`http://${host}/`).hostname;
    return (
      normalized.length <= maxDomainLength &&
      normalized.split(".").every((label) => label.length <= maxLabelLength)
    );
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
    if (text[end] === "." && !isTrailingPeriodRun(text, end)) {
      return failure(ctx, "host continuation");
    }
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
  const trailingDots = end - hostEnd;
  const following = characterAt(text, end);
  const hasRootDot = trailingDots === 1 && authorityDelimiters.has(following);
  if (trailingDots > 1 && authorityDelimiters.has(following)) {
    return failure(ctx, "hostname dots");
  }
  const host = text.substring(start, hostEnd);
  if (!isValidDnsName(host)) return failure(ctx, "hostname");
  if (!isHostTerminator(characterAt(text, end))) {
    return failure(ctx, "host boundary");
  }

  const resultEnd = hasRootDot ? end : hostEnd;
  return success(
    { ...ctx, index: resultEnd },
    text.substring(start, resultEnd),
  );
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
    // A following period is allowed only when it is sentence punctuation.
    return (ctx) => {
      const text = ctx.text;
      const start = ctx.index;
      let end = start;
      while (
        end < text.length &&
        end - start < 6 &&
        text[end] >= "0" &&
        text[end] <= "9"
      )
        end++;
      if (end === start) return failure(ctx, "port");
      if (
        end - start > 5 ||
        (end < text.length && text[end] >= "0" && text[end] <= "9")
      ) {
        return failure(ctx, "port length");
      }
      if (
        end < text.length &&
        text[end] === "." &&
        !isTrailingPeriodRun(text, end)
      ) {
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
      const openBrackets: Record<string, number> = {
        "(": 0,
        "[": 0,
        "{": 0,
      };
      const closingBrackets: Record<string, string> = {
        ")": "(",
        "]": "[",
        "}": "{",
      };
      const quote = enclosingQuote(text, start);
      let end = start + 1;
      while (end < text.length) {
        const character = characterAt(text, end);
        if (/\s/u.test(character) || suffixTerminators.has(character)) break;
        if (
          ".,;!".includes(character) &&
          hasProtocolAt(text, end + character.length)
        ) {
          break;
        }
        if (
          (character === '"' || character === "'") &&
          character === quote &&
          isTextTerminator(characterAt(text, end + character.length))
        ) {
          break;
        }
        if (character in openBrackets) {
          openBrackets[character]++;
        } else if (character in closingBrackets) {
          const opener = closingBrackets[character];
          if (openBrackets[opener] === 0) break;
          openBrackets[opener]--;
        }
        end += character.length;
      }
      if (end === start + 1) {
        if (text[start] === "/") {
          return success({ ...ctx, index: end }, "/");
        }
        return failure(ctx, "url-suffix");
      }
      const raw = text.substring(start, end);
      const trimmed = trimUrlSuffix(raw);
      if (trimmed.length <= 1 && trimmed !== "/") {
        return failure(ctx, "url-suffix");
      }
      return success({ ...ctx, index: start + trimmed.length }, trimmed);
    };
  },
  Domain: (): Parser<string> => {
    return (ctx) => {
      if (hasInvalidBareStart(ctx) || !hasKnownTld(ctx.text, ctx.index)) {
        return failure(ctx, "domain boundary");
      }
      const hostResult = fullHostParser(ctx);
      if (!hostResult.success || hostResult.value.startsWith("[")) {
        return failure(ctx, "domain");
      }

      const rooted = hostResult.value.endsWith(".");
      const domain = rooted ? hostResult.value.slice(0, -1) : hostResult.value;
      const separator = domain.lastIndexOf(".");
      if (separator <= 0) return failure(ctx, "domain TLD");

      const tld = domain
        .slice(separator + 1)
        .normalize("NFC")
        .toLowerCase();
      if (!normalizedTlds.has(tld)) {
        return failure(ctx, "domain TLD");
      }

      return success(hostResult.ctx, hostResult.value);
    };
  },
  FullHost: (): Parser<string> => {
    return fullHostParser;
  },
  Full: (s): Parser<URLEntity> => {
    const candidate = map(
      seq(
        s.Protocol,
        str("://"),
        s.FullHost,
        optional(seq(str(":"), s.Port)),
        optional(s.Suffix),
      ),
      (_parts, b, a) => url({ url: b.text.substring(b.index, a.index) }, b, a),
    );
    return (ctx) => {
      if (hasInvalidFullStart(ctx)) return failure(ctx, "URL boundary");
      const result = candidate(ctx);
      if (result.success && hasInvalidAuthorityContinuation(result.ctx)) {
        return failure(ctx, "URL authority");
      }
      return result;
    };
  },
  Bare: (s): Parser<URLEntity> => {
    const candidate = map(
      seq(s.Domain, optional(seq(str(":"), s.Port)), optional(s.Suffix)),
      (_parts, b, a) => url({ url: b.text.substring(b.index, a.index) }, b, a),
    );
    return (ctx) => {
      const result = candidate(ctx);
      if (result.success && hasInvalidAuthorityContinuation(result.ctx)) {
        return failure(ctx, "URL authority");
      }
      return result;
    };
  },
  parser: (s): Parser<URLEntity> => {
    return dot(any(s.Full, s.Bare));
  },
});
