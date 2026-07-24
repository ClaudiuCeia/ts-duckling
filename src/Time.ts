import {
  any,
  type Context,
  defineLanguage,
  digit,
  either,
  eof,
  failure,
  map,
  minus,
  optional,
  type Parser,
  peek,
  regex,
  repeat,
  seq,
  skip1,
  space,
  str,
} from "@claudiu-ceia/combine";
import type { Language as DefinedLanguage } from "@claudiu-ceia/combine";
import { __, dot, nonWord } from "./common.ts";
import { ent } from "./Entity.ts";
import { safe } from "./guard.ts";
import type { Entity } from "./Entity.ts";
import { enumerationTail, fuzzyCase, peekValue } from "./parsers.ts";
import { Quantity, type QuantityEntity } from "./Quantity.ts";

type TimeGranularity =
  | "second"
  | "seconds"
  | "minute"
  | "minutes"
  | "hour"
  | "hours"
  | "day"
  | "days"
  | "week"
  | "weeks"
  | "month"
  | "months"
  | "quarter"
  | "quarters"
  | "year"
  | "years"
  | "decade"
  | "decades"
  | "century"
  | "centuries"
  | "era";

/**
 * Time entity.
 *
 * `value.when` is either:
 * - an ISO timestamp (UTC) for absolute times, or
 * - a relative expression string (e.g. `"-2 days"`), or
 * - a tuple for ranges.
 */
export type TimeEntity = Entity<
  "time",
  {
    when: string | [string, string];
    grain: TimeGranularity;
    era: "BCE" | "CE";
  }
>;

/**
 * Input shape for constructing a `TimeEntity` where `era` is optional.
 */
export type NoEraTimeEntityValue = Omit<TimeEntity["value"], "era"> & {
  era?: TimeEntity["value"]["era"];
};

/**
 * Helper for constructing a `TimeEntity`.
 */
export const time = (
  value: NoEraTimeEntityValue,
  before: Context,
  after: Context,
): TimeEntity => {
  return ent(
    {
      ...value,
      era: value.era || "CE",
    },
    "time",
    before,
    after,
  );
};

const literalMonths: Record<string, number> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};

const monthNumber = (month: number | string): number => {
  const number = typeof month === "number" ? month : literalMonths[month];
  if (number === undefined) throw new RangeError("invalid month");
  return number;
};

const utcCalendarDate = (
  year: number,
  month: number | string,
  day: number,
): string => {
  const numericMonth = monthNumber(month);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, numericMonth - 1, day);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== numericMonth - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError("invalid calendar date");
  }

  return date.toISOString();
};

const isoDateTime = (raw: string): string => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T/.exec(raw);
  if (!parts) throw new RangeError("invalid ISO datetime");
  utcCalendarDate(Number(parts[1]), Number(parts[2]), Number(parts[3]));

  const date = new Date(
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw) ? raw : `${raw}Z`,
  );
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("invalid ISO datetime");
  }
  return date.toISOString();
};

const numericDateStart = <T>(parser: Parser<T>): Parser<T> => (ctx) => {
  const previous = ctx.text[ctx.index - 1];
  const beforePrevious = ctx.text[ctx.index - 2];
  const continuesDate = previous && (
    /\d/.test(previous) ||
    (/[\/.-]/.test(previous) && Boolean(beforePrevious) &&
      /\d/.test(beforePrevious))
  );
  return continuesDate ? failure(ctx, "start of numeric date") : parser(ctx);
};

type TimeOutputs = {
  ISODateTimeZ: TimeEntity;
  ISODateTime: TimeEntity;
  Grain: string;
  UnspecifiedGrainAmount: TimeEntity;
  DayOfWeek: TimeEntity;
  Era: string;
  Common: TimeEntity;
  GrainQuantity: TimeEntity;
  Relative: TimeEntity;
  NumericMonth: number;
  LiteralMonth: string;
  Day: number;
  Year: number;
  DateSeparator: string;
  PartialDateMonthYear: TimeEntity;
  QualifiedDay: number;
  QualifiedGrain: TimeEntity;
  ImplicitQualifiedGrain: TimeEntity;
  PartialDateDayMonth: TimeEntity;
  ISODate: TimeEntity;
  LiteralMonthDayYear: TimeEntity;
  ClockTime: TimeEntity;
  FullDate: TimeEntity;
  PartialDateMonthYearEra: TimeEntity;
  FullDateEra: TimeEntity;
  YearEra: TimeEntity;
  parser: TimeEntity;
};

