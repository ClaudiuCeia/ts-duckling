import {
  any,
  chain,
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
  pending,
  peek,
  regex,
  repeat,
  seq,
  skipMany,
  skipMany1,
  space,
  str,
  success,
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
const protocolStart = seq(protocol, str("://"));

const tldList = tlds.values;
const tldParser = longestLiteral(tldList, { caseInsensitive: true });
const normalizedTlds = new Set(
  tldList.map((tld) => tld.normalize("NFC").toLowerCase()),
);

const unicodeSuffixBoundaries = [
  "\u2013",
  "\u2014",
  "\u2018",
  "\u2019",
  "\u201c",
  "\u201d",
  "\u2026",
  "\u3009",
  "\u300b",
  "\u300d",
  "\u300f",
  "\u3011",
  "\uff02",
  "\uff07",
  "\uff09",
  "\uff3d",
  "\uff5d",
];
const unicodeSentencePunctuation = [
  "\u3001",
  "\u3002",
  "\uff01",
  "\uff0c",
  "\uff0e",
  "\uff1a",
  "\uff1b",
  "\uff1f",
  "\uff61",
];
const suffixPunctuationCharacters = [
  ".",
  ",",
  ";",
  "!",
  "?",
  "'",
  "#",
  ":",
  ")",
  "]",
  "}",
  ...unicodeSentencePunctuation,
];
const unicodeHostBoundaries = [
  ...unicodeSuffixBoundaries,
  ...unicodeSentencePunctuation,
];
const compatibilityDots = ["\u3002", "\uff0e", "\uff61"];
const textBoundaryCharacters = [
  "<",
  "(",
  "[",
  "{",
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
  ...unicodeHostBoundaries,
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
  ...unicodeHostBoundaries,
]);
const bareLookbehindBreakCharacters = new Set([
  ...authorityBreakCharacters,
  "<",
]);
const completeUrlBreakCharacters = new Set(
  textBoundaryCharacters.filter((character) => character !== "!"),
);
const plainSuffixReservedCharacters = new Set([
  "<",
  ":",
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
  ...unicodeSuffixBoundaries,
  ...unicodeSentencePunctuation,
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
  ...unicodeSuffixBoundaries,
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

const contextualIdnaCharacters = [
  "\u00b7",
  "\u0375",
  "\u05f3",
  "\u05f4",
  "\u200c",
  "\u200d",
  "\u30fb",
];
const unicodeDomainCharacterPattern = /[\p{L}\p{M}\p{N}\p{So}]/u;
const unicodeWordCharacterPattern = /[\p{L}\p{M}\p{N}]/u;
const unicodeWordOrConnectorPattern = /[\p{L}\p{M}\p{N}\p{Pc}]/u;
const asciiLetterOrNumberPattern = /[A-Za-z0-9]/;
const contextualIdnaCharacter = oneOfCharacters(contextualIdnaCharacters);
const percentEncodedOctet = map(
  seq(str("%"), hexDigit(), hexDigit()),
  (_value, before, after) => before.text.substring(before.index, after.index),
);
const domainLabelStart = any(
  regex(/[\p{L}\p{N}\p{So}]/u, "Unicode hostname label start"),
  contextualIdnaCharacter,
);
const domainLabelContinuation = any(
  regex(/[\p{L}\p{M}\p{N}\p{So}-]/u, "Unicode hostname label character"),
  contextualIdnaCharacter,
);
const domainLabel = guard(
  map(
    seq(domainLabelStart, skipMany(domainLabelContinuation)),
    (_value, before, after) => before.text.substring(before.index, after.index),
  ),
  (label) => !label.endsWith("-"),
  "valid domain label",
);
const encodedDomainLabel = guard(
  map(
    seq(
      any(domainLabelStart, percentEncodedOctet),
      skipMany(any(domainLabelContinuation, percentEncodedOctet)),
    ),
    (_value, before, after) => before.text.substring(before.index, after.index),
  ),
  (label) => !label.endsWith("-"),
  "valid percent-encoded domain label",
);
const authorityDelimiter = oneOfCharacters([":", "/", "?", "#"]);
const asciiDotLabel = map(
  seq(str("."), not(protocolStart), domainLabel),
  ([dot, , label]) => `${dot}${label}`,
);
const compatibilityDotCharacter = oneOfCharacters(compatibilityDots);
const rawCompatibilityDotLabel = map(
  seq(compatibilityDotCharacter, domainLabel),
  ([dot, label]) => `${dot}${label}`,
);
const rawCompatibilityHostTail = map(
  seq(
    rawCompatibilityDotLabel,
    atMost(maxDomainLabels - 2, any(asciiDotLabel, rawCompatibilityDotLabel)),
  ),
  ([first, rest]) => `${first}${rest.join("")}`,
);
const meaningfulCompatibilityHostTail = any(
  map(
    seq(rawCompatibilityHostTail, peek(authorityDelimiter)),
    ([tail]) => tail,
  ),
  guard(
    rawCompatibilityHostTail,
    (tail) => hasKnownTld(`example${tail}`),
    "hostname tail with an IANA TLD",
  ),
);
const compatibilityDot: Parser<string> = (ctx) => {
  const mayBeProse =
    hasNonAsciiUnknownTldLabelAfter(ctx.text, ctx.index) &&
    (hasKnownTldLabelBefore(ctx.text, ctx.index) ||
      hasSpecialHostImmediatelyBefore(ctx.text, ctx.index));
  if (mayBeProse && !meaningfulCompatibilityHostTail(ctx).success) {
    return failure(ctx, "hostname compatibility dot");
  }
  return compatibilityDotCharacter(ctx);
};
const compatibilityDotLabel = map(
  seq(compatibilityDot, domainLabel),
  ([dot, label]) => `${dot}${label}`,
);
const asciiDnsName = map(
  seq(domainLabel, atMost(maxDomainLabels - 1, asciiDotLabel)),
  ([first, rest]) => `${first}${rest.join("")}`,
);
const compatibilityDnsName = map(
  seq(
    domainLabel,
    atMost(maxDomainLabels - 2, asciiDotLabel),
    compatibilityDotLabel,
    atMost(maxDomainLabels - 2, any(asciiDotLabel, compatibilityDotLabel)),
  ),
  ([first, beforeDot, dotLabel, rest]) =>
    `${first}${beforeDot.join("")}${dotLabel}${rest.join("")}`,
);
const dnsName = any(compatibilityDnsName, asciiDnsName);
const encodedAsciiDotLabel = map(
  seq(str("."), not(protocolStart), encodedDomainLabel),
  ([dot, , label]) => `${dot}${label}`,
);
const encodedCompatibilityDotLabel = map(
  seq(compatibilityDot, encodedDomainLabel),
  ([dot, label]) => `${dot}${label}`,
);
const encodedDnsName = map(
  seq(
    encodedDomainLabel,
    atMost(
      maxDomainLabels - 1,
      any(encodedAsciiDotLabel, encodedCompatibilityDotLabel),
    ),
  ),
  ([first, rest]) => `${first}${rest.join("")}`,
);
const percentEncodedDnsName = guard(
  encodedDnsName,
  (host) => host.includes("%"),
  "percent-encoded hostname",
);

const textBoundary = any(
  space(),
  eof(),
  oneOfCharacters(textBoundaryCharacters),
);
const ordinaryTextBoundary = any(
  space(),
  eof(),
  oneOfCharacters(
    textBoundaryCharacters.filter(
      (character) => !compatibilityDots.includes(character),
    ),
  ),
);
const repeatedSentencePeriods = map(
  seq(
    str("."),
    mapJoin(many1(str("."))),
    not(oneOfCharacters([":", "/", "?", "#", "@", "\\"])),
  ),
  ([first, rest]) => `${first}${rest}`,
);
const singleSentencePeriod = seq(str("."), peek(textBoundary));
const sentencePeriod = any(repeatedSentencePeriods, singleSentencePeriod);
const terminalCompatibilityDot = seq(
  compatibilityDotCharacter,
  not(domainLabel),
);
const proseCompatibilityDotValue = map(
  seq(
    compatibilityDotCharacter,
    peek(
      guard(
        domainLabelStart,
        (character) => !asciiLetterOrNumberPattern.test(character),
        "non-ASCII prose",
      ),
    ),
  ),
  ([dot]) => dot,
);
const proseCompatibilityDot: Parser<string> = (ctx) => {
  const result = proseCompatibilityDotValue(ctx);
  if (!result.success) return result;
  return meaningfulCompatibilityHostTail(ctx).success
    ? failure(ctx, "compatibility hostname continuation")
    : result;
};
const sentenceColon = seq(
  guard(
    mapJoin(many1(oneOfCharacters(suffixPunctuationCharacters))),
    (punctuation) => punctuation.includes(":"),
    "sentence colon",
  ),
  peek(textBoundary),
);
const emptySuffixDelimiter = seq(
  oneOfCharacters(["?", "#"]),
  peek(textBoundary),
);
const adjacentProtocolBoundary = seq(
  skipMany1(oneOfCharacters(suffixPunctuationCharacters)),
  peek(protocolStart),
);
const hostBoundary = peek(
  any(
    authorityDelimiter,
    textBoundary,
    sentencePeriod,
    adjacentProtocolBoundary,
  ),
);
const ordinaryHostBoundary = peek(
  any(
    authorityDelimiter,
    ordinaryTextBoundary,
    terminalCompatibilityDot,
    singleSentencePeriod,
    adjacentProtocolBoundary,
  ),
);
const registeredHostBoundary = peek(
  any(
    authorityDelimiter,
    textBoundary,
    singleSentencePeriod,
    adjacentProtocolBoundary,
  ),
);
const portBoundary = peek(
  any(
    oneOfCharacters(["/", "?", "#"]),
    ordinaryTextBoundary,
    terminalCompatibilityDot,
    proseCompatibilityDot,
    sentencePeriod,
  ),
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
const unmatchedOpeningPunctuation = map(
  seq(oneOfCharacters(["(", "[", "{"]), not(protocolStart)),
  ([opening]) => opening,
);
const suffixPartStart = any(plainSuffixPart, unmatchedOpeningPunctuation);
const internalSuffixPunctuationValue = map(
  seq(
    mapJoin(many1(oneOfCharacters(suffixPunctuationCharacters))),
    not(protocolStart),
    peek(suffixPartStart),
  ),
  ([punctuation]) => punctuation,
);
const internalSuffixPunctuation: Parser<string> = (ctx) => {
  const result = internalSuffixPunctuationValue(ctx);
  if (!result.success) return result;
  const containsUnicodePunctuation = [...result.value].some((character) =>
    unicodeSentencePunctuation.includes(character),
  );
  if (
    containsUnicodePunctuation &&
    isUnicodeProseBoundary(ctx.text, ctx.index, result.ctx.index)
  ) {
    return failure(ctx, "Unicode URL punctuation");
  }
  const containsClosingPunctuation = [...result.value].some((character) =>
    ")]}".includes(character),
  );
  return containsClosingPunctuation && ctx.text[result.ctx.index] === "["
    ? failure(ctx, "Markdown link boundary")
    : result;
};

const createBalancedSuffixPart = (
  text: string,
  startIndex: number,
): Parser<string> => {
  const closingIndexes = new Map<number, number>();
  const stacks = new Map([
    ["(", [] as number[]],
    ["[", [] as number[]],
    ["{", [] as number[]],
  ]);
  const closingToOpening = new Map([
    [")", "("],
    ["]", "["],
    ["}", "{"],
  ]);
  let reachedInputEnd = true;

  for (let index = startIndex; index < text.length;) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined) break;
    const character = String.fromCodePoint(codePoint);
    const startsAdjacentUrl =
      index > startIndex &&
      ".,;!([{".includes(text[index - 1]) &&
      protocolStart({ text, index }).success;
    if (
      startsAdjacentUrl ||
      isWhitespace(character) ||
      balancedGroupBreakCharacters.has(character)
    ) {
      reachedInputEnd = false;
      break;
    }

    const openingStack = stacks.get(character);
    if (openingStack !== undefined) {
      openingStack.push(index);
    } else {
      const opening = closingToOpening.get(character);
      const stack = opening === undefined ? undefined : stacks.get(opening);
      if (stack !== undefined && stack.length > 0) {
        closingIndexes.set(stack.pop()!, index + character.length);
      }
    }
    index += character.length;
  }

  const pendingOpenings = new Set(
    reachedInputEnd
      ? Array.from(stacks.values()).flatMap((stack) => stack)
      : [],
  );
  return (ctx) => {
    const closingIndex = closingIndexes.get(ctx.index);
    if (closingIndex === undefined) {
      return ctx.final === false && pendingOpenings.has(ctx.index)
        ? pending(ctx, "balanced suffix group")
        : failure(ctx, "balanced suffix group");
    }
    return success(
      { ...ctx, index: closingIndex },
      ctx.text.substring(ctx.index, closingIndex),
    );
  };
};

const suffix: Parser<string> = (ctx) => {
  const suffixStart = peek(oneOfCharacters(["/", "?", "#"]))(ctx);
  if (!suffixStart.success) return suffixStart;

  const balancedSuffixPart = createBalancedSuffixPart(ctx.text, ctx.index);
  const suffixPart = any(
    balancedSuffixPart,
    plainSuffixPart,
    internalSuffixPunctuation,
    unmatchedOpeningPunctuation,
  );
  const slashSuffix = map(
    seq(str("/"), many(suffixPart)),
    ([slash, parts]) => `${slash}${parts.join("")}`,
  );
  const queryOrFragmentSuffix = map(
    seq(oneOfCharacters(["?", "#"]), suffixPart, many(suffixPart)),
    ([delimiter, first, rest]) => `${delimiter}${first}${rest.join("")}`,
  );
  return any(slashSuffix, queryOrFragmentSuffix)(ctx);
};

function normalizeDnsName(host: string): string | null {
  try {
    return new globalThis.URL(`http://${host}/`).hostname;
  } catch {
    return null;
  }
}

function isValidDnsName(host: string): boolean {
  const normalized = normalizeDnsName(host);
  if (normalized === null) return false;

  const canonical = normalized.endsWith(".")
    ? normalized.slice(0, -1)
    : normalized;
  return (
    canonical.length > 0 &&
    canonical.length <= maxDomainLength &&
    canonical
      .split(".")
      .every(
        (label) =>
          label.length > 0 &&
          label.length <= maxLabelLength &&
          !label.startsWith("-") &&
          !label.endsWith("-"),
      )
  );
}

function hasKnownTld(host: string): boolean {
  const normalized = normalizeDnsName(host);
  if (normalized === null) return false;

  const canonical = normalized.endsWith(".")
    ? normalized.slice(0, -1)
    : normalized;
  const separator = canonical.lastIndexOf(".");
  if (separator <= 0) return false;
  return normalizedTlds.has(canonical.slice(separator + 1).toLowerCase());
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

function isDomainLabelCharacter(character: string): boolean {
  return (
    unicodeDomainCharacterPattern.test(character) ||
    character === "-" ||
    contextualIdnaCharacters.includes(character)
  );
}

function hasKnownHostBeforeRepeatedPeriods(
  text: string,
  index: number,
): boolean {
  let hostEnd = index;
  while (hostEnd > 0 && text[hostEnd - 1] === ".") hostEnd -= 1;
  if (index - hostEnd < 2) return false;

  let hostStart = hostEnd;
  while (hostStart > 0) {
    const character = previousCharacter(text, hostStart);
    if (
      character !== "." &&
      !compatibilityDots.includes(character) &&
      !isDomainLabelCharacter(character)
    ) {
      break;
    }
    hostStart -= character.length;
  }
  return hasKnownTld(text.substring(hostStart, hostEnd));
}

function isKnownTldLabel(label: string): boolean {
  return label.length > 0 && hasKnownTld(`example.${label}`);
}

function domainLabelAfter(text: string, index: number): string {
  const result = domainLabel({ text, index: index + 1 });
  return result.success ? result.value : "";
}

function hasKnownTldLabelBefore(text: string, index: number): boolean {
  let start = index;
  while (start > 0) {
    const character = previousCharacter(text, start);
    if (!isDomainLabelCharacter(character) && character !== "%") break;
    start -= character.length;
  }

  return isKnownTldLabel(text.substring(start, index));
}

function hasNonAsciiUnknownTldLabelAfter(text: string, index: number): boolean {
  const label = domainLabelAfter(text, index);
  const firstCodePoint = label.codePointAt(0);
  if (firstCodePoint === undefined) return false;

  const first = String.fromCodePoint(firstCodePoint);
  return !asciiLetterOrNumberPattern.test(first) && !isKnownTldLabel(label);
}

function isIpv4Host(host: string): boolean {
  const parts = host.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => {
      const value = Number(part);
      return part.length > 0 && Number.isInteger(value) && value <= 255;
    })
  );
}

