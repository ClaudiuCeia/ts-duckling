import {
  any,
  Context,
  digit,
  either,
  map,
  optional,
  Parser,
  regex,
  repeat,
  seq,
  str,
  createLanguage,
  space,
  minus,
  peek,
  skip1,
} from "combine/mod.ts";
import { __, dot, EntityLanguage, nonWord } from "./common.ts";
import { ent } from "./Entity.ts";
import { Entity } from "./Entity.ts";
import { fuzzyCase } from "./parsers.ts";
import { Quantity, QuantityEntity } from "./Quantity.ts";

type TimeGranularity =
  | "second"
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "decade"
  | "century"
  | "era";

export type TimeEntity = Entity<
  "time",
  {
    when: string | [string, string];
    grain: TimeGranularity;
    era: "BCE" | "CE";
  }
>;

export type NoEraTimeEntityValue = Omit<TimeEntity["value"], "era"> & {
  era?: TimeEntity["value"]["era"];
};

export const time = (
  value: NoEraTimeEntityValue,
  before: Context,
  after: Context
): TimeEntity => {
  return ent(
    {
      ...value,
      era: value.era || "CE",
    },
    "time",
    before,
    after
  );
};

type TimeEntityLanguage = EntityLanguage<
  {
    Grain: Parser<string>;
    Day: Parser<number>;
    Year: Parser<number>;
    NumericMonth: Parser<number>;
    LiteralMonth: Parser<string>;
    QualifiedDay: Parser<number>;
    DateSeparator: Parser<string>;
    Era: Parser<string>;

    // Referring to a time period (hour, minutes, century, ...)
    UnspecifiedGrainAmount: Parser<TimeEntity>;
    // Monday, Tuesday, ...
    DayOfWeek: Parser<TimeEntity>;
    // Terms used to refer to some relative date (today, tomorrow, ...)
    Common: Parser<TimeEntity>;
    // Some amount of time (x days, y years, ...)
    GrainQuantity: Parser<TimeEntity>;
    // Relative dates in plain language (5 days ago, last weekend, ...)
    Relative: Parser<TimeEntity>;
    // Dates expressed as month and year (12/2022, June/2022)
    PartialDateMonthYear: Parser<TimeEntity>;
    // Dates expressed as day and month (12/11, 12 November)
    PartialDateDayMonth: Parser<TimeEntity>;
    // Date expressed in full (01/07/2022, 01 June 2022, etc)
    FullDate: Parser<TimeEntity>;
    // Date expressed as year and era (200 BCE, 167 AD, ...)
    YearEra: Parser<TimeEntity>;
    // Date expressed as month, year and era (December 200 BCE, january 167 AD, ...)
    PartialDateMonthYearEra: Parser<TimeEntity>;
    // Date expressed as day, month, year and era (12 December 200 BCE, 1st of january 167 AD, ...)
    FullDateEra: Parser<TimeEntity>;
    // References a specific point in time, at various granularity (5th century, 1st year, ...)
    QualifiedGrain: Parser<TimeEntity>;
  },
  TimeEntity
>;

