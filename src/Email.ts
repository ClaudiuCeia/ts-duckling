import {
  any,
  type Context,
  createLanguageThis,
  digit,
  letter,
  manyTill,
  map,
  seq,
  str,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
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

type EmailLanguage = {
  Full: () => Parser<EmailEntity>;
  parser: () => Parser<EmailEntity>;
};

export const Email: ReturnType<typeof createLanguageThis<EmailLanguage>> =
  createLanguageThis<EmailLanguage>({
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
