import {
  any,
  Context,
  createLanguage,
  map,
  Parser,
  str,
} from "https://deno.land/x/combine@v0.0.8/mod.ts";
import { EntityLanguage, __, dot } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import countries from "https://cdn.jsdelivr.net/gh/umpirsky/country-list@2.0.6/data/en_US/country.json" assert { type: "json" };

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
  after: Context
): LocationEntity => {
  return ent(value, "location", before, after);
};

type LocationEntityLanguage = EntityLanguage<
  {
    Country: Parser<LocationEntity>;
  },
  LocationEntity
>;

export const Location = createLanguage<LocationEntityLanguage>({
  Country: () =>
    __(
      map(any(...Object.values(countries).map(str)), (country, b, a) =>
        location(
          {
            place: country,
            type: "country",
          },
          b,
          a
        )
      )
    ),
  parser: (s) => dot(any(s.Country)),
});
