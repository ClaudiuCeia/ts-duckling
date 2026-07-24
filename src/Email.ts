import {
  any,
  type Context,
  defineLanguage,
  digit,
  letter,
  manyTill,
  map,
  seq,
  str,
} from "@claudiu-ceia/combine";
import type { Language as DefinedLanguage } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { URL } from "./URL.ts";

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
      seq(
        map(
          manyTill(
            any(letter(), digit(), str("."), str("-"), str("+"), str("_")),
            str("@"),
          ),
          (p) => p.join(""),
        ),
        URL.Domain,
      ),
      ([firstPart, domain], b, a) =>
        email(
          {
            email: `${firstPart}${domain}`,
          },
          b,
          a,
        ),
    ),
  parser: (s) => dot(any(s.Full)),
});
