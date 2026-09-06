import {
  any,
  charWhere,
  type Context,
  defineLanguage,
  digit,
  eof,
  failure,
  hexDigit,
  keepNonNull,
  many,
  many1,
  map,
  mapJoin,
  not,
  optional,
  peek,
  regex,
  repeat,
  seq,
  skipMany1,
  space,
  str,
  trie,
} from "@claudiu-ceia/combine";
import type {
  Language as DefinedLanguage,
  Parser,
} from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { guard } from "./guard.ts";
import { longestLiteral } from "./parsers.ts";
import tlds from "../data/tlds.json" with { type: "json" };

const maxDomainLength = 253;
const maxLabelLength = 63;
const maxDomainLabels = Math.ceil(maxDomainLength / 2);

const protocolNames = ["https", "http", "ftps", "ftp"];
const protocolsWithSeparator = protocolNames.map((name) => `${name}://`);
const protocol = map(
  longestLiteral(protocolNames, { caseInsensitive: true }),
  (_name, before, after) => before.text.substring(before.index, after.index),
);

const tldList = tlds.values;
const tldParser = longestLiteral(tldList, { caseInsensitive: true });
const normalizedTlds = new Set(
  tldList.map((tld) => tld.normalize("NFC").toLowerCase()),
);

const unicodeBoundaries = [
  "\u2013",
  "\u2014",
  "\u2018",
  "\u2019",
  "\u201c",
  "\u201d",
  "\u2026",
];
const textBoundaryCharacters = [
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
  ...unicodeBoundaries,
];
const authorityBreakCharacters = new Set([
  "/",
  "?",
  "#",
  ",",
  ";",
  ")",
  "]",
  "}",
  '"',
  "'",
  ">",
  "`",
  ...unicodeBoundaries,
]);
const bareLookbehindBreakCharacters = new Set([
  ...authorityBreakCharacters,
  "<",
]);
const completeUrlBreakCharacters = new Set(
  textBoundaryCharacters.filter((character) => character !== "!"),
);
const plainSuffixReservedCharacters = new Set([
  ...textBoundaryCharacters,
  "(",
  "[",
  "{",
  ".",
  "?",
  "#",
]);
const balancedGroupBreakCharacters = new Set([
  "<",
  ">",
  '"',
  "`",
  ...unicodeBoundaries,
]);

const oneOfCharacters = (characters: readonly string[]): Parser<string> =>
  trie([...characters]);

const nonWhitespaceCharacterExcept = (
  excluded: ReadonlySet<string>,
): Parser<string> =>
  charWhere((code) => {
    const character = String.fromCharCode(code);
    return !isWhitespace(character) && !excluded.has(character);
  });

const atMost = <T>(count: number, parser: Parser<T>): Parser<T[]> =>
  keepNonNull(repeat(count, optional(parser)));

const unicodeLetterOrNumberPattern = /[\p{L}\p{N}]/u;
const unicodeLetterMarkOrNumberPattern = /[\p{L}\p{M}\p{N}]/u;
const unicodeLetterOrNumber = regex(
  unicodeLetterOrNumberPattern,
  "Unicode letter or number",
);
const unicodeLetterMarkOrNumber = regex(
  unicodeLetterMarkOrNumberPattern,
  "Unicode letter, mark, or number",
);

const domainLabelCharacter = any(unicodeLetterMarkOrNumber, str("-"));
const domainLabel = guard(
  map(
    seq(
      unicodeLetterOrNumber,
      atMost(maxLabelLength - 1, domainLabelCharacter),
    ),
    ([first, rest]) => `${first}${rest.join("")}`,
  ),
  (label) => [...label].length <= maxLabelLength && !label.endsWith("-"),
  "valid domain label",
);
const dotLabel = map(
  seq(str("."), domainLabel),
  ([dot, label]) => `${dot}${label}`,
);
const dnsName = map(
  seq(domainLabel, atMost(maxDomainLabels - 1, dotLabel)),
  ([first, rest]) => `${first}${rest.join("")}`,
);

const authorityDelimiter = oneOfCharacters([":", "/", "?", "#"]);
const textBoundary = any(
  space(),
  eof(),
  oneOfCharacters(textBoundaryCharacters),
);
const sentencePeriod = seq(
  regex(/[.]+/, "sentence periods"),
  peek(textBoundary),
);
const sentenceColon = seq(str(":"), peek(textBoundary));
const emptySuffixDelimiter = seq(
  oneOfCharacters(["?", "#"]),
  peek(textBoundary),
);
const hostBoundary = peek(
  any(authorityDelimiter, textBoundary, sentencePeriod),
);
const portBoundary = peek(
  any(oneOfCharacters(["/", "?", "#"]), textBoundary, sentencePeriod),
);