function isSpecialHost(host: string): boolean {
  const canonical = host.endsWith(".") ? host.slice(0, -1) : host;
  return (
    canonical.toLowerCase() === "localhost" ||
    canonical.startsWith("[") ||
    isIpv4Host(canonical)
  );
}

function hasSpecialHostImmediatelyBefore(text: string, index: number): boolean {
  const earliest = Math.max(2, index - 15);
  for (let start = earliest; start < index; start += 1) {
    if (text[start - 2] !== "/" || text[start - 1] !== "/") continue;
    return isSpecialHost(text.slice(start, index));
  }
  return false;
}

function isUnicodeProseBoundary(
  text: string,
  punctuationStart: number,
  punctuationEnd: number,
): boolean {
  const previous = previousCharacter(text, punctuationStart);
  const nextCodePoint = text.codePointAt(punctuationEnd);
  if (nextCodePoint === undefined) return false;

  const next = String.fromCodePoint(nextCodePoint);
  return (
    asciiLetterOrNumberPattern.test(previous) &&
    unicodeWordCharacterPattern.test(next) &&
    !asciiLetterOrNumberPattern.test(next)
  );
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

function hasPortInUrlBefore(text: string, index: number): boolean {
  const prefix = text.substring(
    Math.max(0, index - maxDomainLength - 16),
    index,
  );
  const start = lastProtocolStart(prefix);
  if (start === null) return false;

  const remainder = prefix.slice(start.index + start.length);
  let authorityEnd = remainder.length;
  for (const delimiter of ["/", "?", "#"]) {
    const delimiterIndex = remainder.indexOf(delimiter);
    if (delimiterIndex >= 0)
      authorityEnd = Math.min(authorityEnd, delimiterIndex);
  }
  const authority = remainder.slice(0, authorityEnd);
  return authority.startsWith("[")
    ? authority.includes("]:")
    : authority.includes(":");
}

function hasAttachedScheme(prefix: string): boolean {
  const start = lastProtocolStart(prefix);
  if (start === null) return false;

  const authority = prefix.slice(start.index + start.length);
  if (authority.startsWith("[")) {
    const close = authority.indexOf("]");
    if (close < 0) return true;
    return !containsBreakCharacter(
      authority.slice(close + 1),
      authorityBreakCharacters,
    );
  }
  return !containsBreakCharacter(authority, authorityBreakCharacters);
}

function hasInvalidBareStart(ctx: Context): boolean {
  if (ctx.index === 0) return false;
  if (ctx.text[ctx.index] === ".") return true;

  const previous = previousCharacter(ctx.text, ctx.index);
  if (isDomainLabelCharacter(previous) || "_@/%".includes(previous)) {
    return true;
  }
  if (previous === "." && ctx.text[ctx.index - 2] !== ".") return true;
  if (
    [":", "?", "#", "\\"].includes(previous) &&
    hasKnownHostBeforeRepeatedPeriods(ctx.text, ctx.index - previous.length)
  ) {
    return true;
  }
  if (previous === "]") {
    const start = Math.max(0, ctx.index - maxDomainLength - 48);
    if (hasAttachedScheme(ctx.text.substring(start, ctx.index))) return true;
  }
  if (previous === "!" && hasCompleteUrlBefore(ctx.text, ctx.index - 1)) {
    return false;
  }
  if (previous === "?" || previous === "#") {
    const punctuationIndex = ctx.index - 1;
    const start = Math.max(0, punctuationIndex - maxDomainLength - 16);
    const prefix = ctx.text.substring(start, punctuationIndex);
    const followsRepeatedPeriods =
      ctx.text[punctuationIndex - 1] === "." &&
      ctx.text[punctuationIndex - 2] === ".";
    const hasScheme =
      hasAttachedScheme(prefix) ||
      (followsRepeatedPeriods &&
        hasAttachedScheme(ctx.text.substring(0, punctuationIndex)));
    if (
      hasScheme &&
      (followsRepeatedPeriods ||
        !hasCompleteUrlBefore(ctx.text, punctuationIndex))
    ) {
      return true;
    }
  }
  if (compatibilityDots.includes(previous)) {
    const punctuationIndex = ctx.index - previous.length;
    const start = Math.max(0, ctx.index - maxDomainLength - 16);
    const prefix = ctx.text.substring(start, punctuationIndex);
    if (hasAttachedScheme(prefix)) {
      return (
        !hasCompleteUrlBefore(ctx.text, punctuationIndex) ||
        hasPortInUrlBefore(ctx.text, punctuationIndex)
      );
    }
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
const validFullDnsName = guard(
  any(percentEncodedDnsName, dnsName),
  isValidDnsName,
  "valid hostname",
);
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
const noRootDot: Parser<null> = (ctx) => success(ctx, null);
const hostValue = any(
  bracketedHost,
  chain(validFullDnsName, (host) =>
    map(
      normalizeDnsName(host)?.endsWith(".") ? noRootDot : optional(rootDot),
      (dot) => `${host}${dot ?? ""}`,
    ),
  ),
);
const fullHost = chain(hostValue, (host) =>
  map(
    hasKnownTld(host) || isSpecialHost(host)
      ? registeredHostBoundary
      : ordinaryHostBoundary,
    () => host,
  ),
);
const fullEntityHost = any(
  fullHost,
  map(seq(hostValue, peek(repeatedSentencePeriods)), ([host]) => host),
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
    seq(
      skipMany(str("0")),
      optional(
        map(
          seq(
            guard(digit(), (value) => value > 0, "non-zero port digit"),
            atMost(4, digit()),
          ),
          ([first, rest]) =>
            rest.reduce((port, digit) => port * 10 + digit, first),
        ),
      ),
    ),
    ([, port]) => port ?? 0,
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
  Suffix: () => suffix,
  Domain: () => bareDomain,
  FullHost: () => fullHost,
  Full: (symbol) =>
    withStartBoundary(
      map(
        seq(
          symbol.Protocol,
          str("://"),
          fullEntityHost,
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
        unicodeWordOrConnectorPattern.test(
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
