import {
  any,
  Context,
  createLanguage,
  digit,
  either,
  map,
  optional,
  Parser,
  regex,
  repeat,
  seq,
  str,
} from "https://deno.land/x/combine@v0.0.5/mod.ts";
import { __, dot } from "./common.ts";
import { ent } from "./Entity.ts";
import { Entity } from "./Entity.ts";
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
  | "century";

type TimeEntity = Entity<
  "time",
  {
    when: string | [string, string];
    grain: TimeGranularity;
  }
>;

const time = (
  value: TimeEntity["value"],
  before: Context,
  after: Context
): TimeEntity => {
  return ent(value, "time", before, after);
};

export const Time = createLanguage({
  Grain: () =>
    __(
      any(
        regex(/sec(ond)?s?/, "second"),
        regex(/m(in(ute)?s?)?/, "minute"),
        regex(/h(((ou)?rs?)|r)?/, "hour"),
        regex(/days?/, "day"),
        regex(/weeks?/, "week"),
        regex(/months?/, "month"),
        regex(/quarters?/, "quarter"),
        regex(/years?/, "year"),
        regex(/decades?/, "decade"),
        regex(/century|centuries/, "century")
      )
    ),
  // TODO: fix unsafe cast
  UnspecifiedGrainAmount: () =>
    map(
      dot(
        any(
          regex(/seconds?/, "second"),
          regex(/minutes?/, "minute"),
          regex(/hours?/, "hour"),
          regex(/days?/, "day"),
          regex(/weeks?/, "week"),
          regex(/months?/, "month"),
          regex(/quarters?/, "quarter"),
          regex(/years?/, "year"),
          regex(/decades?/, "decade"),
          regex(/century|centuries/, "century")
        )
      ),
      (grain, b, a) => {
        return time(
          {
            when: grain as string,
            grain: grain as TimeGranularity,
          },
          b,
          a
        );
      }
    ),
  DayOfWeek: () =>
    dot(
      map(
        any(
          str("Monday"),
          str("Tuesday"),
          str("Wednesday"),
          str("Thursday"),
          str("Friday"),
          str("Saturday"),
          str("Sunday")
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
      )
    ),
  Common: () =>
    dot(
      any(
        map(str("today"), (_res, b, a) =>
          time({ when: new Date().toISOString(), grain: "day" }, b, a)
        ),
        map(str("yesterday"), (_res, b, a) => {
          const now = new Date();
          return time(
            { when: new Date(now.getDate() - 1).toISOString(), grain: "day" },
            b,
            a
          );
        }),
        map(str("tomorrow"), (_res, b, a) => {
          const now = new Date();
          return time(
            { when: new Date(now.getDate() + 1).toISOString(), grain: "day" },
            b,
            a
          );
        }),
        map(str("weekend"), (_res, b, a) => {
          return time({ when: "weekend", grain: "week" }, b, a);
        })
      )
    ),
  GrainQuantity: (s) =>
    map(seq(Quantity.parser, dot(s.Grain)), ([quantity, grain], b, a) => {
      return time(
        {
          when: `${quantity} ${grain}`,
          grain: grain as TimeGranularity,
        },
        b,
        a
      );
    }),
  Relative: (s) =>
    any(
      map(
        seq(
          __(either(str("last"), str("previous"))),
          optional(Quantity.parser),
          dot(any(s.Grain, s.LiteralMonth, s.DayOfWeek))
        ),
        ([, quantity, grain], b, a) => {
          const amount = quantity
            ? (quantity as QuantityEntity).value.amount * -1
            : -1;

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
          __(either(str("next"), str("following"))),
          optional(Quantity.parser),
          dot(any(s.Grain, s.LiteralMonth, s.DayOfWeek))
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
          dot(str("ago"))
        ),
        ([quantity, grain], b, a) => {
          const amount = quantity
            ? (quantity as QuantityEntity).value.amount * -1
            : -1;

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
      digit()
    ),
  LiteralMonth: () =>
    any(
      str("January"),
      str("February"),
      str("March"),
      str("April"),
      str("May"),
      str("June"),
      str("July"),
      str("August"),
      str("September"),
      str("October"),
      str("November"),
      str("December")
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
      map(repeat(4, digit()), (digits) => parseInt(digits.join())),
      map(repeat(2, digit()), (digits) => parseInt(digits.join()))
    ),
  PartialDateMonthYear: (s) =>
    map(
      dot(
        any(
          seq(s.NumericMonth, str("/"), s.Year),
          seq(s.LiteralMonth, str("/"), s.Year)
        )
      ),
      ([month, separator, year], b, a) => {
        return time(
          {
            when: new Date(`01${separator}${month}${year}`).toISOString(),
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
  PartialDateDayMonth: (s) =>
    map(
      dot(seq(s.QualifiedDay, optional(__(str("of"))), s.Month)),
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
    map(
      dot(
        any(
          seq(s.Day, str("/"), s.NumericMonth, str("/"), s.Year),
          seq(s.Day, str("/"), s.LiteralMonth, str("/"), s.Year),
          seq(s.NumericMonth, str("/"), s.Day, str("/"), s.Year),
          seq(s.LiteralMonth, str("/"), s.Day, str("/"), s.Year)
        )
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
    ),
  parser: (s): Parser<TimeEntity> =>
    any(
      s.DayOfWeek as Parser<TimeEntity>,
      s.Common as Parser<TimeEntity>,
      s.GrainQuantity as Parser<TimeEntity>,
      /* s.PartialDateMonthYear as Parser<TimeEntity>, */
      s.PartialDateDayMonth as Parser<TimeEntity>,
      s.FullDate as Parser<TimeEntity>,
      s.UnspecifiedGrainAmount as Parser<TimeEntity>,
      s.Relative as Parser<TimeEntity>
    ),
});
