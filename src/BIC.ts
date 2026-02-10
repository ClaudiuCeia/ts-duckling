import {
  type Context,
  createLanguage,
  map,
  optional,
  regex,
  seq,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { guard } from "./guard.ts";
import countries from "@data/countries-en-us" with { type: "json" };

const countryCodes = new Set(Object.keys(countries as Record<string, string>));

/**
 * BIC/SWIFT entity (Business Identifier Code — ISO 9362).
 *
 * Format: `BBBBCCLL(BBB)?`
 * - BBBB: 4-letter bank/institution code
 * - CC:   2-letter ISO 3166-1 country code
 * - LL:   2-character location code (letters or digits)
 * - BBB:  optional 3-character branch code (letters or digits, "XXX" = head office)
 */
export type BICEntity = Entity<
  "bic",
  {
    bic: string;
    bank: string;
    country: string;
    location: string;
    branch: string | null;
  }
>;

/**
 * Helper for constructing a `BICEntity`.
 */
export const bic = (
  value: BICEntity["value"],
  before: Context,
  after: Context,
): BICEntity => {
  return ent(value, "bic", before, after);
};

// Leaf tokens — regex only for character classes
const bankCode = regex(/[A-Z]{4}/, "bank code");
const countryChars = regex(/[A-Z]{2}/, "country code");
const locationCode = regex(/[A-Z0-9]{2}/, "location code");
const branchCode = regex(/[A-Z0-9]{3}/, "branch code");

type BICLanguage = {
  /** Full BIC: bank + country + location + optional branch, validated */
  Full: Parser<BICEntity>;
  parser: Parser<BICEntity>;
};

/**
 * BIC/SWIFT parser language.
 *
 * Matches 8- or 11-character SWIFT/BIC codes with a valid ISO 3166-1 country
 * code at positions 5–6. Uses combinators for structure; regex only for leaf
 * character classes.
 */
export const BIC: BICLanguage = createLanguage<BICLanguage>({
  Full: () =>
    guard(
      map(
        seq(bankCode, countryChars, locationCode, optional(branchCode)),
        ([bank, country, location, branch], b, a) =>
          bic(
            {
              bic: `${bank}${country}${location}${branch ?? ""}`,
              bank,
              country,
              location,
              branch: branch ?? null,
            },
            b,
            a,
          ),
      ),
      (entity) => countryCodes.has(entity.value.country),
    ),
  parser: (s) => dot(s.Full),
});
