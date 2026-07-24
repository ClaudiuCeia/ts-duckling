import {
  any,
  type Context,
  defineLanguage,
  digit,
  either,
  eof,
  keepNonNull,
  many1,
  map,
  minus,
  number,
  optional,
  type Parser,
  peek,
  regex,
  repeat,
  sepBy1,
  seq,
  signed,
  skip1,
  space,
  str,
} from "@claudiu-ceia/combine";
import type { Language as DefinedLanguage } from "@claudiu-ceia/combine";
import { __, dot, nonWord } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { fuzzyCase } from "./parsers.ts";

/**
 * Numeric quantity entity.
 */
export type QuantityEntity = Entity<
  "quantity",
  {
    amount: number;
  }
>;

/**
 * Digits-only integer quantity.
 *
 * Useful for structured tokens where `Quantity.innerParser` is too permissive.
 */
export const Int = (): Parser<QuantityEntity> => {
  return map(
    map(many1(digit()), (ds) => parseInt(ds.join(""))),
    (amount, b, a) => quantity({ amount }, b, a),
  );
};

/**
 * Parses exactly `n` digits as a `QuantityEntity`.
 */
export const IntN = (n: number): Parser<QuantityEntity> => {
  return map(
    map(repeat(n, digit()), (ds) => parseInt(ds.join(""))),
    (amount, b, a) => quantity({ amount }, b, a),
  );
};

const quantity = (
  value: {
    amount: number;
  },
  before: Context,
  after: Context,
): QuantityEntity => {
  return ent(
    {
      ...value,
    },
    "quantity",
    before,
    after,
  );
};

type QuantityOutputs = {
  Literal: number;
  ShortLiteral: number;
  Under: string;
  LeadDigit: number;
  TwoLeadDigit: number;
  ThreeLeadDigit: number;
  ThreeDigitGroup: string;
  CommaSeparated: number;
  Fractional: string;
  FractionalComma: number;
  Signed: number;
  NonFractional: QuantityEntity;
  Numbers: number;
  innerParser: QuantityEntity;
  parser: QuantityEntity;
};

/**
 * Quantity parser language.
 */
export const Quantity: DefinedLanguage<QuantityOutputs> = defineLanguage<
  QuantityOutputs
>({
  Literal: (): Parser<number> => {
    return any(
      map(regex(/hundreds?/i, "hundred"), () => 100),
      map(regex(/thousands?|k/i, "thousand"), () => 1000),
      map(regex(/millions?/i, "million"), () => 1000000),
      map(regex(/billions?/i, "billion"), () => 1000000000),
      map(regex(/trillions?/i, "trillion"), () => 1000000000000),
    );
  },
  ShortLiteral: (): Parser<number> => {
    return any(
      map(str("K"), () => 1000),
      map(str("M"), () => 1000000),
      map(str("B"), () => 1000000000),
      map(str("T"), () => 1000000000000),
    );
  },
  Under: (): Parser<string> => {
    return __(
      any(
        fuzzyCase("under"),
        fuzzyCase("less than"),
        fuzzyCase("lower than"),
      ),
    );
  },
  LeadDigit: (): Parser<number> => {
    return minus(digit(), str("0"));
  },
  TwoLeadDigit: (s): Parser<number> => {
    return map(
      seq(s.LeadDigit, digit()),
      ([d1, d2]) => parseInt(`${d1}${d2}`),
    );
  },
  ThreeLeadDigit: (s): Parser<number> => {
    return map(
      seq(s.TwoLeadDigit, digit()),
      ([d1, d2]) => parseInt(`${d1}${d2}`),
    );
  },
  ThreeDigitGroup: (): Parser<string> => {
    return map(
      repeat(3, digit()),
      (digits) => digits.reduce((acc, d) => `${acc}${d}`, ""),
    );
  },
  CommaSeparated: (s): Parser<number> => {
    return map(
      seq(
        any(s.ThreeLeadDigit, s.TwoLeadDigit, s.LeadDigit),
        str(","),
        keepNonNull(sepBy1(s.ThreeDigitGroup, skip1(str(",")))),
      ),
      ([first, _dot, rest]) => {
        const restJoin = rest.reduce((acc, d) => `${acc}${d}`, "");
        return parseInt(`${first}${restJoin}`);
      },
    );
  },
  Fractional: (): Parser<string> => {
    return map(
      seq(
        str("."),
        map(
          many1(digit()),
          (digs) => digs.reduce((acc, d) => `${acc}${d}`, ""),
        ),
      ),
      ([_dot, rest]) => rest,
    );
  },
  FractionalComma: (s): Parser<number> => {
    return map(
      seq(s.CommaSeparated, optional(s.Fractional)),
      ([num, fraction]) => parseFloat(`${num}.${fraction || ""}`),
    );
  },
  Signed: (s): Parser<number> => {
    return map(
      seq(
        any(str("+"), str("-"), str("±")),
        any(number(), s.FractionalComma),
      ),
      ([sign, num]) => (sign === "-" ? num * -1 : num),
    );
  },
  NonFractional: (s): Parser<QuantityEntity> => {
    return map(
      any(
        s.CommaSeparated,
        map(
          seq(s.Under, any(s.CommaSeparated, number())),
          ([, n]) => -n,
        ),
        signed(),
        number(),
      ),
      (n, b, a) => quantity({ amount: n }, b, a),
    );
  },
  Numbers: (s): Parser<number> => {
    return any(
      s.FractionalComma,
      map(
        seq(s.Under, any(s.FractionalComma, number())),
        ([, n]) => -n,
      ),
      s.Signed,
      number(),
    );
  },
  innerParser: (s): Parser<QuantityEntity> => {
    return map(
      any(
        map(
          seq(
            s.Numbers,
            optional(space()),
            either(s.Literal, s.ShortLiteral),
            peek(any(space(), nonWord, eof())),
          ),
          ([num, _, lit]) => num * lit,
        ),
        s.Literal,
        s.Numbers,
      ),
      (n, b, a) => quantity({ amount: n }, b, a),
    );
  },
  parser: (s): Parser<QuantityEntity> => {
    return dot(s.innerParser);
  },
});
