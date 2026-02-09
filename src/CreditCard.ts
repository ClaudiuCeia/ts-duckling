import {
  type Context,
  createLanguageThis,
  map,
  regex,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { guard } from "./guard.ts";

export type CreditCardEntity = Entity<
  "credit_card",
  {
    // Digits only (normalized).
    digits: string;
  }
>;

export const creditCard = (
  value: CreditCardEntity["value"],
  before: Context,
  after: Context,
): CreditCardEntity => {
  return ent(value, "credit_card", before, after);
};

const luhnOk = (digits: string): boolean => {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
};

const normalizeDigits = (s: string): string => s.replaceAll(/[ -]/g, "");

const isValidCard = (raw: string): boolean => {
  const digits = normalizeDigits(raw);
  if (!/^\d{13,19}$/.test(digits)) return false;
  return luhnOk(digits);
};

type CreditCardLanguage = {
  Raw: () => Parser<string>;
  Full: () => Parser<CreditCardEntity>;
  parser: () => Parser<CreditCardEntity>;
};

export const CreditCard: ReturnType<
  typeof createLanguageThis<CreditCardLanguage>
> = createLanguageThis<CreditCardLanguage>({
  Raw(): Parser<string> {
    // 13-19 digits with optional single separators (space or '-').
    return guard(regex(/\d(?:[ -]?\d){12,18}/, "credit-card"), isValidCard);
  },
  Full(): Parser<CreditCardEntity> {
    return map(
      this.Raw,
      (raw, b, a) =>
        creditCard(
          {
            digits: normalizeDigits(raw),
          },
          b,
          a,
        ),
    );
  },
  parser(): Parser<CreditCardEntity> {
    return dot(this.Full);
  },
});
