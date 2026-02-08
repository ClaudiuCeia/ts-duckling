import {
  any,
  Context,
  createLanguageThis,
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
import { __, dot, nonWord } from "./common.ts";
import { ent } from "./Entity.ts";
import { Entity } from "./Entity.ts";
import { fuzzyCase } from "./parsers.ts";
import { Quantity, QuantityEntity } from "./Quantity.ts";

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

export const Time = createLanguageThis({
  ISODateTimeZ() {
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
  Grain() {
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
  UnspecifiedGrainAmount() {
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
  DayOfWeek() {
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
  Era() {
    return any(str("BCE"), str("BC"), str("AD"), str("CE"));
  },
  Common() {
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
  GrainQuantity() {
    return map(
      seq(Quantity.parser, optional(space()), this.Grain, peek(nonWord)),
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
  Relative() {
    return any(
      map(
        seq(
          __(any(fuzzyCase("last"), fuzzyCase("past"), fuzzyCase("previous"))),
          optional(Quantity.parser),
          any(this.Grain, this.LiteralMonth, this.DayOfWeek),
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
          any(this.Grain, this.LiteralMonth, this.DayOfWeek),
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
          __(any(this.Grain, this.DayOfWeek)),
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
  NumericMonth() {
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
  LiteralMonth() {
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
  Day() {
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
  Year() {
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
  DateSeparator() {
    return any(str("/"), str(" "), str("-"), str("."));
  },
  PartialDateMonthYear() {
    return map(
      any(
        seq(this.NumericMonth, this.DateSeparator, this.Year),
        seq(this.LiteralMonth, this.DateSeparator, this.Year),
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
    );
  },
  QualifiedDay() {
    return map(
      __(
        seq(
          this.Day,
          optional(any(str("st"), str("nd"), str("rd"), str("th"))),
        ),
      ),
      ([day]) => day,
    );
  },
  QualifiedGrain() {
    return map(
      seq(
        Quantity.NonFractional,
        any(str("st"), str("nd"), str("rd"), str("th")),
        either(str("-"), space()),
        this.Grain,
        any(
          map(seq(skip1(space()), this.Era), ([, era]) => era),
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
  PartialDateDayMonth() {
    return map(
      seq(this.QualifiedDay, optional(__(str("of"))), this.LiteralMonth),
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
    );
  },
  FullDate() {
    return any(
      map(
        seq(this.PartialDateDayMonth, space(), this.Year),
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
      map(
        any(
          seq(
            this.Day,
            this.DateSeparator,
            this.NumericMonth,
            this.DateSeparator,
            this.Year,
          ),
          seq(
            this.Day,
            this.DateSeparator,
            this.LiteralMonth,
            this.DateSeparator,
            this.Year,
          ),
          seq(
            this.NumericMonth,
            this.DateSeparator,
            this.Day,
            this.DateSeparator,
            this.Year,
          ),
          seq(
            this.LiteralMonth,
            this.DateSeparator,
            this.Day,
            this.DateSeparator,
            this.Year,
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
    );
  },
  PartialDateMonthYearEra() {
    return __(
      map(seq(this.PartialDateMonthYear, this.Era), ([partial, era], b, a) => {
        return time(
          {
            when: `${partial} ${era}`,
            grain: "era",
            era: era === "BCE" || era === "BC" ? "BCE" : "CE",
          },
          b,
          a,
        );
      }),
    );
  },
  FullDateEra() {
    return __(
      map(seq(this.FullDate, this.Era), ([full, era], b, a) => {
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
  YearEra() {
    return map(
      seq(
        optional(seq(str("c."), optional(space()))),
        __(Quantity.NonFractional),
        this.Era,
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
  parser() {
    return dot(
      any(
        this.ISODateTimeZ,
        this.FullDateEra,
        this.FullDate,
        this.Relative,
        this.PartialDateMonthYearEra,
        this.PartialDateMonthYear,
        this.PartialDateDayMonth,
        this.DayOfWeek,
        this.Common,
        this.QualifiedGrain,
        this.GrainQuantity,
        this.UnspecifiedGrainAmount,
        this.YearEra,
        map(this.LiteralMonth, (month, b, a) => {
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
      ),
    );
  },
});
