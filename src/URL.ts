import {
  any,
  type Context,
  createLanguage,
  furthest,
  many1,
  map,
  number,
  optional,
  regex,
  seq,
  str,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import tlds from "@data/tlds" with { type: "json" };

const tldList = tlds as string[];

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

type URLLanguage = {
  Protocol: Parser<string>;
  TLD: Parser<string>;
  Port: Parser<number>;
  Suffix: Parser<string>;
  Domain: Parser<string>;
  Full: Parser<URLEntity>;
  Bare: Parser<URLEntity>;
  parser: Parser<URLEntity>;
};

/**
 * URL parser language (http/https/ftp with optional port, path, query, fragment).
 */
export const URL: URLLanguage = createLanguage<URLLanguage>({
  Protocol: (): Parser<string> => {
    return any(regex(/https?/i, "http"), regex(/ftps?/i, "ftp"));
  },
  TLD: (): Parser<string> => {
    return furthest(...tldList.map(str));
  },
  Port: (): Parser<number> => {
    return number();
  },
  Suffix: (): Parser<string> => {
    // Accept "/path", "?query", "#fragment" (but not a lone "/" at end).
    // This covers Wikipedia-style URLs with fragments and queries.
    return regex(/[/?#][^\s]+/i, "url-suffix");
  },
  Domain: (s): Parser<string> => {
    return map(
      seq(
        map(
          many1(
            map(
              seq(regex(/\w+/, "word"), str(".")),
              ([word, dot]) => `${word}${dot}`,
            ),
          ),
          (parts) => parts.join(""),
        ),
        map(
          s.TLD,
          (tld) => tld,
        ),
      ),
      (parts) => parts.join(""),
    );
  },
  Full: (s): Parser<URLEntity> => {
    return map(
      seq(
        s.Protocol,
        str("://"),
        s.Domain,
        optional(seq(str(":"), s.Port)),
        optional(s.Suffix),
      ),
      ([protocol, sep, domain, maybePort, maybeSuffix], b, a) =>
        url(
          {
            url: `${protocol}${sep}${domain}${
              maybePort ? `:${maybePort[1]}` : ""
            }${maybeSuffix ?? ""}`,
          },
          b,
          a,
        ),
    );
  },
  Bare: (s): Parser<URLEntity> => {
    return map(
      seq(
        s.Domain,
        optional(seq(str(":"), s.Port)),
        optional(s.Suffix),
      ),
      ([domain, maybePort, maybeSuffix], b, a) =>
        url(
          {
            url: `${domain}${maybePort ? `:${maybePort[1]}` : ""}${
              maybeSuffix ?? ""
            }`,
          },
          b,
          a,
        ),
    );
  },
  parser: (s): Parser<URLEntity> => {
    return dot(any(s.Full, s.Bare));
  },
});
