import {
  any,
  createLanguage,
  number,
  seq,
  str,
  map,
  Context,
  Parser,
  minus,
  digit,
  repeat,
  keepNonNull,
  skip1,
  sepBy1,
  many1,
  optional,
  signed,
  regex,
  space,
} from "combine/mod.ts";
import { __, dot, EntityLanguage } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import { fuzzyCase } from "./parsers.ts";

export type QuantityEntity = Entity<
  "quantity",
  {
    amount: number;
  }
>;

const quantity = (
  value: {
    amount: number;
  },
  before: Context,
  after: Context
): QuantityEntity => {
  return ent(
    {
      ...value,
    },
    "quantity",
    before,
    after
  );
};

type QuantityEntityLanguage = EntityLanguage<
  {
    Numbers: Parser<number>;
    Literal: Parser<number>;
    Under: Parser<string>;
    LeadDigit: Parser<number>;
    TwoLeadDigit: Parser<number>;
    ThreeLeadDigit: Parser<number>;
    ThreeDigitGroup: Parser<string>;
    Signed: Parser<number>;
    Fractional: Parser<string>;
    FractionalComma: Parser<number>;
    CommaSeparated: Parser<number>;
    NonFractional: Parser<QuantityEntity>;
    innerParser: Parser<QuantityEntity>;
  },
  QuantityEntity
>;

export const Quantity = createLanguage<QuantityEntityLanguage>({
  Literal: () =>
    any(
      map(regex(/hundreds?/i, "hundred"), () => 100),
      map(regex(/thousands?/i, "thousand"), () => 1000),
      map(regex(/millions?/i, "million"), () => 1000000),
      map(regex(/billions?/i, "billion"), () => 1000000000),
      map(regex(/trillions?/i, "trillion"), () => 1000000000000)
    ),
  Under: () =>
    __(
      any(fuzzyCase("under"), fuzzyCase("less than"), fuzzyCase("lower than"))
    ),
  LeadDigit: () => minus(digit(), str("0")),
  TwoLeadDigit: (s) =>
    map(seq(s.LeadDigit, digit()), ([d1, d2]) => parseInt(`${d1}${d2}`)),
  ThreeLeadDigit: (s) =>
    map(seq(s.TwoLeadDigit, digit()), ([d1, d2]) => parseInt(`${d1}${d2}`)),
  ThreeDigitGroup: () =>
    map(repeat(3, digit()), (digits) =>
      digits.reduce((acc, d) => `${acc}${d}`, "")
    ),
  CommaSeparated: (s) =>
    map(
      seq(
        any(s.ThreeLeadDigit, s.TwoLeadDigit, s.LeadDigit),
        str(","),
        keepNonNull(sepBy1(s.ThreeDigitGroup, skip1(str(","))))
      ),
      ([first, _dot, rest]) => {
        const restJoin = rest.reduce((acc, d) => `${acc}${d}`, "");
        return parseInt(`${first}${restJoin}`);
      }
    ),
  Fractional: () =>
    map(
      seq(
        str("."),
        map(many1(digit()), (digs) => digs.reduce((acc, d) => `${acc}${d}`, ""))
      ),
      ([_dot, rest]) => rest
    ),
  FractionalComma: (s) =>
    map(seq(s.CommaSeparated, optional(s.Fractional)), ([num, fraction]) =>
      parseFloat(`${num}.${fraction || ""}`)
    ),
  Signed: (s) =>
    map(
      seq(any(str("+"), str("-"), str("±")), any(number(), s.FractionalComma)),
      ([sign, num]) => (sign === "-" ? num * -1 : num)
    ),
  NonFractional: (s) =>
    map(
      any(
        s.CommaSeparated,
        map(seq(s.Under, any(s.CommaSeparated, number())), ([, n]) => -n),
        signed(),
        number()
      ),
      (n, b, a) => quantity({ amount: n }, b, a)
    ),
  Numbers: (s) =>
    any(
      s.FractionalComma,
      map(seq(s.Under, any(s.FractionalComma, number())), ([, n]) => -n),
      s.Signed,
      number()
    ),
  innerParser: (s) =>
    map(
      any(
        map(
          seq(s.Numbers, optional(space()), s.Literal),
          ([num, _, lit]) => num * lit
        ),
        s.Numbers
      ),
      (n, b, a) => quantity({ amount: n }, b, a)
    ),
  parser: (s) => dot(s.innerParser),
});
