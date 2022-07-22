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
} from "/combine";
import { __, EntityLanguage } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import { Quantity, QuantityEntity } from "./Quantity.ts";
import { Temperature, TemperatureEntity } from "./Temperature.ts";
import { time, Time, TimeEntity } from "./Time.ts";

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
    YearRange: Parser<RangeEntity<TimeEntity>>;
  },
  RangeEntity<QuantityEntity | TemperatureEntity | TimeEntity>
>;

export const Range = createLanguage<RangeEntityLanguage>({
  TemperatureRange: () =>
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
    ),
  TimeRange: () =>
    any(
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
      ),
      map(
        seq(
          __(str("between")),
          optional(__(str("the"))),
          Time.parser,
          __(str("and")),
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
  YearRange: () =>
    map(
      seq(__(str("between")), Quantity.parser, __(str("and")), Time.YearEra),
      ([, low, , high], b, a) => {
        return range(
          {
            min: time(
              {
                when: `${low.value.amount} ${high.value.era}`,
                grain: "era",
                era: high.value.era,
              },
              {
                text: b.text,
                index: low.start,
              },
              {
                text: b.text,
                index: low.end,
              }
            ),
            max: high,
          },
          b,
          a
        );
      }
    ),
  parser: (s) => any(s.TemperatureRange, s.TimeRange, s.YearRange),
});
