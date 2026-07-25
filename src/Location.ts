import { any, type Context, defineLanguage, map } from "@claudiu-ceia/combine";
import type { Language as DefinedLanguage } from "@claudiu-ceia/combine";
import { dot } from "./common.ts";
import { ent, type Entity } from "./Entity.ts";
import countries from "@data/countries-en-us" with { type: "json" };
import { longestLiteral } from "./parsers.ts";

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

const countryNames = Object.entries(cldr.names).flatMap(([code, name]) => [
  name,
  ...(cldr.aliases[code] ?? []),
]);
const countryParser = map(
  longestLiteral(
    [...new Set(countryNames)].sort((a, b) =>
      b.length - a.length || a.localeCompare(b)
    ),
    { caseInsensitive: true },
  ),
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

type LocationOutputs = {
  Country: LocationEntity;
  parser: LocationEntity;
};

/**
 * Location parser language (countries list).
 */
export const Location: DefinedLanguage<LocationOutputs> = defineLanguage<
  LocationOutputs
>({
  Country: () => countryParser,
  parser: (s) => dot(any(s.Country)),
});
