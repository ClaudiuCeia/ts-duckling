import {
  any,
  Context,
  createLanguage,
  furthest,
  many1,
  map,
  Parser,
  regex,
  seq,
  space,
  str,
  peek,
  number,
  optional,
} from "combine/mod.ts";
import { EntityLanguage, dot } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import tlds from "https://cdn.jsdelivr.net/gh/incognico/list-of-top-level-domains/formats/json/tld-list.json" assert { type: "json" };

export type URLEntity = Entity<
  "url",
  {
    url: string;
  }
>;

export const url = (
  value: URLEntity["value"],
  before: Context,
  after: Context
): URLEntity => {
  return ent(value, "url", before, after);
};

type URLEntityLanguage = EntityLanguage<
  {
    Protocol: Parser<string>;
    Domain: Parser<string>;
    TLD: Parser<string>;
    Port: Parser<number>;
    Full: Parser<URLEntity>;
  },
  URLEntity
>;

export const URL = createLanguage<URLEntityLanguage>({
  Protocol: () => any(regex(/https?/i, "http"), regex(/ftps?/i, "ftp")),
  TLD: () => furthest(...tlds.map(str)),
  Port: number,
  Domain: (s) =>
    map(
      seq(
        map(
          many1(
            map(
              seq(regex(/\w+/, "word"), str(".")),
              ([word, dot]) => `${word}${dot}`
            )
          ),
          (parts) => parts.join("")
        ),
        map(seq(s.TLD, peek(any(str(":"), str("/"), space()))), ([tld]) => tld)
      ),
      (parts) => parts.join("")
    ),
  Full: (s) =>
    map(
      seq(s.Protocol, str("://"), s.Domain, optional(seq(str(":"), s.Port))),
      ([protocol, sep, domain, maybePort], b, a) =>
        url(
          {
            url: `${protocol}${sep}${domain}${
              maybePort ? `:${maybePort[1]}` : ""
            }`,
          },
          b,
          a
        )
    ),
  parser: (s) => dot(any(s.Full)),
});
