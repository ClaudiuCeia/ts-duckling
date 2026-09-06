import {
  any,
  type Context,
  defineLanguage,
  eof,
  failure,
  many,
  map,
  not,
  optional,
  peek,
  regex,
  seq,
  space,
  str,
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

const tldList = tlds.values;
const tldParser = longestLiteral(tldList, { caseInsensitive: true });
const normalizedTlds = new Set(
  tldList.map((tld) => tld.normalize("NFC").toLowerCase()),
);

const maxDomainLength = 253;
const maxLabelLength = 63;
const domainLabel = regex(
  /[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}-]{0,61}[\p{L}\p{M}\p{N}])?/u,
  "domain label",
);
const dotLabel = map(
  seq(str("."), domainLabel),
  ([dot, label]) => `${dot}${label}`,
);
const dnsName = map(
  seq(domainLabel, many(dotLabel)),
  ([first, rest]) => `${first}${rest.join("")}`,
);

const authorityDelimiter = any(str(":"), str("/"), str("?"), str("#"));
const textBoundary = any(
  space(),
  eof(),
  regex(
    /[<,;!)\]}"'>`\u2013\u2014\u2018\u2019\u201c\u201d\u2026]/u,
    "URL text boundary",
  ),
);
const sentencePeriod = regex(
  /\.+(?=$|\s|[<,;!)\]}"'>`\u2013\u2014\u2018\u2019\u201c\u201d\u2026])/u,
  "terminal period",
);
const sentenceColon = map(
  seq(str(":"), peek(textBoundary)),
  ([colon]) => colon,
);
const emptySuffixDelimiter = map(
  seq(any(str("?"), str("#")), peek(textBoundary)),
  ([delimiter]) => delimiter,
);
const hostBoundary = peek(
  any(authorityDelimiter, textBoundary, sentencePeriod),
);
const portBoundary = peek(
  any(str("/"), str("?"), str("#"), textBoundary, sentencePeriod),
);

const protocolStart = seq(
  any(regex(/https?/i, "http"), regex(/ftps?/i, "ftp")),
  str("://"),
);
const adjacentProtocolBoundary = map(
  seq(regex(/[.,;!]+/, "URL separator"), peek(protocolStart)),
  ([separator]) => separator,
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

const plainSuffixPart = regex(
  /[^\s<>"'`()\x5b\x5d{},.;!?\u2013\u2014\u2018\u2019\u201c\u201d\u2026#]+/u,
  "URL suffix part",
);
const suffixPartStart = any(plainSuffixPart, str("("), str("["), str("{"));
const internalSuffixPunctuation = map(
  seq(
    regex(/[.,;!?'#]+/u, "internal URL punctuation"),
    not(protocolStart),
    peek(suffixPartStart),
  ),
  ([punctuation]) => punctuation,
);
const unmatchedOpening = any(str("("), str("["), str("{"));
const balancedSuffixPart = any(
  regex(
    /\((?:[^()\s<>"`\u2013\u2014\u2018\u2019\u201c\u201d\u2026]|\([^()\s<>"`\u2013\u2014\u2018\u2019\u201c\u201d\u2026]*\))*\)/u,
    "parenthesized URL part",
  ),
  regex(
    /\[(?:[^\x5b\x5d\s<>"`\u2013\u2014\u2018\u2019\u201c\u201d\u2026]|\[[^\x5b\x5d\s<>"`\u2013\u2014\u2018\u2019\u201c\u201d\u2026]*\])*\]/u,
    "bracketed URL part",
  ),
  regex(
    /\{(?:[^{}\s<>"`\u2013\u2014\u2018\u2019\u201c\u201d\u2026]|\{[^{}\s<>"`\u2013\u2014\u2018\u2019\u201c\u201d\u2026]*\})*\}/u,
    "braced URL part",
  ),
);
const suffixPart = any(
  balancedSuffixPart,
  plainSuffixPart,
  internalSuffixPunctuation,
  unmatchedOpening,
);
const slashSuffix = map(
  seq(str("/"), many(suffixPart)),
  ([slash, parts]) => `${slash}${parts.join("")}`,
);
const queryOrFragmentSuffix = map(
  seq(any(str("?"), str("#")), suffixPart, many(suffixPart)),
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

function hasCompleteUrlBefore(text: string, index: number): boolean {
  const prefix = text.substring(
    Math.max(0, index - maxDomainLength - 16),
    index,
  );
  const match =
    /(?:https?|ftps?):\/\/[^\s<,;!)\]}"'>`\u2013\u2014\u2018\u2019\u201c\u201d\u2026]+$/i.exec(
      prefix,
    );
  if (!match) return false;

  try {
    return new globalThis.URL(match[0]).hostname.length > 0;
  } catch {
    return false;
  }
}

function hasInvalidBareStart(ctx: Context): boolean {
  if (ctx.index === 0) return false;

  const previous = ctx.text[ctx.index - 1];
  if (/[\p{L}\p{M}\p{N}_@/%-]/u.test(previous)) return true;
  if (previous === "." && ctx.text[ctx.index - 2] !== ".") return true;
  if (previous === "!" && hasCompleteUrlBefore(ctx.text, ctx.index - 1)) {
    return false;
  }
  if (
    /[\s<,;)\]}"'>`\u2013\u2014\u2018\u2019\u201c\u201d\u2026]/u.test(previous)
  ) {
    return false;
  }

  const start = Math.max(0, ctx.index - maxDomainLength - 16);
  const prefix = ctx.text.substring(start, ctx.index);
  if (
    /(?:https?|ftps?):\/\/[^\s/?#,;)\]}"'>`\u2013\u2014\u2018\u2019\u201c\u201d\u2026]*$/i.test(
      prefix,
    )
  ) {
    return true;
  }

  return (
    start > 0 &&
    !/[\s/?#<,;)\]}"'>`\u2013\u2014\u2018\u2019\u201c\u201d\u2026]/u.test(
      prefix,
    )
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
const bracketedHost = guard(
  map(
    seq(str("["), regex(/[0-9A-Fa-f:.]{2,45}/, "IPv6 address"), str("]")),
    (parts) => parts.join(""),
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
  Protocol: () => any(regex(/https?/i, "http"), regex(/ftps?/i, "ftp")),
  TLD: () => tldParser,
  Port: () =>
    map(
      seq(
        guard(
          map(regex(/[0-9]{1,5}/, "port"), (digits) => parseInt(digits, 10)),
          (port) => port >= 1 && port <= 65535,
          "port 1-65535",
        ),
        portBoundary,
      ),
      ([port]) => port,
    ),
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
        ctx.index > 0 && /[\p{L}\p{M}\p{N}_]/u.test(ctx.text[ctx.index - 1]),
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