/**
 * Time parser language (relative times, dates, day-of-week, ISO `...Z` timestamps).
 */
export const Time: DefinedLanguage<TimeOutputs> = defineLanguage<TimeOutputs>({
  ISODateTimeZ(_s) {
    // Example: 2004-07-12T22:18:09Z
    return safe(
      map(
        regex(
          /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/i,
          "iso-datetime-z",
        ),
        (raw, b, a) => time({ when: isoDateTime(raw), grain: "second" }, b, a),
      ),
      "valid date",
    );
  },
  ISODateTime(_s) {
    // 2024-05-18T10:30:00, 2024-05-18T10:30:00+02:00, 2024-05-18T10:30:00-05:00
    // Also handles optional seconds and milliseconds.
    return safe(
      map(
        regex(
          /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?(?:[+-]\d{2}:\d{2})?/,
          "iso-datetime",
        ),
        (raw, b, a) => time({ when: isoDateTime(raw), grain: "second" }, b, a),
      ),
      "valid date",
    );
  },
  Grain(_s) {
    return any(
      regex(/sec(ond)?s?/i, "second"),
      regex(/m(in(ute)?s?)?/i, "minute"),
      regex(/h(((ou)?rs?)|r)?/i, "hour"),
      regex(/days?/i, "day"),
      regex(/weeks?/i, "week"),
      regex(/months?/i, "month"),
      regex(/quarters?/i, "quarter"),
      regex(/years?/i, "year"),
      regex(/decades?/i, "decade"),
      regex(/century|centuries/i, "century"),
    );
  },
  UnspecifiedGrainAmount(_s) {
    return map(
      any(
        regex(/seconds?/i, "second"),
        regex(/minutes?/i, "minute"),
        regex(/hours?/i, "hour"),
        regex(/days?/i, "day"),
        regex(/weeks?/i, "week"),
        regex(/months?/i, "month"),
        regex(/quarters?/i, "quarter"),
        regex(/years?/i, "year"),
        regex(/decades?/i, "decade"),
        regex(/century|centuries/i, "century"),
      ),
      (grain, b, a) => {
        return time(
          {
            when: grain,
            grain: grain as TimeGranularity,
          },
          b,
          a,
        );
      },
    );
  },
  DayOfWeek(_s) {
    return map(
      any(
        fuzzyCase("Monday"),
        fuzzyCase("Tuesday"),
        fuzzyCase("Wednesday"),
        fuzzyCase("Thursday"),
        fuzzyCase("Friday"),
        fuzzyCase("Saturday"),
        fuzzyCase("Sunday"),
      ),
      (day, b, a) => {
        return time(
          {
            when: day,
            grain: "day",
          },
          b,
          a,
        );
      },
    );
  },
  Era(_s) {
    return any(str("BCE"), str("BC"), str("AD"), str("CE"));
  },
  Common(_s) {
    return any(
      map(
        fuzzyCase("today"),
        (_res, b, a) =>
          time({ when: new Date().toISOString(), grain: "day" }, b, a),
      ),
      map(fuzzyCase("yesterday"), (_res, b, a) => {
        const now = new Date();
        now.setDate(now.getDate() - 1);
        return time(
          {
            when: now.toISOString(),
            grain: "day",
          },
          b,
          a,
        );
      }),
      map(fuzzyCase("tomorrow"), (_res, b, a) => {
        const now = new Date();
        now.setDate(now.getDate() + 1);
        return time(
          {
            when: now.toISOString(),
            grain: "day",
          },
          b,
          a,
        );
      }),
      map(fuzzyCase("weekend"), (_res, b, a) => {
        return time({ when: "weekend", grain: "week" }, b, a);
      }),
      map(fuzzyCase("noon"), (_res, b, a) => {
        return time({ when: "12:00", grain: "hour" }, b, a);
      }),
      map(fuzzyCase("midnight"), (_res, b, a) => {
        return time({ when: "00:00", grain: "hour" }, b, a);
      }),
    );
  },
  GrainQuantity(s) {
    return map(
      seq(Quantity.parser, optional(space()), s.Grain, peek(nonWord)),
      ([quantity, , grain], b, a) => {
        return time(
          {
            when: `${quantity.value.amount} ${grain}`,
            grain: grain as TimeGranularity,
          },
          b,
          a,
        );
      },
    );
  },
  Relative(s) {
    return any(
      map(
        seq(
          __(
            any(fuzzyCase("last"), fuzzyCase("past"), fuzzyCase("previous")),
          ),
          optional(Quantity.parser),
          any(s.Grain, s.LiteralMonth, s.DayOfWeek),
        ),
        ([, quantity, grain], b, a) => {
          const amount = quantity ? quantity.value.amount * -1 : -1;

          return time(
            {
              when: `${amount} ${grain}`,
              grain: grain as TimeGranularity,
            },
            b,
            a,
          );
        },
      ),
      map(
        seq(
          __(either(fuzzyCase("next"), fuzzyCase("following"))),
          optional(Quantity.parser),
          any(s.Grain, s.LiteralMonth, s.DayOfWeek),
        ),
        ([, quantity, grain], b, a) => {
          const amount = quantity
            ? (quantity as QuantityEntity).value.amount
            : 1;

          return time(
            {
              when: `${amount} ${grain}`,
              grain: grain as TimeGranularity,
            },
            b,
            a,
          );
        },
      ),
      map(
        seq(
          optional(Quantity.parser),
          __(any(s.Grain, s.DayOfWeek)),
          str("ago"),
        ),
        ([quantity, grain], b, a) => {
          const amount = quantity ? quantity.value.amount * -1 : -1;

          return time(
            {
              when: `${amount} ${grain}`,
              grain: grain as TimeGranularity,
            },
            b,
            a,
          );
        },
      ),
    );
  },
  NumericMonth(_s) {
    return any(
      map(
        seq(str("1"), any(str("0"), str("1"), str("2"))),
        ([first, second]) => {
          return parseInt(`${first}${second}`);
        },
      ),
      map(seq(str("0"), digit()), ([_first, digit]) => digit),
      minus(digit(), str("0")),
    );
  },
  LiteralMonth(_s) {
    return any(
      fuzzyCase("January"),
      fuzzyCase("February"),
      fuzzyCase("March"),
      fuzzyCase("April"),
      fuzzyCase("May"),
      fuzzyCase("June"),
      fuzzyCase("July"),
      fuzzyCase("August"),
      fuzzyCase("September"),
      fuzzyCase("October"),
      fuzzyCase("November"),
      fuzzyCase("December"),
    );
  },
  Day(_s) {
    return any(
      map(
        seq(any(str("0"), str("1"), str("2")), digit()),
        ([lead, tail]) => parseInt(`${lead}${tail}`),
      ),
      map(
        seq(str("3"), either(str("0"), str("1"))),
        ([lead, tail]) => parseInt(`${lead}${tail}`),
      ),
      digit(),
    );
  },
  Year(_s) {
    return any(
      map(
        repeat(4, digit()),
        (digits) => parseInt(digits.reduce((acc, d) => `${acc}${d}`, "")),
      ),
      map(
        repeat(2, digit()),
        (digits) => parseInt(digits.reduce((acc, d) => `${acc}${d}`, "19")),
      ),
      map(
        seq(str("'"), repeat(2, digit())),
        ([, digits]) => parseInt(digits.reduce((acc, d) => `${acc}${d}`, "19")),
      ),
    );
  },
  DateSeparator(_s) {
    return any(str("/"), str(" "), str("-"), str("."));
  },
  PartialDateMonthYear(s) {
    return safe(
      map(
        any(
          numericDateStart(
            seq(s.NumericMonth, s.DateSeparator, s.Year),
          ),
          seq(s.LiteralMonth, s.DateSeparator, s.Year),
        ),
        ([month, , year], b, a) => {
          return time(
            {
              when: utcCalendarDate(year, month, 1),
              grain: "month",
            },
            b,
            a,
          );
        },
      ),
      "valid date",
    );
  },
  QualifiedDay(s) {
    return map(
      __(
        seq(
          s.Day,
          optional(any(str("st"), str("nd"), str("rd"), str("th"))),
        ),
      ),
      ([day]) => day,
    );
  },
  QualifiedGrain(s) {
    return map(
      seq(
        Quantity.NonFractional,
        any(str("st"), str("nd"), str("rd"), str("th")),
        either(str("-"), space()),
        s.Grain,
        any(
          map(seq(skip1(space()), s.Era), ([, era]) => era),
          peek(nonWord),
          peek(space()),
          peek(eof()),
        ),
      ),
      ([quantity, qualifier, , grain, maybeEra], b, a) =>
        time(
          {
            when: `${quantity.value.amount}${qualifier} ${grain} ${
              maybeEra || ""
            }`,
            grain: grain as TimeGranularity,
            era: maybeEra === "BCE" || maybeEra === "BC" ? "BCE" : "CE",
          },
          b,
          a,
        ),
    );
  },
  ImplicitQualifiedGrain(s) {
    const ordinal = map(
      seq(
        Quantity.NonFractional,
        any(str("st"), str("nd"), str("rd"), str("th")),
      ),
      ([quantity, qualifier]) => ({ quantity, qualifier }),
    );

    return map(
      seq(
        ordinal,
        peekValue(enumerationTail(ordinal, dot(s.QualifiedGrain))),
      ),
      ([current, final], b, a) => {
        const finalWhen = final.value.when as string;
        const suffix = finalWhen.slice(finalWhen.indexOf(" ") + 1);

        return time(
          {
            when:
              `${current.quantity.value.amount}${current.qualifier} ${suffix}`,
            grain: final.value.grain,
            era: final.value.era,
          },
          b,
          a,
        );
      },
    );
  },
  PartialDateDayMonth(s) {
    return safe(
      map(
        seq(s.QualifiedDay, optional(__(str("of"))), s.LiteralMonth),
        ([day, _of, month], b, a) => {
          const year = new Date().getUTCFullYear();
          return time(
            {
              when: utcCalendarDate(year, month, day),
              grain: "day",
            },
            b,
            a,
          );
        },
      ),
      "valid date",
    );
  },
  ISODate(s) {
    // YYYY-MM-DD (and optional time HH:MM[:SS])
    return safe(
      map(
        seq(
          s.Year,
          str("-"),
          s.NumericMonth,
          str("-"),
          s.Day,
        ),
        ([year, , month, , day], b, a) => {
          return time(
            {
              when: utcCalendarDate(year, month, day),
              grain: "day",
            },
            b,
            a,
          );
        },
      ),
      "valid date",
    );
  },
  LiteralMonthDayYear(s) {
    // "July 13, 2016" / "July 13 2016"
    return safe(
      map(
        seq(
          s.LiteralMonth,
          skip1(space()),
          s.Day,
          optional(str(",")),
          skip1(space()),
          s.Year,
        ),
        ([month, , day, , , year], b, a) => {
          return time(
            {
              when: utcCalendarDate(year, month, day),
              grain: "day",
            },
            b,
            a,
          );
        },
      ),
      "valid date",
    );
  },
  ClockTime(_s) {
    // 23:28, 23:28:59, 14:00 UTC, 23:28 (UTC), 3:45 PM, 3:45:00 AM
    return map(
      seq(
        regex(/(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?/, "clock-time"),
        optional(
          seq(
            optional(space()),
            any(
              regex(/[AP]M/i, "am-pm"),
              seq(
                optional(str("(")),
                regex(/[A-Z]{2,5}/, "timezone"),
                optional(str(")")),
              ),
            ),
          ),
        ),
      ),
      ([clockStr, suffix], b, a) => {
        let label = clockStr;
        if (suffix) {
          const [maybeSpace, tz] = suffix;
          if (typeof tz === "string") {
            label = `${clockStr}${maybeSpace ?? ""}${tz}`;
          } else {
            const [open, tzName, close] = tz;
            label = `${clockStr}${maybeSpace ?? ""}${open ?? ""}${tzName}${
              close ?? ""
            }`;
          }
        }
        return time(
          {
            when: label,
            grain: clockStr.split(":").length > 2 ? "second" : "minute",
          },
          b,
          a,
        );
      },
    );
  },
  FullDate(s) {
    return any(
      safe(
        map(
          seq(
            s.QualifiedDay,
            optional(__(str("of"))),
            s.LiteralMonth,
            space(),
            s.Year,
          ),
          ([day, , month, , year], b, a) =>
            time(
              { when: utcCalendarDate(year, month, day), grain: "day" },
              b,
              a,
            ),
        ),
        "valid date",
      ),
      safe(
        map(
          any(
            numericDateStart(
              map(
                seq(
                  s.Day,
                  s.DateSeparator,
                  s.NumericMonth,
                  s.DateSeparator,
                  s.Year,
                ),
                ([day, , month, , year]) => ({ day, month, year }),
              ),
            ),
            map(
              seq(
                s.Day,
                s.DateSeparator,
                s.LiteralMonth,
                s.DateSeparator,
                s.Year,
              ),
              ([day, , month, , year]) => ({ day, month, year }),
            ),
            numericDateStart(
              map(
                seq(
                  s.NumericMonth,
                  s.DateSeparator,
                  s.Day,
                  s.DateSeparator,
                  s.Year,
                ),
                ([month, , day, , year]) => ({ day, month, year }),
              ),
            ),
            map(
              seq(
                s.LiteralMonth,
                s.DateSeparator,
                s.Day,
                s.DateSeparator,
                s.Year,
              ),
              ([month, , day, , year]) => ({ day, month, year }),
            ),
          ),
          ({ day, month, year }, b, a) => {
            return time(
              {
                when: utcCalendarDate(year, month, day),
                grain: "day",
              },
              b,
              a,
            );
          },
        ),
        "valid date",
      ),
    );
  },
  PartialDateMonthYearEra(s) {
    return __(
      map(
        seq(s.PartialDateMonthYear, s.Era),
        ([partial, era], b, a) => {
          return time(
            {
              when: `${partial} ${era}`,
              grain: "era",
              era: era === "BCE" || era === "BC" ? "BCE" : "CE",
            },
            b,
            a,
          );
        },
      ),
    );
  },
  FullDateEra(s) {
    return __(
      map(seq(s.FullDate, s.Era), ([full, era], b, a) => {
        return time(
          {
            when: `${full} ${era}`,
            grain: "era",
            era: era === "BCE" || era === "BC" ? "BCE" : "CE",
          },
          b,
          a,
        );
      }),
    );
  },
  YearEra(s) {
    return map(
      seq(
        optional(seq(str("c."), optional(space()))),
        __(Quantity.NonFractional),
        s.Era,
      ),
      ([, year, era], b, a) => {
        return time(
          {
            when: `${year.value.amount} ${era}`,
            grain: "era",
            era: era === "BCE" || era === "BC" ? "BCE" : "CE",
          },
          b,
          a,
        );
      },
    );
  },
  parser(s) {
    return dot(
      any(
        s.ISODateTimeZ,
        s.ISODateTime,
        s.ISODate,
        s.FullDateEra,
        s.LiteralMonthDayYear,
        s.FullDate,
        s.ClockTime,
        s.Relative,
        s.PartialDateMonthYearEra,
        s.PartialDateMonthYear,
        s.PartialDateDayMonth,
        s.DayOfWeek,
        s.Common,
        s.ImplicitQualifiedGrain,
        s.QualifiedGrain,
        s.GrainQuantity,
        s.UnspecifiedGrainAmount,
        s.YearEra,
        safe(
          map(s.LiteralMonth, (month, b, a) => {
            const year = new Date().getUTCFullYear();
            return time(
              {
                when: utcCalendarDate(year, month, 1),
                grain: "month",
              },
              b,
              a,
            );
          }),
          "valid date",
        ),
      ),
    );
  },
});