const protocolStart = seq(protocol, str("://"));
const adjacentProtocolBoundary = seq(
  skipMany1(oneOfCharacters([".", ",", ";", "!"])),
  peek(protocolStart),
);
const completeEntityBoundary = peek(
  any(
    textBoundary,
    sentencePeriod,
    sentenceColon,
    emptySuffixDelimiter,
    adjacentProtocolBoundary,
  ),
);

const plainSuffixCharacter = nonWhitespaceCharacterExcept(
  plainSuffixReservedCharacters,
);
const plainSuffixPart = mapJoin(many1(plainSuffixCharacter));
const suffixPartStart = any(plainSuffixPart, oneOfCharacters(["(", "[", "{"]));
const internalSuffixPunctuation = map(
  seq(
    mapJoin(many1(oneOfCharacters([".", ",", ";", "!", "?", "'", "#"]))),
    not(protocolStart),
    peek(suffixPartStart),
  ),
  ([punctuation]) => punctuation,
);

const balancedGroup = (open: string, close: string): Parser<string> => {
  const bodyCharacter = nonWhitespaceCharacterExcept(
    new Set([...balancedGroupBreakCharacters, open, close]),
  );
  const simpleGroup = map(
    seq(str(open), many(bodyCharacter), str(close)),
    ([open, body, close]) => `${open}${body.join("")}${close}`,
  );

  return map(
    seq(str(open), many(any(simpleGroup, bodyCharacter)), str(close)),
    ([open, body, close]) => `${open}${body.join("")}${close}`,
  );
};

const balancedSuffixPart = any(
  balancedGroup("(", ")"),
  balancedGroup("[", "]"),
  balancedGroup("{", "}"),
);
const suffixPart = any(
  balancedSuffixPart,
  plainSuffixPart,
  internalSuffixPunctuation,
  oneOfCharacters(["(", "[", "{"]),
);
const slashSuffix = map(
  seq(str("/"), many(suffixPart)),
  ([slash, parts]) => `${slash}${parts.join("")}`,
);
const queryOrFragmentSuffix = map(
  seq(oneOfCharacters(["?", "#"]), suffixPart, many(suffixPart)),
  ([delimiter, first, rest]) => `${delimiter}${first}${rest.join("")}`,
);

