import {
  any,
  type Context,
  createLanguage,
  digit,
  either,
  map,
  minus,
  optional,
  peek,
  regex,
  repeat,
  seq,
  skip1,
  space,
  str,
} from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { __, dot, nonWord } from "./common.ts";
import { ent } from "./Entity.ts";
import { safe } from "./guard.ts";
import type { Entity } from "./Entity.ts";
import { fuzzyCase } from "./parsers.ts";
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

type TimeLanguage = {
  ISODateTimeZ: Parser<TimeEntity>;
  Grain: Parser<string>;
  UnspecifiedGrainAmount: Parser<TimeEntity>;
  DayOfWeek: Parser<TimeEntity>;
  Era: Parser<string>;
  Common: Parser<TimeEntity>;
  GrainQuantity: Parser<TimeEntity>;
  Relative: Parser<TimeEntity>;
  NumericMonth: Parser<number>;
  LiteralMonth: Parser<string>;
  Day: Parser<number>;
  Year: Parser<number>;
  DateSeparator: Parser<string>;
  PartialDateMonthYear: Parser<TimeEntity>;
  QualifiedDay: Parser<number>;
  QualifiedGrain: Parser<TimeEntity>;
  PartialDateDayMonth: Parser<TimeEntity>;
  FullDate: Parser<TimeEntity>;
  PartialDateMonthYearEra: Parser<TimeEntity>;
  FullDateEra: Parser<TimeEntity>;
  YearEra: Parser<TimeEntity>;
  parser: Parser<TimeEntity>;
};

/**
 * Time parser language (relative times, dates, day-of-week, ISO `...Z` timestamps).
 */
export const Time: TimeLanguage = createLanguage<TimeLanguage>({
  ISODateTimeZ(_s) {
    // Example: 2004-07-12T22:18:09Z
    // Keep it strict and UTC-only for now.
    return map(
      regex(
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/i,
        "iso-datetime-z",
      ),
      (raw, b, a) => {
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) {
          // Should be unreachable given the regex, but keep it defensive.
          return time({ when: raw, grain: "second" }, b, a);
        }
        return time({ when: d.toISOString(), grain: "second" }, b, a);
      },
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
        return time(
          {
            when: new Date(now.getDate() - 1).toISOString(),
            grain: "day",
          },
          b,
          a,
        );
      }),
      map(fuzzyCase("tomorrow"), (_res, b, a) => {
        const now = new Date();
        return time(
          {
            when: new Date(now.getDate() + 1).toISOString(),
            grain: "day",
          },
          b,
          a,
        );
      }),
      map(fuzzyCase("weekend"), (_res, b, a) => {
        return time({ when: "weekend", grain: "week" }, b, a);
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
          seq(s.NumericMonth, s.DateSeparator, s.Year),
          seq(s.LiteralMonth, s.DateSeparator, s.Year),
        ),
        ([month, separator, year], b, a) => {
          return time(
            {
              when: new Date(
                `01${separator}${month}${separator}${year}`,
              ).toISOString(),
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
  PartialDateDayMonth(s) {
    return safe(
      map(
        seq(s.QualifiedDay, optional(__(str("of"))), s.LiteralMonth),
        ([day, _of, month], b, a) => {
          const year = new Date().getFullYear();
          return time(
            {
              when: new Date(`${day} ${month} ${year}`).toISOString(),
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
  FullDate(s) {
    return any(
      safe(
        map(
          seq(s.PartialDateDayMonth, space(), s.Year),
          ([partialDayMonth, _sp, year], b, a) => {
            const original = partialDayMonth.value.when;
            if (typeof original !== "string") {
              throw new Error(`
              Unexpected partial date match:
              ${JSON.stringify(partialDayMonth)}
            `);
            }

            const date = new Date(original);
            date.setFullYear(year);

            return time({ when: date.toISOString(), grain: "day" }, b, a);
          },
        ),
        "valid date",
      ),
      safe(
        map(
          any(
            seq(
              s.Day,
              s.DateSeparator,
              s.NumericMonth,
              s.DateSeparator,
              s.Year,
            ),
            seq(
              s.Day,
              s.DateSeparator,
              s.LiteralMonth,
              s.DateSeparator,
              s.Year,
            ),
            seq(
              s.NumericMonth,
              s.DateSeparator,
              s.Day,
              s.DateSeparator,
              s.Year,
            ),
            seq(
              s.LiteralMonth,
              s.DateSeparator,
              s.Day,
              s.DateSeparator,
              s.Year,
            ),
          ),
          ([first, s1, mid, s2, year], b, a) => {
            return time(
              {
                when: new Date(`${first}${s1}${mid}${s2}${year}`).toISOString(),
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
        s.FullDateEra,
        s.FullDate,
        s.Relative,
        s.PartialDateMonthYearEra,
        s.PartialDateMonthYear,
        s.PartialDateDayMonth,
        s.DayOfWeek,
        s.Common,
        s.QualifiedGrain,
        s.GrainQuantity,
        s.UnspecifiedGrainAmount,
        s.YearEra,
        safe(
          map(s.LiteralMonth, (month, b, a) => {
            const year = new Date().getFullYear();
            return time(
              {
                when: new Date(`01 ${month} ${year}`).toISOString(),
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
