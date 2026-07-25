import {
  any,
  type Context,
  defineLanguage,
  failure,
  many,
  many1,
  map,
  type Parser,
  regex,
  seq,
  str,
} from "@claudiu-ceia/combine";
import type { Language as DefinedLanguage } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { guard } from "./guard.ts";

const atom = regex(/[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+/, "email atom");
const localPart = map(
  seq(
    atom,
    many(map(seq(str("."), atom), ([dot, part]) => `${dot}${part}`)),
  ),
  ([first, rest]) => `${first}${rest.join("")}`,
);
const domainLabel = regex(
  /[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?/,
  "domain label",
);
const terminalLabel = any(
  regex(/xn--[A-Za-z0-9-]{2,59}/i, "punycode TLD"),
  regex(/[A-Za-z]{2,63}/i, "TLD"),
);
const domain = map(
  seq(
    many1(
      map(seq(domainLabel, str(".")), ([label, dot]) => `${label}${dot}`),
    ),
    terminalLabel,
  ),
  ([labels, tld]) => `${labels.join("")}${tld}`,
);
const rawEmail = guard(
  map(
    seq(localPart, str("@"), domain),
    ([local, at, host]) => `${local}${at}${host}`,
  ),
  (raw) => {
    const at = raw.lastIndexOf("@");
    return at <= 64 && raw.length - at - 1 <= 253;
  },
  "email length",
);
const emailContinuation = /[A-Za-z0-9!#$%&'*+/=?^_`{|}~.@-]/;

const candidate: Parser<string> = (ctx) => {
  if (ctx.index > 0 && emailContinuation.test(ctx.text[ctx.index - 1])) {
    return failure(ctx, "email boundary");
  }

  const result = rawEmail(ctx);
  if (!result.success) return result;

  if (emailContinuation.test(result.ctx.text[result.ctx.index] ?? "")) {
    return failure(ctx, "email boundary");
  }

  return result;
};

/**
 * Email address entity.
 */
export type EmailEntity = Entity<
  "email",
  {
    email: string;
  }
>;

/**
 * Helper for constructing an `EmailEntity`.
 */
export const email = (
  value: EmailEntity["value"],
  before: Context,
  after: Context,
): EmailEntity => {
  return ent(value, "email", before, after);
};

type EmailOutputs = {
  Full: EmailEntity;
  parser: EmailEntity;
};

/**
 * Email address parser language.
 */
export const Email: DefinedLanguage<EmailOutputs> = defineLanguage<
  EmailOutputs
>({
  Full: () =>
    map(
      candidate,
      (raw, b, a) =>
        email(
          {
            email: raw,
          },
          b,
          a,
        ),
    ),
  parser: (s) => dot(any(s.Full)),
});
