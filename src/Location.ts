import { any, type Context, createLanguage, map } from "@claudiu-ceia/combine";
import type { Parser } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import countries from "@data/countries-en-us" with { type: "json" };
import { fuzzyCase } from "./parsers.ts";

type CldrCountries = {
  names: Record<string, string>;
  aliases: Record<string, string[]>;
};

const cldr = countries as CldrCountries;

/**
 * Location entity (currently countries only, dataset-backed).
 */
export type LocationEntity = Entity<
  "location",
  {
    place: string;
    type: "country" | "other";
  }
>;

/**
 * Helper for constructing a `LocationEntity`.
 */
export const location = (
  value: LocationEntity["value"],
  before: Context,
  after: Context,
): LocationEntity => {
  return ent(value, "location", before, after);
};

type LocationLanguage = {
  Country: Parser<LocationEntity>;
  parser: Parser<LocationEntity>;
};

/**
 * Location parser language (countries list).
 */
export const Location: LocationLanguage = createLanguage<LocationLanguage>({
  Country: () => {
    const names = Object.entries(cldr.names).flatMap(([code, name]) => [
      name,
      ...(cldr.aliases[code] ?? []),
    ]);
    const longestFirst = [...new Set(names)].sort((a, b) =>
      b.length - a.length || a.localeCompare(b)
    );

    return map(
      any(...longestFirst.map(fuzzyCase)),
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
  parser: (s) => dot(any(s.Country)),
});
