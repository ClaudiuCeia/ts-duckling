import {
  any,
  type Context,
  createLanguage,
  many,
  map,
  optional,
  regex,
  seq,
  str,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { guard } from "./guard.ts";

/**
 * Phone number entity.
 *
 * `phone` is always the raw matched text.
 * `normalized` strips everything except `+` and digits (E.164-ish).
 */
export type PhoneEntity = Entity<
  "phone",
  {
    phone: string;
    normalized: string;
  }
>;

/**
 * Helper for constructing a `PhoneEntity`.
 */
export const phone = (
  value: PhoneEntity["value"],
  before: Context,
  after: Context,
): PhoneEntity => {
  return ent(value, "phone", before, after);
};

const normalize = (s: string): string => s.replace(/[^+\d]/g, "");

const isValidPhone = (raw: string): boolean => {
  const n = normalize(raw);
  if (n.startsWith("+")) {
    const digits = n.length - 1;
    return digits >= 8 && digits <= 15;
  }
  // US/NANP without country code: exactly 10 digits
  return n.length === 10;
};

// Leaf tokens — regex is fine for character classes
const digits = (min: number, max: number): Parser<string> =>
  regex(new RegExp(`\\d{${min},${max}}`), `${min}-${max} digits`);

const digitsSep = any(str("-"), str("."), str(" "));

type PhoneLanguage = {
  /** Strict E.164: +NNN...N (8-15 digits, no separators) */
  E164: Parser<string>;
  /** International with separators: +1 (415) 555-2671, +1-415-555-2671 */
  IntlFormatted: Parser<string>;
  /** US/NANP formatted: (NNN) NNN-NNNN or NNN-NNN-NNNN or NNN.NNN.NNNN */
  USFormatted: Parser<string>;
  /** (NNN) — parenthesized area code */
  ParenArea: Parser<string>;
  /** NNN[-.]NNN — area code with separator */
  SepArea: Parser<string>;
  Full: Parser<PhoneEntity>;
  parser: Parser<PhoneEntity>;
};

const mkPhone = (b: Context, a: Context): PhoneEntity => {
  const raw = b.text.substring(b.index, a.index);
  return phone({ phone: raw, normalized: normalize(raw) }, b, a);
};

/**
 * Phone number parser language.
 *
 * Matches:
 * - E.164 strict: `+14155552671`
 * - International formatted: `+1 (415) 555-2671`, `+1-415-555-2671`, `+44 20 7123 4567`
 * - US/NANP local: `(415) 555-2671`, `415-555-2671`, `415.555.2671`
 */
export const Phone: PhoneLanguage = createLanguage<PhoneLanguage>({
  // +<8-15 digits> — strict E.164, no separators
  E164: () =>
    map(
      seq(str("+"), digits(8, 15)),
      ([plus, d]) => `${plus}${d}`,
    ),

  // (NNN) with optional trailing separator
  ParenArea: () =>
    map(
      seq(str("("), digits(1, 5), str(")"), optional(str(" "))),
      ([, d]) => d,
    ),

  // NNN followed by - or .
  SepArea: () =>
    map(
      seq(digits(3, 3), digitsSep),
      ([d]) => d,
    ),

  // International: + countrycode separator groups...
  // +1 (415) 555-2671, +44 20 7123 4567, +49-172-1234567
  //
  // Structure: separator comes BEFORE each subsequent group (not after).
  // This prevents `many` from consuming the trailing word-boundary space.
  // When `seq(sep, group)` fails (sep matches but group doesn't), `many`
  // stays at the position before the failed seq — before the separator.
  IntlFormatted: () => {
    const justDigits = digits(1, 5);
    const parenGroup = map(
      seq(str("("), digits(1, 5), str(")")),
      ([, d]) => d,
    );
    const bodyGroup = any(justDigits, parenGroup);

    return guard(
      map(
        seq(
          str("+"),
          digits(1, 3),
          digitsSep,
          bodyGroup,
          many(seq(digitsSep, bodyGroup)),
        ),
        (_, b, a) => b.text.substring(b.index, a.index),
      ),
      isValidPhone,
    );
  },

  // US/NANP local:
  //   (415) 555-2671
  //   (415)555-2671
  //   415-555-2671
  //   415.555.2671
  USFormatted: (s) =>
    map(
      seq(
        any(s.ParenArea, s.SepArea),
        digits(3, 3),
        optional(digitsSep),
        digits(4, 4),
      ),
      () => "", // value unused, we reconstruct from span
    ),

  Full: (s) =>
    map(
      any(s.E164, s.IntlFormatted, s.USFormatted),
      (_, b, a) => mkPhone(b, a),
    ),

  parser: (s) => dot(s.Full),
});
