import {
  any,
  createLanguage,
  either,
  seq,
  seqNonNull,
  str,
  optional,
  map,
  Parser,
  Context,
space,
skip1,
} from "/combine";
import { EntityLanguage, __ } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import { Quantity, QuantityEntity } from "./Quantity.ts";

export type TemperatureEntity = Entity<
  "temperature",
  {
    amount: QuantityEntity;
    unit: "Celsius" | "Fahrenheit" | "N/A";
  }
>;

export const temp = (
  value: {
    amount: QuantityEntity;
    unit?: TemperatureEntity["value"]["unit"];
  },
  before: Context,
  after: Context
): TemperatureEntity => {
  return ent(
    {
      ...value,
      unit: value.unit || "N/A",
    },
    "temperature",
    before,
    after
  );
};

type TemperatureEntityLanguage = EntityLanguage<
  {
    Degrees: Parser<string>;
    UnitCelsius: Parser<"Celsius" | "Fahrenheit" | "N/A">;
    UnitFahrenheit: Parser<"Celsius" | "Fahrenheit" | "N/A">;
    Celsius: Parser<TemperatureEntity>;
    Fahrenheit: Parser<TemperatureEntity>;
    Unspecified: Parser<TemperatureEntity>;
    BelowZero: Parser<TemperatureEntity>;
  },
  TemperatureEntity
>;

export const Temperature = createLanguage<TemperatureEntityLanguage>({
  Degrees: () => either(str("°"), str("degrees")),
  UnitCelsius: () =>
    map(any(str("Celsius"), str("celsius"), str("C")), () => "Celsius"),
  UnitFahrenheit: () =>
    map(
      any(str("Fahrenheit"), str("fahrenheit"), str("F")),
      () => "Fahrenheit"
    ),
  Celsius: (s) =>
    map(
      seqNonNull<QuantityEntity | string | null>(
        Quantity.innerParser,
        optional(space()),
        optional(s.Degrees),
        optional(space()),
        s.UnitCelsius
      ),
      ([amt], b, a) =>
        temp({ amount: amt as QuantityEntity, unit: "Celsius" }, b, a)
    ),
  Fahrenheit: (s) =>
    map(
      seqNonNull<QuantityEntity | string | null>(
        Quantity.innerParser,
        optional(space()),
        optional(s.Degrees),
        optional(space()),
        s.UnitFahrenheit
      ),
      ([amt], b, a) =>
        temp({ amount: amt as QuantityEntity, unit: "Fahrenheit" }, b, a)
    ),
  Unspecified: (s) =>
    map(
      seq(Quantity.innerParser, optional(space()), s.Degrees),
      ([amt], b, a) => temp({ amount: amt as QuantityEntity }, b, a)
    ),
  BelowZero: (s) =>
    map(
      seq(
        Quantity.innerParser,
        optional(s.Degrees),
        optional(space()),
        optional(either(s.UnitCelsius, s.UnitFahrenheit)),
        seqNonNull(
          skip1(space()),
          __(str("below")),
          either(str("zero"), str("0"))
        )
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
          a
        )
    ),
  parser: (s) => any(s.BelowZero, s.Celsius, s.Fahrenheit, s.Unspecified),
});
