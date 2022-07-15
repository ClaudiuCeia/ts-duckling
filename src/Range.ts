import {
  any,
  createLanguage,
  seq,
  str,
  map,
  Context,
  either,
Parser,
} from "https://deno.land/x/combine@v0.0.5/mod.ts";
import { __, dot } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import { Temperature } from "./Temperature.ts";
import { Time } from "./Time.ts";

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

export const Range = createLanguage({
  TemperatureRange: () =>
    dot(
      map(
        seq(
          __(str("between")),
          Temperature.parser,
          __(either(str("and"), str("-"))),
          Temperature.parser
        ),
        ([, low, , high], b, a) => {
          return range(
            {
              min: low as Entity<unknown, unknown>,
              max: high as Entity<unknown, unknown>,
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
          Time.parser,
          __(either(str("until"), str("to"))),
          Time.parser
        ),
        ([, low, , high], b, a) => {
          return range(
            {
              min: low as Entity<unknown, unknown>,
              max: high as Entity<unknown, unknown>,
            },
            b,
            a
          );
        }
      )
    ),
  parser: (s): Parser<RangeEntity<Entity<unknown, unknown>>> =>
    any(
      s.TemperatureRange as Parser<RangeEntity<Entity<unknown, unknown>>>,
      s.TimeRange as Parser<RangeEntity<Entity<unknown, unknown>>>
    ),
});