export const Time = createLanguage<TimeEntityLanguage>({
  Grain: () =>
    any(
      regex(/sec(ond)?s?/i, "second"),
      regex(/m(in(ute)?s?)?/i, "minute"),
      regex(/h(((ou)?rs?)|r)?/i, "hour"),
      regex(/days?/i, "day"),
      regex(/weeks?/i, "week"),
      regex(/months?/i, "month"),
      regex(/quarters?/i, "quarter"),
      regex(/years?/i, "year"),
      regex(/decades?/i, "decade"),
      regex(/century|centuries/i, "century")
    ),
  UnspecifiedGrainAmount: () =>
    map(
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
        regex(/century|centuries/i, "century")
      ),
      (grain, b, a) => {
        return time(
          {
            when: grain,
            grain: grain as TimeGranularity,
          },
          b,
          a
        );
      }
    ),
  DayOfWeek: () =>
    map(
      any(
        fuzzyCase("Monday"),
        fuzzyCase("Tuesday"),
        fuzzyCase("Wednesday"),
        fuzzyCase("Thursday"),
        fuzzyCase("Friday"),
        fuzzyCase("Saturday"),
        fuzzyCase("Sunday")
      ),
      (day, b, a) => {
        return time(
          {
            when: day,
            grain: "day",
          },
          b,
          a
        );
      }
    ),
  Era: () => any(str("BCE"), str("BC"), str("AD"), str("CE")),
  Common: () =>
    any(
      map(fuzzyCase("today"), (_res, b, a) =>
        time({ when: new Date().toISOString(), grain: "day" }, b, a)
      ),
      map(fuzzyCase("yesterday"), (_res, b, a) => {
        const now = new Date();
        return time(
          {
            when: new Date(now.getDate() - 1).toISOString(),
            grain: "day",
          },
          b,
          a
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
          a
        );
      }),
      map(fuzzyCase("weekend"), (_res, b, a) => {
        return time({ when: "weekend", grain: "week" }, b, a);
      })
    ),
  GrainQuantity: (s) =>
    map(
      seq(Quantity.parser, optional(space()), s.Grain, peek(nonWord)),
      ([quantity, , grain], b, a) => {
        return time(
          {
            when: `${quantity.value.amount} ${grain}`,
            grain: grain as TimeGranularity,
          },
          b,
          a
        );
      }
    ),
  Relative: (s) =>
    any(
      map(
        seq(
          __(any(fuzzyCase("last"), fuzzyCase("past"), fuzzyCase("previous"))),
          optional(Quantity.parser),
          any(s.Grain, s.LiteralMonth, s.DayOfWeek)
        ),
        ([, quantity, grain], b, a) => {
          const amount = quantity ? quantity.value.amount * -1 : -1;

          return time(
            {
              when: `${amount} ${grain}`,
              grain: grain as TimeGranularity,
            },
            b,
            a
          );
        }
      ),
      map(
        seq(
          __(either(fuzzyCase("next"), fuzzyCase("following"))),
          optional(Quantity.parser),
          any(s.Grain, s.LiteralMonth, s.DayOfWeek)
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
            a
          );
        }
      ),
      map(
        seq(
          optional(Quantity.parser),
          __(any(s.Grain, s.DayOfWeek)),
          str("ago")
        ),
        ([quantity, grain], b, a) => {
          const amount = quantity ? quantity.value.amount * -1 : -1;

          return time(
            {
              when: `${amount} ${grain}`,
              grain: grain as TimeGranularity,
            },
            b,
            a
          );
        }
      )
    ),
  NumericMonth: () =>
    any(
      map(
        seq(str("1"), any(str("0"), str("1"), str("2"))),
        ([first, second]) => {
          return parseInt(`${first}${second}`);
        }
      ),
      map(seq(str("0"), digit()), ([_first, digit]) => digit),
      minus(digit(), str("0"))
    ),
  LiteralMonth: () =>
    any(
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
      fuzzyCase("December")
    ),
  Day: () =>
    any(
      map(seq(any(str("0"), str("1"), str("2")), digit()), ([lead, tail]) =>
        parseInt(`${lead}${tail}`)
      ),
      map(seq(str("3"), either(str("0"), str("1"))), ([lead, tail]) =>
        parseInt(`${lead}${tail}`)
      ),
      digit()
    ),
  Year: () =>
    any(
      map(repeat(4, digit()), (digits) =>
        parseInt(digits.reduce((acc, d) => `${acc}${d}`, ""))
      ),
      map(repeat(2, digit()), (digits) =>
        parseInt(digits.reduce((acc, d) => `${acc}${d}`, "19"))
      ),
      map(seq(str("'"), repeat(2, digit())), ([, digits]) =>
        parseInt(digits.reduce((acc, d) => `${acc}${d}`, "19"))
      )
    ),
  DateSeparator: () => any(str("/"), str(" "), str("-"), str(".")),
  PartialDateMonthYear: (s) =>
    map(
      any(
        seq(s.NumericMonth, s.DateSeparator, s.Year),
        seq(s.LiteralMonth, s.DateSeparator, s.Year)
      ),
      ([month, separator, year], b, a) => {
        return time(
          {
            when: new Date(
              `01${separator}${month}${separator}${year}`
            ).toISOString(),
            grain: "day",
          },
          b,
          a
        );
      }
    ),
  QualifiedDay: (s) =>
    map(
      __(seq(s.Day, optional(any(str("st"), str("nd"), str("rd"), str("th"))))),
      ([day]) => day
    ),
  QualifiedGrain: (s) =>
    map(
      seq(
        Quantity.NonFractional,
        any(str("st"), str("nd"), str("rd"), str("th")),
        either(str("-"), space()),
        s.Grain,
        any(
          map(seq(skip1(space()), s.Era), ([, era]) => era),
          peek(nonWord),
          peek(space())
        )
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
          a
        )
    ),
  PartialDateDayMonth: (s) =>
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
          a
        );
      }
    ),
  FullDate: (s) =>
    any(
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
        }
      ),
      map(
        any(
          seq(s.Day, s.DateSeparator, s.NumericMonth, s.DateSeparator, s.Year),
          seq(s.Day, s.DateSeparator, s.LiteralMonth, s.DateSeparator, s.Year),
          seq(s.NumericMonth, s.DateSeparator, s.Day, s.DateSeparator, s.Year),
          seq(s.LiteralMonth, s.DateSeparator, s.Day, s.DateSeparator, s.Year)
        ),
        ([first, s1, mid, s2, year], b, a) => {
          return time(
            {
              when: new Date(`${first}${s1}${mid}${s2}${year}`).toISOString(),
              grain: "day",
            },
            b,
            a
          );
        }
      )
    ),
  PartialDateMonthYearEra: (s) =>
    __(
      map(seq(s.PartialDateMonthYear, s.Era), ([partial, era], b, a) => {
        return time(
          {
            when: `${partial} ${era}`,
            grain: "era",
            era: era === "BCE" || era === "BC" ? "BCE" : "CE",
          },
          b,
          a
        );
      })
    ),
  FullDateEra: (s) =>
    __(
      map(seq(s.FullDate, s.Era), ([full, era], b, a) => {
        return time(
          {
            when: `${full} ${era}`,
            grain: "era",
            era: era === "BCE" || era === "BC" ? "BCE" : "CE",
          },
          b,
          a
        );
      })
    ),
  YearEra: (s) =>
    map(
      seq(
        optional(seq(str("c."), optional(space()))),
        __(Quantity.NonFractional),
        s.Era
      ),
      ([, year, era], b, a) => {
        return time(
          {
            when: `${year.value.amount} ${era}`,
            grain: "era",
            era: era === "BCE" || era === "BC" ? "BCE" : "CE",
          },
          b,
          a
        );
      }
    ),
  parser: (s) =>
    dot(
      any(
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
        map(s.LiteralMonth, (month, b, a) => {
          const year = new Date().getFullYear();
          return time(
            {
              when: new Date(`01 ${month} ${year}`).toISOString(),
              grain: "month",
            },
            b,
            a
          );
        })
      )
    ),
});
