
import { Context, createLanguage } from "https://deno.land/x/combine@v0.0.5/mod.ts";
import { any } from "../../combine/src/combinators.ts";
import { str } from "../../combine/src/parsers.ts";
import { __ } from "./common.ts";
import { ent } from "./Entity.ts";
import { Entity } from "./Entity.ts";

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
    DayOfWeek: __(any(
        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => str(d)
    )),
});
