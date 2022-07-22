import {
  any,
  Context,
  createLanguage,
  map,
  Parser,
  seq,
  str,
  manyTill,
  letter,
  digit,
} from "combine/mod.ts";
import { EntityLanguage, __, dot } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import { URL } from "./URL.ts";

export type EmailEntity = Entity<
  "email",
  {
    email: string;
  }
>;

export const email = (
  value: EmailEntity["value"],
  before: Context,
  after: Context
): EmailEntity => {
  return ent(value, "email", before, after);
};

type EmailEntityLanguage = EntityLanguage<
  {
    Full: Parser<EmailEntity>;
  },
  EmailEntity
>;

export const Email = createLanguage<EmailEntityLanguage>({
  Full: () =>
    map(
      seq(
        map(
          manyTill(
            any(letter(), digit(), str("."), str("-"), str("-"), str("+")),
            str("@")
          ),
          (p) => p.join("")
        ),
        URL.Domain
      ),
      ([firstPart, domain], b, a) =>
        email(
          {
            email: `${firstPart}${domain}`,
          },
          b,
          a
        )
    ),
  parser: (s) => dot(any(s.Full)),
});
