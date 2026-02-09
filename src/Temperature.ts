import {
  any,
  type Context,
  createLanguage,
  either,
  map,
  optional,
  seq,
  seqNonNull,
  skip1,
  space,
  str,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { __, dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { Quantity, type QuantityEntity } from "./Quantity.ts";

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

type TemperatureLanguage = {
  Degrees: Parser<string>;
  UnitCelsius: Parser<"Celsius">;
  UnitFahrenheit: Parser<"Fahrenheit">;
  Celsius: Parser<TemperatureEntity>;
  Fahrenheit: Parser<TemperatureEntity>;
  Unspecified: Parser<TemperatureEntity>;
  BelowZero: Parser<TemperatureEntity>;
  parser: Parser<TemperatureEntity>;
};

/**
 * Temperature parser language.
 */
export const Temperature: TemperatureLanguage = createLanguage<
  TemperatureLanguage
>({
  Degrees: (): Parser<string> => {
    return either(str("°"), str("degrees"));
  },
  UnitCelsius: (): Parser<"Celsius"> => {
    return map(any(str("Celsius"), str("celsius"), str("C")), () => "Celsius");
  },
  UnitFahrenheit: (): Parser<"Fahrenheit"> => {
    return map(
      any(str("Fahrenheit"), str("fahrenheit"), str("F")),
      () => "Fahrenheit",
    );
  },
  Celsius: (s): Parser<TemperatureEntity> => {
    return map(
      seqNonNull<QuantityEntity | string | null>(
        Quantity.innerParser,
        optional(space()),
        optional(s.Degrees),
        optional(space()),
        s.UnitCelsius,
      ),
      ([amt], b, a) =>
        temp({ amount: amt as QuantityEntity, unit: "Celsius" }, b, a),
    );
  },
  Fahrenheit: (s): Parser<TemperatureEntity> => {
    return map(
      seqNonNull<QuantityEntity | string | null>(
        Quantity.innerParser,
        optional(space()),
        optional(s.Degrees),
        optional(space()),
        s.UnitFahrenheit,
      ),
      ([amt], b, a) =>
        temp({ amount: amt as QuantityEntity, unit: "Fahrenheit" }, b, a),
    );
  },
  Unspecified: (s): Parser<TemperatureEntity> => {
    return map(
      seq(Quantity.innerParser, optional(space()), s.Degrees),
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
          __(str("below")),
          either(str("zero"), str("0")),
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
  parser: (s): Parser<TemperatureEntity> => {
    return dot(
      any(s.BelowZero, s.Celsius, s.Fahrenheit, s.Unspecified),
    );
  },
});
