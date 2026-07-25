import {
  type Context,
  defineLanguage,
  map,
  regex,
} from "@claudiu-ceia/combine";
import type { Language as DefinedLanguage } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { guard } from "./guard.ts";

/**
 * Credit card entity (digits only, normalized).
 */
export type CreditCardEntity = Entity<
  "credit_card",
  {
    // Digits only (normalized).
    digits: string;
  }
>;

/**
 * Helper for constructing a `CreditCardEntity`.
 */
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
  if (/^(\d)\1+$/.test(digits)) return false;
  return luhnOk(digits);
};

type CreditCardOutputs = {
  Raw: string;
  Full: CreditCardEntity;
  parser: CreditCardEntity;
};

/**
 * Credit card parser language (13-19 digits with separators) validated via Luhn.
 */
export const CreditCard: DefinedLanguage<CreditCardOutputs> = defineLanguage<
  CreditCardOutputs
>({
  // 13-19 digits with optional single separators (space or '-').
  Raw: () => guard(regex(/\d(?:[ -]?\d){12,18}/, "credit-card"), isValidCard),
  Full: (s) =>
    map(s.Raw, (raw, b, a) =>
      creditCard(
        {
          digits: normalizeDigits(raw),
        },
        b,
        a,
      )),
  parser: (s) => dot(s.Full),
});
