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
  many,
  many1,
  map,
  mapJoin,
  not,
  optional,
  pending,
  peek,
  regex,
  seq,
  skipMany1,
  space,
  str,
  success,
  trie,
} from "@claudiu-ceia/combine";
import { decodeHTMLStrict } from "entities";
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
const maxDomainLabelUnits = maxLabelLength * 4;
const maxDomainLabels = Math.ceil(maxDomainLength / 2);
const maxAttachedDelimiterLength = 64;

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
const unicodeTerminalSentencePunctuation = [
  "\u3002",
  "\uff01",
  "\uff0e",
  "\uff1f",
  "\uff61",
];
const balancedDelimiterPairs = [
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
  ["\u3008", "\u3009"],
  ["\u300a", "\u300b"],
  ["\u300c", "\u300d"],
  ["\u300e", "\u300f"],
  ["\u3010", "\u3011"],
  ["\uff08", "\uff09"],
  ["\uff3b", "\uff3d"],
  ["\uff5b", "\uff5d"],
] as const;
const balancedOpeningCharacters: string[] = balancedDelimiterPairs.map(
  ([opening]) => opening,
);
const balancedClosingCharacters: string[] = balancedDelimiterPairs.map(
  ([, closing]) => closing,
);
const openingToClosing = new Map<string, string>(balancedDelimiterPairs);
const closingToOpening = new Map<string, string>(
  balancedDelimiterPairs.map(([opening, closing]) => [closing, opening]),
);
const suffixPunctuationCharacters = [
  ".",
  ",",
  ";",
  "!",
  "?",
  "'",
  "\u2019",
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
  ...balancedOpeningCharacters,
];
const compatibilityDots = ["\u3002", "\uff0e", "\uff61"];
const forbiddenHostBoundaryCharacters = [
  "^",
  "\u061c",
  "\u200e",
  "\u200f",
  "\u202a",
  "\u202b",
  "\u202c",
  "\u202d",
  "\u202e",
  "\u2066",
  "\u2067",
  "\u2068",
  "\u2069",
];
const textBoundaryCharacters = [
  "<",
  "*",
  "|",
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
  ...forbiddenHostBoundaryCharacters,
  ...unicodeHostBoundaries,
];
const authorityBreakCharacters = new Set([
  "/",
  "*",
  "|",
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
const hostnameSymbolBoundaries = new Set([
  ...textBoundaryCharacters,
  ...authorityBreakCharacters,
  ...compatibilityDots,
  ".",
  ":",
  "@",
  "%",
  "\\",
  "+",
  "=",
  "$",
]);
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
  ...balancedOpeningCharacters,
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

const htmlEntity: Parser<string> = (ctx) => {
  if (ctx.text[ctx.index] !== "&") return failure(ctx, "HTML entity");
  let cursor = ctx.index + 1;
  let numeric = false;
  let hexadecimal = false;
  if (ctx.text[cursor] === "#") {
    numeric = true;
    cursor += 1;
    if (ctx.text[cursor]?.toLowerCase() === "x") {
      hexadecimal = true;
      cursor += 1;
    }
  }
  const contentStart = cursor;
  while (cursor < ctx.text.length) {
    const code = ctx.text.charCodeAt(cursor);
    const valid = numeric
      ? (code >= 48 && code <= 57) ||
        (hexadecimal &&
          ((code >= 65 && code <= 70) || (code >= 97 && code <= 102)))
      : (code >= 48 && code <= 57) ||
        (code >= 65 && code <= 90) ||
        (code >= 97 && code <= 122);
    if (!valid) break;
    cursor += 1;
  }
  if (cursor > contentStart && ctx.text[cursor] === ";") {
    const end = cursor + 1;
    const entity = ctx.text.substring(ctx.index, end);
    if (numeric || decodeHTMLStrict(entity) !== entity) {
      return success({ ...ctx, index: end }, entity);
    }
  }
  return ctx.final === false && cursor === ctx.text.length
    ? pending(ctx, "HTML entity")
    : failure(ctx, "HTML entity");
};

const atMost =
  <T>(count: number, parser: Parser<T>): Parser<T[]> =>
  (ctx) => {
    const values: T[] = [];
    let next = ctx;
    while (values.length < count) {
      const result = parser(next);
      if (!result.success) {
        if ("pending" in result || result.fatal) return result;
        break;
      }
      if (result.ctx.index <= next.index) {
        return failure(next, "bounded parser must consume input");
      }
      values.push(result.value);
      next = result.ctx;
    }
    return success(next, values);
  };

const contextualIdnaCharacters = [
  "\u00ad",
  "\u00b7",
  "\u0375",
  "\u05f3",
  "\u05f4",
  "\u200c",
  "\u200d",
  "\u30fb",
];
const unicodeDomainCharacterPattern =
  /[\p{L}\p{M}\p{N}\p{Cf}\p{Pc}\p{Pd}\p{Po}\p{Sc}\p{Sk}\p{Sm}\p{So}]/u;
const unicodeWordCharacterPattern = /[\p{L}\p{M}\p{N}]/u;
const unicodeUrlContentCharacterPattern = /[\p{L}\p{M}\p{N}\p{S}]/u;
const unicodeWordOrConnectorPattern = /[\p{L}\p{M}\p{N}\p{Pc}]/u;
const asciiLetterOrNumberPattern = /[A-Za-z0-9]/;
const contextualIdnaCharacter = oneOfCharacters(contextualIdnaCharacters);
const percentEncodedOctet = map(
  seq(str("%"), hexDigit(), hexDigit()),
  (_value, before, after) => before.text.substring(before.index, after.index),
);
let compatibilityTailCacheText: string | null = null;
let compatibilityTailCache = new Map<number, boolean>();
let compatibilityTailCleanupScheduled = false;
const domainLabelStart = any(
  map(
    seq(
      not(htmlEntity),
      guard(
        regex(
          /[\p{L}\p{M}\p{N}\p{Cf}\p{Pc}\p{Pd}\p{Po}\p{Sc}\p{Sk}\p{Sm}\p{So}]/u,
          "Unicode hostname label start",
        ),
        (character) => !hostnameSymbolBoundaries.has(character),
        "Unicode hostname label start",
      ),
    ),
    ([, character]) => character,
  ),
  str("_"),
  contextualIdnaCharacter,
);
const domainLabelContinuation = any(
  map(
    seq(
      not(htmlEntity),
      guard(
        regex(
          /[\p{L}\p{M}\p{N}\p{Cf}\p{Pc}\p{Pd}\p{Po}\p{Sc}\p{Sk}\p{Sm}\p{So}]/u,
          "Unicode hostname label character",
        ),
        (character) => !hostnameSymbolBoundaries.has(character),
        "Unicode hostname label character",
      ),
    ),
    ([, character]) => character,
  ),
  str("_"),
  contextualIdnaCharacter,
);
const domainLabel = guard(
  map(
    seq(
      domainLabelStart,
      atMost(maxDomainLabelUnits - 1, domainLabelContinuation),
    ),
    (_value, before, after) => before.text.substring(before.index, after.index),
  ),
  (label) => !label.startsWith("-") && !label.endsWith("-"),
  "valid domain label",
);
const encodedDomainLabel = guard(
  map(
    seq(
      any(domainLabelStart, percentEncodedOctet),
      atMost(
        maxDomainLabelUnits - 1,
        any(domainLabelContinuation, percentEncodedOctet),
      ),
    ),
    (_value, before, after) => before.text.substring(before.index, after.index),
  ),
  (label) => !label.startsWith("-") && !label.endsWith("-"),
  "valid percent-encoded domain label",
);
const authorityDelimiter = oneOfCharacters([":", "/", "?", "#", "\\"]);
const asciiDotLabel = map(
  seq(str("."), not(protocolStart), domainLabel),
  ([dot, , label]) => `${dot}${label}`,
);
const compatibilityDotCharacter = oneOfCharacters(compatibilityDots);
const rootDotCharacter = any(str("."), compatibilityDotCharacter);
const repeatedRootDotsBeforeAuthority = seq(
  rootDotCharacter,
  skipMany1(rootDotCharacter),
  peek(authorityDelimiter),
);
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
  const unknownNonAsciiTail = hasNonAsciiUnknownTldLabelAfter(
    ctx.text,
    ctx.index,
  );
  const hasKnownTail =
    !unknownNonAsciiTail || hasKnownTldInCompatibilityTail(ctx.text, ctx.index);
  const mayBeProse = unknownNonAsciiTail
    ? hasKnownTldLabelBefore(ctx.text, ctx.index) ||
      hasSpecialHostImmediatelyBefore(ctx.text, ctx.index) ||
      !hasKnownTail
    : false;
  const canUseUnknownTld =
    !hasKnownTail &&
    hasSchemeQualifiedHostImmediatelyBefore(ctx.text, ctx.index);
  const rawTail = rawCompatibilityHostTail(ctx);
  const hasTerminalUnknownTail =
    canUseUnknownTld &&
    !hasKnownTldLabelBefore(ctx.text, ctx.index) &&
    !hasSpecialHostImmediatelyBefore(ctx.text, ctx.index) &&
    rawTail.success &&
    ordinaryTextBoundary(rawTail.ctx).success;
  if (
    mayBeProse &&
    ((!hasKnownTail && !canUseUnknownTld) ||
      (!hasTerminalUnknownTail &&
        !meaningfulCompatibilityHostTail(ctx).success))
  ) {
    return failure(ctx, "hostname compatibility dot");
  }
  return compatibilityDotCharacter(ctx);
};
const compatibilityDotLabel = map(
  seq(compatibilityDot, not(protocolStart), domainLabel),
  ([dot, , label]) => `${dot}${label}`,
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
  seq(compatibilityDot, not(protocolStart), encodedDomainLabel),
  ([dot, , label]) => `${dot}${label}`,
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
    not(repeatedRootDotsBeforeAuthority),
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
  not(any(domainLabel, authorityDelimiter)),
);
const compatibilityDotBeforeAuthority = seq(
  compatibilityDotCharacter,
  peek(authorityDelimiter),
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
  many(oneOfCharacters([".", "?", "#"])),
  peek(textBoundary),
);
const mixedTerminalSuffixPunctuation = seq(
  str("."),
  peek(emptySuffixDelimiter),
);
const adjacentProtocolBoundary = seq(
  skipMany1(oneOfCharacters(suffixPunctuationCharacters)),
  peek(protocolStart),
);
const safeTrailingHostDelimiter = oneOfCharacters(["+", "=", "$"]);
const htmlEntityBoundary = peek(htmlEntity);
const backslashBoundary = str("\\");
const hostBoundary = peek(
  seq(
    not(repeatedRootDotsBeforeAuthority),
    any(
      authorityDelimiter,
      textBoundary,
      sentencePeriod,
      adjacentProtocolBoundary,
      safeTrailingHostDelimiter,
      htmlEntityBoundary,
    ),
  ),
);
const ordinaryHostBoundary = peek(
  seq(
    not(repeatedRootDotsBeforeAuthority),
    any(
      authorityDelimiter,
      ordinaryTextBoundary,
      terminalCompatibilityDot,
      singleSentencePeriod,
      adjacentProtocolBoundary,
      safeTrailingHostDelimiter,
      htmlEntityBoundary,
    ),
  ),
);
const registeredHostBoundary = peek(
  seq(
    not(repeatedRootDotsBeforeAuthority),
    any(
      authorityDelimiter,
      textBoundary,
      singleSentencePeriod,
      adjacentProtocolBoundary,
      safeTrailingHostDelimiter,
      htmlEntityBoundary,
    ),
  ),
);
const bracketedHostBoundary = seq(
  not(compatibilityDotBeforeAuthority),
  registeredHostBoundary,
);
const portBoundary = peek(
  seq(
    not(repeatedRootDotsBeforeAuthority),
    any(
      oneOfCharacters(["/", "?", "#", "\\"]),
      ordinaryTextBoundary,
      terminalCompatibilityDot,
      proseCompatibilityDot,
      sentencePeriod,
      sentenceColon,
      safeTrailingHostDelimiter,
      htmlEntityBoundary,
    ),
  ),
);
const completeEntityBoundary = peek(
  any(
    textBoundary,
    sentencePeriod,
    sentenceColon,
    emptySuffixDelimiter,
    mixedTerminalSuffixPunctuation,
    safeTrailingHostDelimiter,
    htmlEntityBoundary,
    backslashBoundary,
    adjacentProtocolBoundary,
  ),
);

const plainSuffixCharacterValue = nonWhitespaceCharacterExcept(
  plainSuffixReservedCharacters,
);
const plainSuffixCharacter = map(
  seq(not(htmlEntity), plainSuffixCharacterValue),
  ([, character]) => character,
);
const plainSuffixPart = mapJoin(many1(plainSuffixCharacter));
const unmatchedOpeningPunctuation = map(
  seq(oneOfCharacters(balancedOpeningCharacters), not(protocolStart)),
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
  const stack: Array<{ opening: string; index: number }> = [];
  let reachedInputEnd = true;

  for (let index = startIndex; index < text.length;) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined) break;
    const character = String.fromCodePoint(codePoint);
    const previous = previousCharacter(text, index);
    const nextCodePoint = text.codePointAt(index + character.length);
    const next =
      nextCodePoint === undefined ? "" : String.fromCodePoint(nextCodePoint);
    const internalTypographicApostrophe =
      character === "\u2019" &&
      index > startIndex &&
      previous.length > 0 &&
      !isWhitespace(previous) &&
      !plainSuffixReservedCharacters.has(previous) &&
      next.length > 0 &&
      !isWhitespace(next) &&
      !plainSuffixReservedCharacters.has(next);
    const startsAdjacentUrl =
      index > startIndex &&
      ".,;!([{".includes(text[index - 1]) &&
      protocolStart({ text, index }).success;
    if (
      startsAdjacentUrl ||
      isWhitespace(character) ||
      htmlEntity({ text, index }).success ||
      (balancedGroupBreakCharacters.has(character) &&
        !balancedOpeningCharacters.includes(character) &&
        !balancedClosingCharacters.includes(character) &&
        !internalTypographicApostrophe)
    ) {
      reachedInputEnd = false;
      break;
    }

    if (balancedOpeningCharacters.includes(character)) {
      stack.push({ opening: character, index });
    } else {
      const opening = closingToOpening.get(character);
      const latest = stack[stack.length - 1];
      if (opening !== undefined && latest?.opening === opening) {
        stack.pop();
        closingIndexes.set(latest.index, index + character.length);
      }
    }
    index += character.length;
  }

  const pendingOpenings = new Set(
    reachedInputEnd ? stack.map(({ index }) => index) : [],
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

const createSuffix =
  (pathSeparators: string[]): Parser<string> =>
  (ctx) => {
    const suffixStart = peek(oneOfCharacters([...pathSeparators, "?", "#"]))(
      ctx,
    );
    if (!suffixStart.success) return suffixStart;

    const balancedSuffixPart = createBalancedSuffixPart(ctx.text, ctx.index);
    const suffixPart = any(
      balancedSuffixPart,
      plainSuffixPart,
      internalSuffixPunctuation,
      unmatchedOpeningPunctuation,
    );
    const slashSuffix = map(
      seq(oneOfCharacters(pathSeparators), many(suffixPart)),
      ([slash, parts]) => `${slash}${parts.join("")}`,
    );
    const queryOrFragmentSuffix = map(
      seq(oneOfCharacters(["?", "#"]), suffixPart, many(suffixPart)),
      ([delimiter, first, rest]) => `${delimiter}${first}${rest.join("")}`,
    );
    return any(slashSuffix, queryOrFragmentSuffix)(ctx);
  };
const suffix = createSuffix(["/", "\\"]);
const nonSpecialSuffix = createSuffix(["/"]);

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

function previousCharacterBeforeVariationSelectors(
  text: string,
  index: number,
): string {
  let cursor = index;
  let character = previousCharacter(text, cursor);
  if (character === "\u20e3") {
    const keycap = character;
    cursor -= character.length;
    character = previousCharacter(text, cursor);
    while (/[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/u.test(character)) {
      cursor -= character.length;
      character = previousCharacter(text, cursor);
    }
    return /^[#*0-9]$/.test(character) ? "" : keycap;
  }
  while (/[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/u.test(character)) {
    cursor -= character.length;
    character = previousCharacter(text, cursor);
  }
  return character;
}

function isDomainLabelCharacter(character: string): boolean {
  return (
    (unicodeDomainCharacterPattern.test(character) &&
      !hostnameSymbolBoundaries.has(character)) ||
    "-_".includes(character) ||
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

function isAuthorityCandidateCharacter(character: string): boolean {
  return (
    character === "." ||
    character === "%" ||
    ":@[]".includes(character) ||
    compatibilityDots.includes(character) ||
    isDomainLabelCharacter(character)
  );
}

function attachedSchemeBefore(text: string, index: number): string | null {
  const prefix = text.substring(Math.max(0, index - 8), index).toLowerCase();
  return (
    protocolsWithSeparator.find((candidate) => prefix.endsWith(candidate)) ??
    null
  );
}

function previousBracket(text: string, bracket: string, index: number): number {
  const start = Math.max(0, index - 128);
  const offset = text.substring(start, index).lastIndexOf(bracket);
  return offset < 0 ? -1 : start + offset;
}

function matchingOpener(
  text: string,
  closing: string,
  closingIndex: number,
  nestedSchemeStart: number,
): number {
  const opening = closingToOpening.get(closing);
  if (opening === undefined) return -1;
  let depth = 0;
  for (let cursor = closingIndex + closing.length; cursor > 0;) {
    const character = previousCharacter(text, cursor);
    cursor -= character.length;
    if (
      cursor !== nestedSchemeStart &&
      "hHfF".includes(character) &&
      protocolsWithSeparator.some((protocol) =>
        text
          .substring(cursor, cursor + protocol.length)
          .toLowerCase()
          .startsWith(protocol),
      )
    ) {
      return -1;
    }
    if (character === closing) depth += 1;
    if (character === opening) {
      depth -= 1;
      if (depth === 0) return cursor;
    }
  }
  return -1;
}

function completionEndAfterAuthority(
  text: string,
  authorityEnd: number,
  index: number,
  schemeStart: number,
): number {
  let completionEnd = index;
  while (completionEnd > authorityEnd) {
    const character = previousCharacter(text, completionEnd);
    if (
      balancedClosingCharacters.includes(character) &&
      matchingOpener(
        text,
        character,
        completionEnd - character.length,
        schemeStart,
      ) >= 0
    ) {
      break;
    }
    completionEnd -= character.length;
  }
  return completionEnd;
}

function invalidSchemeAuthoritySeparator(
  text: string,
  index: number,
): {
  separator: number;
  authorityEnd: number;
  schemeStart: number;
  hasExplicitPort: boolean;
  invalid: boolean;
} | null {
  let authorityEnd = index;
  let skippedDelimiter = false;
  let delimiterLength = 0;
  while (authorityEnd > 0) {
    const prefix = text
      .substring(Math.max(0, authorityEnd - 8), authorityEnd)
      .toLowerCase();
    const emptyAuthorityScheme = protocolsWithSeparator.find((candidate) =>
      prefix.endsWith(candidate),
    );
    if (emptyAuthorityScheme !== undefined) {
      const schemeStart = authorityEnd - emptyAuthorityScheme.length;
      return {
        separator: completionEndAfterAuthority(
          text,
          authorityEnd,
          index,
          schemeStart,
        ),
        authorityEnd,
        schemeStart,
        hasExplicitPort: false,
        invalid: true,
      };
    }

    const character = previousCharacter(text, authorityEnd);
    if (isWhitespace(character)) return null;
    if (character === "]") {
      const open = previousBracket(text, "[", authorityEnd - 1);
      if (
        open >= 0 &&
        text.indexOf("]", open) === authorityEnd - 1 &&
        attachedSchemeBefore(text, open) !== null
      ) {
        break;
      }
    }
    if (isDomainLabelCharacter(character)) {
      break;
    }
    if ((character === "." || character === "%") && !skippedDelimiter) break;
    authorityEnd -= character.length;
    delimiterLength += character.length;
    if (delimiterLength > maxAttachedDelimiterLength) return null;
    skippedDelimiter = true;
  }

  const close = previousBracket(text, "]", authorityEnd);
  const open = close >= 0 ? previousBracket(text, "[", close) : -1;
  const bracketTail = close >= 0 ? text.substring(close + 1, authorityEnd) : "";
  let authorityStart =
    open >= 0 &&
    text.indexOf("]", open) === close &&
    [...bracketTail].every(isAuthorityCandidateCharacter) &&
    attachedSchemeBefore(text, open) !== null
      ? open
      : authorityEnd;
  if (authorityStart === authorityEnd) {
    while (authorityStart > 0) {
      const character = previousCharacter(text, authorityStart);
      if (!isAuthorityCandidateCharacter(character)) break;
      authorityStart -= character.length;
    }
  }

  const scheme = attachedSchemeBefore(text, authorityStart);
  if (scheme === null) return null;
  const schemeStart = authorityStart - scheme.length;
  const authority = text.substring(authorityStart, authorityEnd);
  const hasExplicitPort = authority.startsWith("[")
    ? authority.includes("]:")
    : authority.includes(":");
  const completionEnd = completionEndAfterAuthority(
    text,
    authorityEnd,
    index,
    schemeStart,
  );

  try {
    const parsed = new globalThis.URL(`${scheme}${authority}`);
    const host = parsed.hostname;
    const validHost = host.startsWith("[")
      ? isValidBracketedHost(host)
      : isValidDnsName(host);
    return validHost &&
      parsed.username.length === 0 &&
      parsed.password.length === 0
      ? {
          separator: completionEnd,
          authorityEnd,
          schemeStart,
          hasExplicitPort,
          invalid: false,
        }
      : {
          separator: completionEnd,
          authorityEnd,
          schemeStart,
          hasExplicitPort,
          invalid: true,
        };
  } catch {
    return {
      separator: completionEnd,
      authorityEnd,
      schemeStart,
      hasExplicitPort,
      invalid: true,
    };
  }
}

function hasKnownHostBeforeRootDots(text: string, index: number): boolean {
  let authorityEnd = index;
  while (authorityEnd > 0) {
    const character = previousCharacter(text, authorityEnd);
    if (character !== "." && !compatibilityDots.includes(character)) break;
    authorityEnd -= character.length;
  }
  if (authorityEnd === index) return false;

  let authorityStart = authorityEnd;
  while (authorityStart > 0) {
    const character = previousCharacter(text, authorityStart);
    if (
      isWhitespace(character) ||
      "/<,;!?\"'>`".includes(character) ||
      character === "#"
    ) {
      break;
    }
    authorityStart -= character.length;
  }

  const authority = text.substring(authorityStart, authorityEnd);
  const authorityPrefix = text
    .substring(Math.max(0, authorityStart - 8), authorityStart)
    .toLowerCase();
  if (
    protocolsWithSeparator.some((candidate) =>
      authorityPrefix.endsWith(candidate),
    )
  ) {
    return true;
  }

  let host = authority;
  if (authority.startsWith("[")) {
    const closingBracket = authority.indexOf("]");
    if (closingBracket < 0) return false;
    const remainder = authority.slice(closingBracket + 1);
    if (remainder.length > 0 && !remainder.startsWith(":")) return false;
    host = authority.slice(0, closingBracket + 1);
  } else {
    const colon = authority.indexOf(":");
    if (colon >= 0) host = authority.slice(0, colon);
  }
  return hasKnownTld(host) || isSpecialHost(host);
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

function hasKnownTldInCompatibilityTail(text: string, index: number): boolean {
  if (compatibilityTailCacheText !== text) {
    compatibilityTailCacheText = text;
    compatibilityTailCache = new Map();
  }
  if (!compatibilityTailCleanupScheduled) {
    compatibilityTailCleanupScheduled = true;
    // Reuse the scan within one synchronous extraction, then release its input.
    queueMicrotask(() => {
      compatibilityTailCacheText = null;
      compatibilityTailCache.clear();
      compatibilityTailCleanupScheduled = false;
    });
  }
  const cached = compatibilityTailCache.get(index);
  if (cached !== undefined) return cached;

  const positions: number[] = [];
  let separator = index;
  while (
    text[separator] === "." ||
    compatibilityDots.includes(text[separator] ?? "")
  ) {
    if (compatibilityDots.includes(text[separator] ?? "")) {
      positions.push(separator);
    }
    const label = domainLabel({ text, index: separator + 1 });
    if (!label.success) break;
    if (isKnownTldLabel(label.value)) {
      for (const position of positions)
        compatibilityTailCache.set(position, true);
      return true;
    }
    separator = label.ctx.index;
  }

  for (const position of positions) compatibilityTailCache.set(position, false);
  return false;
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
  const normalized = normalizeDnsName(host) ?? host;
  const canonical = normalized.endsWith(".")
    ? normalized.slice(0, -1)
    : normalized;
  return (
    canonical.toLowerCase() === "localhost" ||
    canonical.startsWith("[") ||
    isIpv4Host(canonical)
  );
}

function hasSpecialHostImmediatelyBefore(text: string, index: number): boolean {
  const start = schemeQualifiedHostStartBefore(text, index);
  return start !== null && isSpecialHost(text.slice(start, index));
}

function schemeQualifiedHostStartBefore(
  text: string,
  index: number,
): number | null {
  let start = index;
  while (start > 0) {
    const character = previousCharacter(text, start);
    if (!isAuthorityCandidateCharacter(character)) break;
    start -= character.length;
  }
  return attachedSchemeBefore(text, start) === null ? null : start;
}

function hasSchemeQualifiedHostImmediatelyBefore(
  text: string,
  index: number,
): boolean {
  return schemeQualifiedHostStartBefore(text, index) !== null;
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
  const punctuation = text.substring(punctuationStart, punctuationEnd);
  const followsUnicodeContentAtSentenceEnd =
    unicodeUrlContentCharacterPattern.test(previous) &&
    [...punctuation].some((character) =>
      unicodeTerminalSentencePunctuation.includes(character),
    );
  return (
    unicodeWordCharacterPattern.test(next) &&
    !asciiLetterOrNumberPattern.test(next) &&
    (asciiLetterOrNumberPattern.test(previous) ||
      followsUnicodeContentAtSentenceEnd)
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

function hasCompleteUrlBefore(
  text: string,
  index: number,
  nestedSchemeStart?: number,
): boolean {
  const availableClosers = new Map(
    balancedClosingCharacters.map((closing) => [closing, 0]),
  );
  if (nestedSchemeStart !== undefined) {
    for (const character of text.substring(nestedSchemeStart, index)) {
      if (closingToOpening.has(character)) {
        availableClosers.set(
          character,
          (availableClosers.get(character) ?? 0) + 1,
        );
      }
    }
  }

  let segmentStart = nestedSchemeStart ?? index;
  while (segmentStart > 0) {
    const character = previousCharacter(text, segmentStart);
    const closing = openingToClosing.get(character);
    const balancedOpening =
      nestedSchemeStart !== undefined &&
      closing !== undefined &&
      (availableClosers.get(closing) ?? 0) > 0;
    if (balancedOpening && closing !== undefined) {
      availableClosers.set(closing, (availableClosers.get(closing) ?? 0) - 1);
    }
    const balancedClosing =
      nestedSchemeStart !== undefined && closingToOpening.has(character);
    if (balancedClosing) {
      availableClosers.set(
        character,
        (availableClosers.get(character) ?? 0) + 1,
      );
    }
    if (
      isWhitespace(character) ||
      character === "+" ||
      (nestedSchemeStart !== undefined &&
        textBoundaryCharacters.includes(character) &&
        !balancedOpening &&
        !balancedClosing)
    ) {
      break;
    }
    segmentStart -= character.length;
  }

  const prefix = text.substring(segmentStart, index);
  const folded = prefix.toLowerCase();
  let protocolIndex = -1;
  for (const protocol of protocolsWithSeparator) {
    const candidateIndex = folded.indexOf(protocol);
    if (
      candidateIndex >= 0 &&
      (protocolIndex < 0 || candidateIndex < protocolIndex)
    ) {
      protocolIndex = candidateIndex;
    }
  }
  if (protocolIndex < 0) return false;

  const candidate = prefix.slice(protocolIndex);
  const result = URL.Full({ text: candidate, index: 0 });
  return result.success && result.ctx.index === candidate.length;
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

function exceedsAttachedDelimiterHorizon(text: string, index: number): boolean {
  let length = 0;
  for (let cursor = index; cursor > 0;) {
    const character = previousCharacter(text, cursor);
    if (isWhitespace(character) || isDomainLabelCharacter(character)) break;
    length += character.length;
    if (length > maxAttachedDelimiterLength) return true;
    cursor -= character.length;
  }
  return false;
}

function hasInvalidBareStart(ctx: Context): boolean {
  if (ctx.index === 0) return false;
  const currentCodeUnit = ctx.text.charCodeAt(ctx.index);
  if (currentCodeUnit >= 0xdc00 && currentCodeUnit <= 0xdfff) return true;
  if (ctx.text[ctx.index] === ".") return true;

  const previous = previousCharacter(ctx.text, ctx.index);
  if (exceedsAttachedDelimiterHorizon(ctx.text, ctx.index)) return false;
  if (isDomainLabelCharacter(previous) || "_@/%".includes(previous)) {
    return true;
  }
  if (previous === "." && ctx.text[ctx.index - 2] !== ".") return true;
  if ([":", "?", "#", "\\"].includes(previous)) {
    const punctuationIndex = ctx.index - previous.length;
    if (hasKnownHostBeforeRepeatedPeriods(ctx.text, punctuationIndex)) {
      return true;
    }
    if (
      previous !== "\\" &&
      hasKnownHostBeforeRootDots(ctx.text, punctuationIndex)
    ) {
      return true;
    }
  }
  const invalidAuthoritySeparator = invalidSchemeAuthoritySeparator(
    ctx.text,
    ctx.index,
  );
  if (
    !isWhitespace(previous) &&
    invalidAuthoritySeparator !== null &&
    invalidAuthoritySeparator.invalid
  ) {
    const completesOuterUrl =
      hasCompleteUrlBefore(
        ctx.text,
        invalidAuthoritySeparator.separator,
        invalidAuthoritySeparator.schemeStart,
      ) ||
      (invalidAuthoritySeparator.authorityEnd !==
        invalidAuthoritySeparator.separator &&
        hasCompleteUrlBefore(
          ctx.text,
          invalidAuthoritySeparator.authorityEnd,
          invalidAuthoritySeparator.schemeStart,
        ));
    if (!completesOuterUrl) return true;
  }
  if (previous === ":" && invalidAuthoritySeparator !== null) return true;
  if (previous === "]") {
    const start = Math.max(0, ctx.index - maxDomainLength - 48);
    if (hasAttachedScheme(ctx.text.substring(start, ctx.index))) return true;
  }
  if (previous === "!") return false;
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
  if (
    compatibilityDots.includes(previous) &&
    invalidAuthoritySeparator?.hasExplicitPort
  ) {
    return true;
  }
  if (isWhitespace(previous) || bareLookbehindBreakCharacters.has(previous)) {
    return false;
  }

  const start = Math.max(0, ctx.index - maxDomainLength - 16);
  const prefix = ctx.text.substring(start, ctx.index);
  if (hasAttachedScheme(prefix)) return true;

  return false;
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
const rootDot = map(
  seq(rootDotCharacter, peek(authorityDelimiter)),
  ([dot]) => dot,
);
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
    host.startsWith("[")
      ? bracketedHostBoundary
      : hasKnownTld(host) || isSpecialHost(host)
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
const bareDomainSeparatorAhead: Parser<null> = (ctx) => {
  let cursor = ctx.index;
  for (let units = 0; units < maxDomainLabelUnits; units += 1) {
    const codePoint = ctx.text.codePointAt(cursor);
    if (codePoint === undefined) {
      return ctx.final === false
        ? pending(ctx, "bare domain separator")
        : failure(ctx, "bare domain separator");
    }
    const character = String.fromCodePoint(codePoint);
    if (character === "." || compatibilityDots.includes(character)) {
      return success(ctx, null);
    }
    if (!isDomainLabelCharacter(character) && character !== "%") {
      return failure(ctx, "bare domain separator");
    }
    cursor += character.length;
  }
  const codePoint = ctx.text.codePointAt(cursor);
  if (codePoint === undefined) {
    return ctx.final === false
      ? pending(ctx, "bare domain separator")
      : failure(ctx, "bare domain separator");
  }
  const character = String.fromCodePoint(codePoint);
  if (character === "." || compatibilityDots.includes(character)) {
    return success(ctx, null);
  }
  return failure(ctx, "bare domain separator");
};
const bareDomain = withStartBoundary(
  map(
    seq(bareDomainSeparatorAhead, bareDnsName, optional(rootDot), hostBoundary),
    ([, host, dot]) => `${host}${dot ?? ""}`,
  ),
  hasInvalidBareStart,
  "domain boundary",
);
const portNumber = guard(
  map(seq(digit(), many(digit())), ([first, rest]) =>
    rest.reduce((port, nextDigit) => port * 10 + nextDigit, first),
  ),
  (port) => port >= 0 && port <= 65535,
  "port 0-65535",
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
        chain(symbol.Protocol, (parsedProtocol) =>
          seq(
            str("://"),
            fullEntityHost,
            optional(
              map(
                seq(
                  str(":"),
                  any(
                    map(symbol.Port, String),
                    map(peek(oneOfCharacters(["/", "?", "#", "\\"])), () => ""),
                  ),
                ),
                ([colon, port]) => `${colon}${port}`,
              ),
            ),
            optional(
              parsedProtocol.toLowerCase() === "ftps"
                ? nonSpecialSuffix
                : symbol.Suffix,
            ),
            completeEntityBoundary,
          ),
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
          previousCharacterBeforeVariationSelectors(ctx.text, ctx.index),
        ),
      "URL boundary",
    ),
  Bare: (symbol) =>
    map(
      seq(
        symbol.Domain,
        optional(
          map(
            seq(
              str(":"),
              any(
                map(symbol.Port, String),
                map(peek(oneOfCharacters(["/", "?", "#", "\\"])), () => ""),
              ),
            ),
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
  parser: (symbol) => dot(any(symbol.Full, symbol.Bare)),
});
