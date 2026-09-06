import {
  any,
  type Context,
  defineLanguage,
  either,
  map,
  optional,
  seq,
  seqNonNull,
  skip1,
  space,
  str,
} from "@claudiu-ceia/combine";
import type {
  Language as DefinedLanguage,
  Parser,
} from "@claudiu-ceia/combine";
import parserData from "../data/parser-en.json" with { type: "json" };
import { __, dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { Quantity, type QuantityEntity } from "./Quantity.ts";
import { enumerationTail, peekValue } from "./parsers.ts";

type TemperatureUnit = "Celsius" | "Fahrenheit";
type EnglishTemperatureData = {
  temperature: {
    degree: {
      one: string;
      other: string;
      symbol: string;
    };
    units: Record<TemperatureUnit, { name: string; symbol: string }>;
  };
  compatibility: {
    temperature: {
      below: string[];
      units: Record<TemperatureUnit, string[]>;
      zero: string[];
    };
  };
};

const english = parserData as EnglishTemperatureData;
const longestFirst = (tokens: string[]) =>
  [...new Set(tokens)].sort(
    (a, b) => b.length - a.length || a.localeCompare(b),
  );
const unitTokens = (unit: TemperatureUnit) => {
  const name = english.temperature.units[unit].name;
  return longestFirst([
    name,
    name.toLowerCase(),
    ...english.compatibility.temperature.units[unit],
  ]);
};

/**
 * Temperature entity with a numeric amount (as a `quantity`) and a unit.
 */
export type TemperatureEntity = Entity<
  "temperature",
  {
    amount: QuantityEntity;
    unit: "Celsius" | "Fahrenheit" | "N/A";
  }
>;

/**
 * Helper for constructing a `TemperatureEntity`.
 */
export const temp = (
  value: {
    amount: QuantityEntity;
    unit?: TemperatureEntity["value"]["unit"];
  },
  before: Context,
  after: Context,
): TemperatureEntity => {
  return ent(
    {
      ...value,
      unit: value.unit || "N/A",
    },
    "temperature",
    before,
    after,
  );
};

type TemperatureOutputs = {
  Degrees: string;
  UnitCelsius: "Celsius";
  UnitFahrenheit: "Fahrenheit";
  Celsius: TemperatureEntity;
  Fahrenheit: TemperatureEntity;
  Unspecified: TemperatureEntity;
  BelowZero: TemperatureEntity;
  Implicit: TemperatureEntity;
  parser: TemperatureEntity;
};

/**
 * Temperature parser language.
 */
export const Temperature: DefinedLanguage<TemperatureOutputs> =
  defineLanguage<TemperatureOutputs>({
    Degrees: (): Parser<string> => {
      return any(
        ...longestFirst([
          english.temperature.degree.symbol,
          english.temperature.degree.one,
          english.temperature.degree.other,
        ]).map(str),
      );
    },
    UnitCelsius: (): Parser<"Celsius"> => {
      return map(any(...unitTokens("Celsius").map(str)), () => "Celsius");
    },
    UnitFahrenheit: (): Parser<"Fahrenheit"> => {
      return map(any(...unitTokens("Fahrenheit").map(str)), () => "Fahrenheit");
    },
    Celsius: (s): Parser<TemperatureEntity> => {
      return any(
        map(
          seq(
            Quantity.innerParser,
            optional(space()),
            str(english.temperature.units.Celsius.symbol),
          ),
          ([amt], b, a) => temp({ amount: amt, unit: "Celsius" }, b, a),
        ),
        map(
          seqNonNull<QuantityEntity | string | null>(
            Quantity.innerParser,
            optional(space()),
            optional(s.Degrees),
            optional(space()),
            s.UnitCelsius,
          ),
          ([amt], b, a) =>
            temp({ amount: amt as QuantityEntity, unit: "Celsius" }, b, a),
        ),
      );
    },
    Fahrenheit: (s): Parser<TemperatureEntity> => {
      return any(
        map(
          seq(
            Quantity.innerParser,
            optional(space()),
            str(english.temperature.units.Fahrenheit.symbol),
          ),
          ([amt], b, a) => temp({ amount: amt, unit: "Fahrenheit" }, b, a),
        ),
        map(
          seqNonNull<QuantityEntity | string | null>(
            Quantity.innerParser,
            optional(space()),
            optional(s.Degrees),
            optional(space()),
            s.UnitFahrenheit,
          ),
          ([amt], b, a) =>
            temp({ amount: amt as QuantityEntity, unit: "Fahrenheit" }, b, a),
        ),
      );
    },
    Unspecified: (_s): Parser<TemperatureEntity> => {
      return map(
        seq(
          Quantity.innerParser,
          optional(space()),
          either(
            str(english.temperature.degree.symbol),
            str(english.temperature.degree.other),
          ),
        ),
        ([amt], b, a) => temp({ amount: amt as QuantityEntity }, b, a),
      );
    },
    BelowZero: (s): Parser<TemperatureEntity> => {
      return map(
        seq(
          Quantity.innerParser,
          optional(s.Degrees),
          optional(space()),
          optional(either(s.UnitCelsius, s.UnitFahrenheit)),
          seqNonNull(
            skip1(space()),
            __(
              any(
                ...longestFirst(english.compatibility.temperature.below).map(
                  str,
                ),
              ),
            ),
            any(
              ...longestFirst(english.compatibility.temperature.zero).map(str),
            ),
          ),
        ),
        ([amt, _deg, _space, unit], b, a) =>
          temp(
            {
              amount: {
                ...amt,
                value: {
                  amount: amt.value.amount * -1,
                },
              },
              unit: unit || undefined,
            },
            b,
            a,
          ),
      );
    },
    Implicit: (s): Parser<TemperatureEntity> => {
      return map(
        seq(
          Quantity.innerParser,
          peekValue(
            enumerationTail(
              Quantity.innerParser,
              dot(any(s.Celsius, s.Fahrenheit, s.Unspecified)),
            ),
          ),
        ),
        ([amount, final], b, a) =>
          temp({ amount, unit: final.value.unit }, b, a),
      );
    },
    parser: (s): Parser<TemperatureEntity> => {
      return dot(
        any(s.BelowZero, s.Implicit, s.Celsius, s.Fahrenheit, s.Unspecified),
      );
    },
  });
