import {
  any,
  createLanguage,
  seq,
  str,
  map,
  Context,
  either,
  Parser,
  optional,
} from "https://deno.land/x/combine@v0.0.8/mod.ts";
import { __, dot, EntityLanguage } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import { Quantity, QuantityEntity } from "./Quantity.ts";
import { Temperature, TemperatureEntity } from "./Temperature.ts";
import { Time, TimeEntity } from "./Time.ts";

export type RangeEntity<E extends Entity<unknown, unknown>> = Entity<
  "range",
  {
    min: E;
    max: E;
  }
>;

const range = <E extends Entity<unknown, unknown>>(
  value: {
    min: E;
    max: E;
  },
  before: Context,
  after: Context
): RangeEntity<E> => {
  return ent(value, "range", before, after);
};

type RangeEntityLanguage = EntityLanguage<
  {
    TemperatureRange: Parser<RangeEntity<TemperatureEntity>>;
    TimeRange: Parser<RangeEntity<TimeEntity>>;
  },
  RangeEntity<QuantityEntity | TemperatureEntity | TimeEntity>
>;

export const Range = createLanguage<RangeEntityLanguage>({
  TemperatureRange: () =>
    dot(
      map(
        seq(
          __(str("between")),
          either(Temperature.parser, Quantity.parser),
          __(either(str("and"), str("-"))),
          Temperature.parser
        ),
        ([, low, , high], b, a) => {
          let min: TemperatureEntity;
          if (low.kind === "quantity") {
            min = {
              ...low,
              value: {
                unit: high.value.unit,
                amount: low,
              },
              kind: "temperature",
            };
          } else {
            min = low;
          }

          return range(
            {
              min,
              max: high,
            },
            b,
            a
          );
        }
      )
    ),
  TimeRange: () =>
    dot(
      map(
        seq(
          __(str("from")),
          optional(__(str("the"))),
          Time.parser,
          __(either(str("until"), str("to"))),
          optional(__(str("the"))),
          Time.parser
        ),
        ([, , low, , , high], b, a) => {
          return range(
            {
              min: low,
              max: high,
            },
            b,
            a
          );
        }
      )
    ),
  parser: (s) => any(s.TemperatureRange, s.TimeRange),
});