function isValidDnsName(host: string): boolean {
  if (host.length === 0 || host.length > maxDomainLength) return false;

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

function hasKnownTld(host: string): boolean {
  const separator = host.lastIndexOf(".");
  if (separator <= 0) return false;
  return normalizedTlds.has(
    host
      .slice(separator + 1)
      .normalize("NFC")
      .toLowerCase(),
  );
}

function isValidBracketedHost(host: string): boolean {
  try {
    new globalThis.URL(`http://${host}/`);
    return true;
  } catch {
    return false;
  }
}

function isWhitespace(character: string): boolean {
  return character.length > 0 && character.trim().length === 0;
}

function previousCharacter(text: string, index: number): string {
  const lastCodeUnit = text.charCodeAt(index - 1);
  if (lastCodeUnit >= 0xdc00 && lastCodeUnit <= 0xdfff && index >= 2) {
    const firstCodeUnit = text.charCodeAt(index - 2);
    if (firstCodeUnit >= 0xd800 && firstCodeUnit <= 0xdbff) {
      return text.slice(index - 2, index);
    }
  }

  return text[index - 1] ?? "";
}

function containsBreakCharacter(
  text: string,
  breakCharacters: ReadonlySet<string>,
): boolean {
  return [...text].some(
    (character) => isWhitespace(character) || breakCharacters.has(character),
  );
}

function lastProtocolStart(
  text: string,
): { index: number; length: number } | null {
  const folded = text.toLowerCase();
  let latest: { index: number; length: number } | null = null;

  for (const candidate of protocolsWithSeparator) {
    const index = folded.lastIndexOf(candidate);
    if (index >= 0 && (latest === null || index > latest.index)) {
      latest = { index, length: candidate.length };
    }
  }

  return latest;
}

function hasCompleteUrlBefore(text: string, index: number): boolean {
  const prefix = text.substring(
    Math.max(0, index - maxDomainLength - 16),
    index,
  );
  const start = lastProtocolStart(prefix);
  if (start === null) return false;

  const candidate = prefix.slice(start.index);
  if (containsBreakCharacter(candidate, completeUrlBreakCharacters)) {
    return false;
  }

  try {
    return new globalThis.URL(candidate).hostname.length > 0;
  } catch {
    return false;
  }
}

function hasAttachedScheme(prefix: string): boolean {
  const start = lastProtocolStart(prefix);
  if (start === null) return false;

  const authority = prefix.slice(start.index + start.length);
  return !containsBreakCharacter(authority, authorityBreakCharacters);
}

function hasInvalidBareStart(ctx: Context): boolean {
  if (ctx.index === 0) return false;
  if (ctx.text[ctx.index] === ".") return true;

  const previous = previousCharacter(ctx.text, ctx.index);
  if (
    unicodeLetterMarkOrNumberPattern.test(previous) ||
    "_@/%-".includes(previous)
  ) {
    return true;
  }
  if (previous === "." && ctx.text[ctx.index - 2] !== ".") return true;
  if (previous === "!" && hasCompleteUrlBefore(ctx.text, ctx.index - 1)) {
    return false;
  }
  if (isWhitespace(previous) || bareLookbehindBreakCharacters.has(previous)) {
    return false;
  }

  const start = Math.max(0, ctx.index - maxDomainLength - 16);
  const prefix = ctx.text.substring(start, ctx.index);
  if (hasAttachedScheme(prefix)) return true;

  return (
    start > 0 && !containsBreakCharacter(prefix, bareLookbehindBreakCharacters)
  );
}

function withStartBoundary<T>(
  parser: Parser<T>,
  invalid: (ctx: Context) => boolean,
  expected: string,
): Parser<T> {
  return (ctx) => (invalid(ctx) ? failure(ctx, expected) : parser(ctx));
}

const validDnsName = guard(dnsName, isValidDnsName, "valid hostname");
const rootDot = map(seq(str("."), peek(authorityDelimiter)), ([dot]) => dot);
const ipv6Character = any(hexDigit(), str(":"), str("."));
const ipv6Address = mapJoin(
  guard(
    atMost(45, ipv6Character),
    (characters) => characters.length >= 2,
    "IPv6 address",
  ),
);
const bracketedHost = guard(
  map(
    seq(str("["), ipv6Address, str("]")),
    ([open, address, close]) => `${open}${address}${close}`,
  ),
  isValidBracketedHost,
  "valid IPv6 host",
);
const fullHost = map(
  seq(
    any(
      bracketedHost,
      map(
        seq(validDnsName, optional(rootDot)),
        ([host, dot]) => `${host}${dot ?? ""}`,
      ),
    ),
    hostBoundary,
  ),
  ([host]) => host,
);
const bareDnsName = guard(
  validDnsName,
  hasKnownTld,
  "hostname with an IANA TLD",
);
const bareDomain = withStartBoundary(
  map(
    seq(bareDnsName, optional(rootDot), hostBoundary),
    ([host, dot]) => `${host}${dot ?? ""}`,
  ),
  hasInvalidBareStart,
  "domain boundary",
);
const portNumber = guard(
  map(
    guard(atMost(5, digit()), (digits) => digits.length > 0, "port digits"),
    (digits) => digits.reduce((port, value) => port * 10 + value, 0),
  ),
  (port) => port >= 1 && port <= 65535,
  "port 1-65535",
);

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
 * URL parser language (http/https/ftp with optional port, path, query, fragment).
 */
export const URL: DefinedLanguage<URLOutputs> = defineLanguage<URLOutputs>({
  Protocol: () => protocol,
  TLD: () => tldParser,
  Port: () => map(seq(portNumber, portBoundary), ([port]) => port),
  Suffix: () => any(slashSuffix, queryOrFragmentSuffix),
  Domain: () => bareDomain,
  FullHost: () => fullHost,
  Full: (symbol) =>
    withStartBoundary(
      map(
        seq(
          symbol.Protocol,
          str("://"),
          symbol.FullHost,
          optional(
            map(
              seq(str(":"), symbol.Port),
              ([colon, port]) => `${colon}${port}`,
            ),
          ),
          optional(symbol.Suffix),
          completeEntityBoundary,
        ),
        (_parts, before, after) =>
          url(
            { url: before.text.substring(before.index, after.index) },
            before,
            after,
          ),
      ),
      (ctx) =>
        ctx.index > 0 &&
        unicodeLetterMarkOrNumberPattern.test(
          previousCharacter(ctx.text, ctx.index),
        ),
      "URL boundary",
    ),
  Bare: (symbol) =>
    map(
      seq(
        symbol.Domain,
        optional(
          map(seq(str(":"), symbol.Port), ([colon, port]) => `${colon}${port}`),
        ),
        optional(symbol.Suffix),
        completeEntityBoundary,
      ),
      (_parts, before, after) =>
        url(
          { url: before.text.substring(before.index, after.index) },
          before,
          after,
        ),
    ),
  parser: (symbol) => dot(any(symbol.Full, symbol.Bare)),
});
