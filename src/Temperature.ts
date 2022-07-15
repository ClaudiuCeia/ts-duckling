import {
  any,
  createLanguage,
  either,
  number,
  seq,
  seqNonNull,
  signed,
  str,
  optional,
  map,
  Parser,
Context,
} from "https://deno.land/x/combine@v0.0.5/mod.ts";
import { dot, __ } from "./common.ts";
import { ent, Entity } from "./Entity.ts";

type TemperatureEntity = Entity<
  "temperature",
  {
    amount: number;
    unit: "Celsius" | "Fahrenheit" | "N/A";
  }
>;

const temp = (
  value: {
    amount: number;
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

export const Temperature = createLanguage({
  Under: () => __(any(str("under"), str("less than"), str("lower than"))),
  Amount: (s) =>
    __(
      any(
        map(seq(s.Under, number()), ([, n]) => -n),
        signed(),
        number()
      )
    ),
  Degrees: () => __(either(str("°"), str("degrees"))),
  UnitCelsius: () =>
    map(__(any(str("Celsius"), str("celsius"), str("C"))), () => "Celsius"),
  UnitFahrenheit: () =>
    map(
      __(any(str("Fahrenheit"), str("fahrenheit"), str("F"))),
      () => "Fahrenheit"
    ),
  Celsius: (s) =>
    map(
      seqNonNull(s.Amount, optional(s.Degrees), dot(s.UnitCelsius)),
      ([amt], b, a) => temp({ amount: amt as number, unit: "Celsius" }, b, a)
    ),
  Fahrenheit: (s) =>
    map(
      seqNonNull(s.Amount, optional(s.Degrees), dot(s.UnitFahrenheit)),
      ([amt], b, a) => temp({ amount: amt as number, unit: "Fahrenheit" }, b, a)
    ),
  Unspecified: (s) =>
    map(seq(s.Amount, s.Degrees), ([amt], b, a) =>
      temp({ amount: amt as number }, b, a)
    ),
  BelowZero: (s) =>
    map(
      seq(
        s.Amount,
        optional(s.Degrees),
        optional(either(s.UnitCelsius, s.UnitFahrenheit)),
        dot(seqNonNull(__(str("below")), either(str("zero"), str("0"))))
      ),
      ([amt, _deg, unit], b, a) =>
        temp(
          {
            amount: (amt as number) * -1,
            unit: (unit as TemperatureEntity["value"]["unit"]) || undefined,
          },
          b,
          a
        )
    ),
  Exact: (s): Parser<TemperatureEntity> =>
    any(
      s.Celsius as Parser<TemperatureEntity>,
      s.Fahrenheit as Parser<TemperatureEntity>,
      s.BelowZero as Parser<TemperatureEntity>,
      s.Unspecified as Parser<TemperatureEntity>
    ),
});
