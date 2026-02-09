import {
  any,
  type Context,
  createLanguageThis,
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
  Degrees: () => Parser<string>;
  UnitCelsius: () => Parser<"Celsius">;
  UnitFahrenheit: () => Parser<"Fahrenheit">;
  Celsius: () => Parser<TemperatureEntity>;
  Fahrenheit: () => Parser<TemperatureEntity>;
  Unspecified: () => Parser<TemperatureEntity>;
  BelowZero: () => Parser<TemperatureEntity>;
  parser: () => Parser<TemperatureEntity>;
};

export const Temperature: ReturnType<
  typeof createLanguageThis<TemperatureLanguage>
> = createLanguageThis<TemperatureLanguage>({
  Degrees: function (): Parser<string> {
    return either(str("°"), str("degrees"));
  },
  UnitCelsius: function (): Parser<"Celsius"> {
    return map(any(str("Celsius"), str("celsius"), str("C")), () => "Celsius");
  },
  UnitFahrenheit: function (): Parser<"Fahrenheit"> {
    return map(
      any(str("Fahrenheit"), str("fahrenheit"), str("F")),
      () => "Fahrenheit",
    );
  },
  Celsius: function (): Parser<TemperatureEntity> {
    return map(
      seqNonNull<QuantityEntity | string | null>(
        Quantity.innerParser,
        optional(space()),
        optional(this.Degrees),
        optional(space()),
        this.UnitCelsius,
      ),
      ([amt], b, a) =>
        temp({ amount: amt as QuantityEntity, unit: "Celsius" }, b, a),
    );
  },
  Fahrenheit: function (): Parser<TemperatureEntity> {
    return map(
      seqNonNull<QuantityEntity | string | null>(
        Quantity.innerParser,
        optional(space()),
        optional(this.Degrees),
        optional(space()),
        this.UnitFahrenheit,
      ),
      ([amt], b, a) =>
        temp({ amount: amt as QuantityEntity, unit: "Fahrenheit" }, b, a),
    );
  },
  Unspecified: function (): Parser<TemperatureEntity> {
    return map(
      seq(Quantity.innerParser, optional(space()), this.Degrees),
      ([amt], b, a) => temp({ amount: amt as QuantityEntity }, b, a),
    );
  },
  BelowZero: function (): Parser<TemperatureEntity> {
    return map(
      seq(
        Quantity.innerParser,
        optional(this.Degrees),
        optional(space()),
        optional(either(this.UnitCelsius, this.UnitFahrenheit)),
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
  parser: function (): Parser<TemperatureEntity> {
    return dot(
      any(this.BelowZero, this.Celsius, this.Fahrenheit, this.Unspecified),
    );
  },
});
