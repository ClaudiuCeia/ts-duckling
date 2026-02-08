import { any, Context, createLanguageThis, map } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import countries from "@data/countries-en-us" with { type: "json" };
import { fuzzyCase } from "./parsers.ts";

const countriesByCode = countries as Record<string, string>;

export type LocationEntity = Entity<
  "location",
  {
    place: string;
    type: "country" | "other";
  }
>;

export const location = (
  value: LocationEntity["value"],
  before: Context,
  after: Context,
): LocationEntity => {
  return ent(value, "location", before, after);
};

export const Location = createLanguageThis({
  Country() {
    return map(
      any(...Object.values(countriesByCode).map(fuzzyCase)),
      (country, b, a) =>
        location(
          {
            place: country,
            type: "country",
          },
          b,
          a,
        ),
    );
  },
  parser() {
    return dot(any(this.Country));
  },
});
