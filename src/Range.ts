import {
  any,
  type Context,
  createLanguageThis,
  either,
  map,
  optional,
  seq,
  space,
  str,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { __ } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import { Quantity } from "./Quantity.ts";
import { Temperature, type TemperatureEntity } from "./Temperature.ts";
import { Time, time, type TimeEntity } from "./Time.ts";

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
  after: Context,
): RangeEntity<E> => {
  return ent(value, "range", before, after);
};

type AnyRangeEntity = RangeEntity<TemperatureEntity> | RangeEntity<TimeEntity>;

type RangeLanguage = {
  TemperatureRange: () => Parser<RangeEntity<TemperatureEntity>>;
  TimeRange: () => Parser<RangeEntity<TimeEntity>>;
  YearRange: () => Parser<RangeEntity<TimeEntity>>;
  parser: () => Parser<AnyRangeEntity>;
};

export const Range: ReturnType<typeof createLanguageThis<RangeLanguage>> =
  createLanguageThis<RangeLanguage>({
    TemperatureRange(): Parser<RangeEntity<TemperatureEntity>> {
      return map(
        seq(
          __(str("between")),
          either(Temperature.parser, Quantity.parser),
          __(either(str("and"), str("-"))),
          Temperature.parser,
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
            a,
          );
        },
      );
    },
    TimeRange(): Parser<RangeEntity<TimeEntity>> {
      return any(
        map(
          seq(
            __(str("from")),
            optional(__(str("the"))),
            Time.parser,
            __(either(str("until"), str("to"))),
            optional(__(str("the"))),
            Time.parser,
          ),
          ([, , low, , , high], b, a) => {
            return range(
              {
                min: low,
                max: high,
              },
              b,
              a,
            );
          },
        ),
        map(
          seq(
            Time.parser,
            optional(space()),
            str("-"),
            optional(space()),
            Time.parser,
          ),
          ([low, , , , high], b, a) => {
            return range(
              {
                min: low,
                max: high,
              },
              b,
              a,
            );
          },
        ),
        map(
          seq(
            __(str("between")),
            optional(__(str("the"))),
            Time.parser,
            __(str("and")),
            optional(__(str("the"))),
            Time.parser,
          ),
          ([, , low, , , high], b, a) => {
            return range(
              {
                min: low,
                max: high,
              },
              b,
              a,
            );
          },
        ),
      );
    },
    YearRange(): Parser<RangeEntity<TimeEntity>> {
      return any(
        map(
          seq(
            __(str("between")),
            Quantity.parser,
            __(str("and")),
            Time.YearEra,
          ),
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
                  },
                ),
                max: high,
              },
              b,
              a,
            );
          },
        ),
        map(
          seq(
            Quantity.parser,
            optional(space()),
            __(str("-")),
            optional(space()),
            Time.YearEra,
          ),
          ([low, , , , high], b, a) => {
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
                  },
                ),
                max: high,
              },
              b,
              a,
            );
          },
        ),
      );
    },
    parser(): Parser<AnyRangeEntity> {
      return any(this.TimeRange, this.YearRange, this.TemperatureRange);
    },
  });
