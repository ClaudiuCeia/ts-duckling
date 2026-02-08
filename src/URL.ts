import {
  any,
  Context,
  createLanguageThis,
  furthest,
  many1,
  map,
  number,
  optional,
  peek,
  regex,
  seq,
  space,
  str,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import tlds from "@data/tlds" with { type: "json" };

const tldList = tlds as string[];

export type URLEntity = Entity<
  "url",
  {
    url: string;
  }
>;

export const url = (
  value: URLEntity["value"],
  before: Context,
  after: Context,
): URLEntity => {
  return ent(value, "url", before, after);
};

export const URL = createLanguageThis({
  Protocol(): Parser<string> {
    return any(regex(/https?/i, "http"), regex(/ftps?/i, "ftp"));
  },
  TLD(): Parser<string> {
    return furthest(...tldList.map(str));
  },
  Port(): Parser<number> {
    return number();
  },
  Domain(): Parser<string> {
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
          seq(this.TLD, peek(any(str(":"), str("/"), space()))),
          ([tld]) => tld,
        ),
      ),
      (parts) => parts.join(""),
    );
  },
  Full(): Parser<URLEntity> {
    return map(
      seq(
        this.Protocol,
        str("://"),
        this.Domain,
        optional(seq(str(":"), this.Port)),
      ),
      ([protocol, sep, domain, maybePort], b, a) =>
        url(
          {
            url: `${protocol}${sep}${domain}${
              maybePort ? `:${maybePort[1]}` : ""
            }`,
          },
          b,
          a,
        ),
    );
  },
  parser(): Parser<URLEntity> {
    return dot(any(this.Full));
  },
});
