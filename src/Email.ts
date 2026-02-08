import {
  any,
  Context,
  createLanguageThis,
  digit,
  letter,
  manyTill,
  map,
  seq,
  str,
} from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
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
  after: Context,
): EmailEntity => {
  return ent(value, "email", before, after);
};

export const Email = createLanguageThis({
  Full() {
    return map(
      seq(
        map(
          manyTill(
            any(letter(), digit(), str("."), str("-"), str("-"), str("+")),
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
    );
  },
  parser() {
    return dot(any(this.Full));
  },
});
