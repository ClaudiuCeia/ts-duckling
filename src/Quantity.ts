import {
  any,
  type Context,
  defineLanguage,
  digit,
  either,
  eof,
  many1,
  map,
  minus,
  number,
  optional,
  type Parser,
  peek,
  repeat,
  sepBy1,
  seq,
  skip1,
  space,
  str,
} from "@claudiu-ceia/combine";
import type { Language as DefinedLanguage } from "@claudiu-ceia/combine";
import parserData from "../data/parser-en.json" with { type: "json" };
import { __, dot, nonWord } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { fuzzyCase } from "./parsers.ts";

type EnglishQuantityData = {
  quantity: {
    symbols: {
      decimal: string;
      group: string;
      minus: string;
      plus: string;
    };
    compactMultipliers: {
      value: number;
      long: string;
      short: string;
    }[];
  };
  compatibility: {
    quantity: {
      multiplierNames: { value: number; names: string[] }[];
      plusMinus: string;
      under: string[];
    };
  };
};

const english = parserData as EnglishQuantityData;
const longestFirst = <T extends { token: string }>(entries: T[]) =>
  [...entries].sort(
    (a, b) => b.token.length - a.token.length || a.token.localeCompare(b.token),
  );

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
export const Quantity: DefinedLanguage<QuantityOutputs> =
  defineLanguage<QuantityOutputs>({
    Literal: (): Parser<number> => {
      const entries = [
        ...english.quantity.compactMultipliers.map(({ value, long }) => ({
          value,
          token: long,
        })),
        ...english.compatibility.quantity.multiplierNames.flatMap(
          ({ value, names }) => names.map((token) => ({ value, token })),
        ),
      ];
      return any(
        ...longestFirst(entries).map(({ value, token }) =>
          map(fuzzyCase(token), () => value),
        ),
      );
    },
    ShortLiteral: (): Parser<number> => {
      return any(
        ...longestFirst(
          english.quantity.compactMultipliers.map(({ value, short }) => ({
            value,
            token: short,
          })),
        ).map(({ value, token }) => map(str(token), () => value)),
      );
    },
    Under: (): Parser<string> => {
      return __(
        any(
          ...longestFirst(
            english.compatibility.quantity.under.map((token) => ({ token })),
          ).map(({ token }) => fuzzyCase(token)),
        ),
      );
    },
    LeadDigit: (): Parser<number> => {
      return minus(digit(), str("0"));
    },
    TwoLeadDigit: (s): Parser<number> => {
      return map(seq(s.LeadDigit, digit()), ([d1, d2]) =>
        parseInt(`${d1}${d2}`),
      );
    },
    ThreeLeadDigit: (s): Parser<number> => {
      return map(seq(s.TwoLeadDigit, digit()), ([d1, d2]) =>
        parseInt(`${d1}${d2}`),
      );
    },
    ThreeDigitGroup: (): Parser<string> => {
      return map(repeat(3, digit()), (digits) =>
        digits.reduce((acc, d) => `${acc}${d}`, ""),
      );
    },
    CommaSeparated: (s): Parser<number> => {
      return map(
        seq(
          any(s.ThreeLeadDigit, s.TwoLeadDigit, s.LeadDigit),
          str(english.quantity.symbols.group),
          sepBy1(s.ThreeDigitGroup, skip1(str(english.quantity.symbols.group))),
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
          str(english.quantity.symbols.decimal),
          map(many1(digit()), (digs) =>
            digs.reduce((acc, d) => `${acc}${d}`, ""),
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
          any(
            str(english.quantity.symbols.plus),
            str(english.quantity.symbols.minus),
            str(english.compatibility.quantity.plusMinus),
          ),
          any(number(), s.FractionalComma),
        ),
        ([sign, num]) =>
          sign === english.quantity.symbols.minus ? num * -1 : num,
      );
    },
    NonFractional: (s): Parser<QuantityEntity> => {
      return map(
        any(
          s.CommaSeparated,
          map(seq(s.Under, any(s.CommaSeparated, number())), ([, n]) => -n),
          map(
            seq(
              any(
                str(english.quantity.symbols.plus),
                str(english.quantity.symbols.minus),
              ),
              number(),
            ),
            ([sign, num]) =>
              sign === english.quantity.symbols.minus ? num * -1 : num,
          ),
          number(),
        ),
        (n, b, a) => quantity({ amount: n }, b, a),
      );
    },
    Numbers: (s): Parser<number> => {
      return any(
        s.FractionalComma,
        map(seq(s.Under, any(s.FractionalComma, number())), ([, n]) => -n),
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
            ([num, , lit]) => num * lit,
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
