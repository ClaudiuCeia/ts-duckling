import {
  type Context,
  createLanguage,
  many1,
  map,
  optional,
  regex,
  repeat,
  seq,
  str,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { guard } from "./guard.ts";

/**
 * IBAN entity (International Bank Account Number).
 */
export type IBANEntity = Entity<
  "iban",
  {
    iban: string;
    country: string;
  }
>;

/**
 * Helper for constructing an `IBANEntity`.
 */
export const iban = (
  value: IBANEntity["value"],
  before: Context,
  after: Context,
): IBANEntity => {
  return ent(value, "iban", before, after);
};

// IBAN lengths per country (ISO 13616).
// https://www.swift.com/standards/data-standards/iban-international-bank-account-number
const IBAN_LENGTHS: Record<string, number> = {
  AL: 28,
  AD: 24,
  AT: 20,
  AZ: 28,
  BH: 22,
  BY: 28,
  BE: 16,
  BA: 20,
  BR: 29,
  BG: 22,
  CR: 22,
  HR: 21,
  CY: 28,
  CZ: 24,
  DK: 18,
  DO: 28,
  TL: 23,
  EG: 29,
  SV: 28,
  EE: 20,
  FO: 18,
  FI: 18,
  FR: 27,
  GE: 22,
  DE: 22,
  GI: 23,
  GR: 27,
  GL: 18,
  GT: 28,
  HU: 28,
  IS: 26,
  IQ: 23,
  IE: 22,
  IL: 23,
  IT: 27,
  JO: 30,
  KZ: 20,
  XK: 20,
  KW: 30,
  LV: 21,
  LB: 28,
  LY: 25,
  LI: 21,
  LT: 20,
  LU: 20,
  MK: 19,
  MT: 31,
  MR: 27,
  MU: 30,
  MC: 27,
  MD: 24,
  ME: 22,
  NL: 18,
  NO: 15,
  PK: 24,
  PS: 29,
  PL: 28,
  PT: 25,
  QA: 29,
  RO: 24,
  LC: 32,
  SM: 27,
  ST: 25,
  SA: 24,
  RS: 22,
  SC: 31,
  SK: 24,
  SI: 19,
  ES: 24,
  SD: 18,
  SE: 24,
  CH: 21,
  TN: 24,
  TR: 26,
  UA: 29,
  AE: 23,
  GB: 22,
  VA: 22,
  VG: 24,
};

/**
 * Validate IBAN checksum using the ISO 7064 Mod 97-10 algorithm.
 */
const ibanChecksum = (raw: string): boolean => {
  const normalized = raw.replace(/\s/g, "").toUpperCase();
  // Move first 4 chars to end
  const rearranged = normalized.slice(4) + normalized.slice(0, 4);
  // Convert letters to numbers (A=10, B=11, ..., Z=35)
  let numStr = "";
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      numStr += (code - 55).toString();
    } else {
      numStr += ch;
    }
  }
  // Mod 97 on the large number (process in chunks to avoid BigInt)
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    remainder = (remainder * 10 + parseInt(numStr[i], 10)) % 97;
  }
  return remainder === 1;
};

const isValidIBAN = (raw: string): boolean => {
  const normalized = raw.replace(/\s/g, "").toUpperCase();
  const country = normalized.slice(0, 2);
  const expectedLen = IBAN_LENGTHS[country];
  if (!expectedLen) return false;
  if (normalized.length !== expectedLen) return false;
  return ibanChecksum(raw);
};

// Leaf tokens
const upperLetter = regex(/[A-Z]/, "uppercase letter");
const ibanDigit = regex(/\d/, "digit");
const alphanumGroup = regex(/[A-Z0-9]{1,4}/, "BBAN group");

type IBANLanguage = {
  /** Country code: 2 uppercase letters */
  Country: Parser<string>;
  /** Check digits: exactly 2 digits */
  CheckDigits: Parser<string>;
  /** BBAN body: groups of 1-4 alphanumeric chars, optionally space-separated */
  BBAN: Parser<string>;
  /** Full IBAN: country + check + BBAN, validated */
  Raw: Parser<string>;
  Full: Parser<IBANEntity>;
  parser: Parser<IBANEntity>;
};

/**
 * IBAN parser language.
 *
 * Structure: `CC` `DD` `BBAN...` where CC is the country code, DD the check
 * digits, and BBAN is 3-8 groups of 1-4 alphanumeric characters (optionally
 * space-separated). Validated with ISO 7064 Mod 97-10 checksum and per-country
 * length checks.
 */
export const IBAN: IBANLanguage = createLanguage<IBANLanguage>({
  // Two uppercase letters
  Country: () => map(repeat(2, upperLetter), (letters) => letters.join("")),

  // Two digits
  CheckDigits: () => map(repeat(2, ibanDigit), (digits) => digits.join("")),

  // BBAN: multiple groups of 1-4 alphanumerics with optional spaces between.
  // Each group is preceded by an optional space, so the first group handles
  // the space between check digits and BBAN in the spaced form (GB29 NWBK...).
  // `many` stays at the last successful group — it does NOT consume a trailing
  // space when the next group fails (lowercase text like "please").
  BBAN: () =>
    map(
      many1(seq(optional(str(" ")), alphanumGroup)),
      (parts) => parts.map(([, g]) => g).join(""),
    ),

  // Assemble and validate
  Raw: (s) =>
    guard(
      map(
        seq(s.Country, s.CheckDigits, s.BBAN),
        (_, b, a) => b.text.substring(b.index, a.index),
      ),
      isValidIBAN,
    ),

  Full: (s) =>
    map(s.Raw, (raw, b, a) => {
      const normalized = raw.replace(/\s/g, "").toUpperCase();
      return iban(
        {
          iban: normalized,
          country: normalized.slice(0, 2),
        },
        b,
        a,
      );
    }),
  parser: (s) => dot(s.Full),
});
