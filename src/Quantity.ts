import {
  any,
  Context,
  createLanguageThis,
  digit,
  either,
  eof,
  keepNonNull,
  many1,
  map,
  minus,
  number,
  optional,
  Parser,
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
import { __, dot, nonWord } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import { fuzzyCase } from "./parsers.ts";

export type QuantityEntity = Entity<
  "quantity",
  {
    amount: number;
  }
>;

// Digits-only integer quantity. Useful for structured tokens where Quantity.innerParser
// is too permissive (e.g. it may consume trailing punctuation like "6789.").
export const Int = (): Parser<QuantityEntity> => {
  return map(
    map(many1(digit()), (ds) => parseInt(ds.join(""))),
    (amount, b, a) => quantity({ amount }, b, a),
  );
};

// Parse exactly N digits as a QuantityEntity.
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

type QuantityLanguage = {
  Literal: () => Parser<number>;
  ShortLiteral: () => Parser<number>;
  Under: () => Parser<string>;
  LeadDigit: () => Parser<number>;
  TwoLeadDigit: () => Parser<number>;
  ThreeLeadDigit: () => Parser<number>;
  ThreeDigitGroup: () => Parser<string>;
  CommaSeparated: () => Parser<number>;
  Fractional: () => Parser<string>;
  FractionalComma: () => Parser<number>;
  Signed: () => Parser<number>;
  NonFractional: () => Parser<QuantityEntity>;
  Numbers: () => Parser<number>;
  innerParser: () => Parser<QuantityEntity>;
  parser: () => Parser<QuantityEntity>;
};

export const Quantity = createLanguageThis<QuantityLanguage>({
  Literal: function (): Parser<number> {
    return any(
      map(regex(/hundreds?/i, "hundred"), () => 100),
      map(regex(/thousands?|k/i, "thousand"), () => 1000),
      map(regex(/millions?/i, "million"), () => 1000000),
      map(regex(/billions?/i, "billion"), () => 1000000000),
      map(regex(/trillions?/i, "trillion"), () => 1000000000000),
    );
  },
  ShortLiteral: function (): Parser<number> {
    return any(
      map(str("K"), () => 1000),
      map(str("M"), () => 1000000),
      map(str("B"), () => 1000000000),
      map(str("T"), () => 1000000000000),
    );
  },
  Under: function (): Parser<string> {
    return __(
      any(fuzzyCase("under"), fuzzyCase("less than"), fuzzyCase("lower than")),
    );
  },
  LeadDigit: function (): Parser<number> {
    return minus(digit(), str("0"));
  },
  TwoLeadDigit: function (): Parser<number> {
    return map(
      seq(this.LeadDigit, digit()),
      ([d1, d2]) => parseInt(`${d1}${d2}`),
    );
  },
  ThreeLeadDigit: function (): Parser<number> {
    return map(
      seq(this.TwoLeadDigit, digit()),
      ([d1, d2]) => parseInt(`${d1}${d2}`),
    );
  },
  ThreeDigitGroup: function (): Parser<string> {
    return map(
      repeat(3, digit()),
      (digits) => digits.reduce((acc, d) => `${acc}${d}`, ""),
    );
  },
  CommaSeparated: function (): Parser<number> {
    return map(
      seq(
        any(this.ThreeLeadDigit, this.TwoLeadDigit, this.LeadDigit),
        str(","),
        keepNonNull(sepBy1(this.ThreeDigitGroup, skip1(str(",")))),
      ),
      ([first, _dot, rest]) => {
        const restJoin = rest.reduce((acc, d) => `${acc}${d}`, "");
        return parseInt(`${first}${restJoin}`);
      },
    );
  },
  Fractional: function (): Parser<string> {
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
  FractionalComma: function (): Parser<number> {
    return map(
      seq(this.CommaSeparated, optional(this.Fractional)),
      ([num, fraction]) => parseFloat(`${num}.${fraction || ""}`),
    );
  },
  Signed: function (): Parser<number> {
    return map(
      seq(
        any(str("+"), str("-"), str("±")),
        any(number(), this.FractionalComma),
      ),
      ([sign, num]) => (sign === "-" ? num * -1 : num),
    );
  },
  NonFractional: function (): Parser<QuantityEntity> {
    return map(
      any(
        this.CommaSeparated,
        map(
          seq(this.Under, any(this.CommaSeparated, number())),
          ([, n]) => -n,
        ),
        signed(),
        number(),
      ),
      (n, b, a) => quantity({ amount: n }, b, a),
    );
  },
  Numbers: function (): Parser<number> {
    return any(
      this.FractionalComma,
      map(seq(this.Under, any(this.FractionalComma, number())), ([, n]) => -n),
      this.Signed,
      number(),
    );
  },
  innerParser: function (): Parser<QuantityEntity> {
    return map(
      any(
        map(
          seq(
            this.Numbers,
            optional(space()),
            either(this.Literal, this.ShortLiteral),
            peek(any(space(), nonWord, eof())),
          ),
          ([num, _, lit]) => num * lit,
        ),
        this.Literal,
        this.Numbers,
      ),
      (n, b, a) => quantity({ amount: n }, b, a),
    );
  },
  parser: function (): Parser<QuantityEntity> {
    return dot(this.innerParser);
  },
});
