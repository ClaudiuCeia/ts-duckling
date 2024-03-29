import { any, Context, createLanguage, map, Parser } from "combine/mod.ts";
import { EntityLanguage, __, dot } from "./common.ts";
import { ent, Entity } from "./Entity.ts";
import countries from "https://cdn.jsdelivr.net/gh/umpirsky/country-list@2.0.6/data/en_US/country.json" assert { type: "json" };
import { fuzzyCase } from "./parsers.ts";

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
    map(any(...Object.values(countries).map(fuzzyCase)), (country, b, a) =>
      location(
        {
          place: country,
          type: "country",
        },
        b,
        a
      )
    ),
  parser: (s) => dot(any(s.Country)),
});
