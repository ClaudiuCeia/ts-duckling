import {
  any,
  createLanguage,
  either,
  eof,
  manyTill,
  map,
  skip1,
  seq,
  Parser,
} from "https://deno.land/x/combine@v0.0.8/mod.ts";
import { anyChar, space } from "../combine/src/parsers.ts";
import { word, __, dot } from "./src/common.ts";
import { Entity } from "./src/Entity.ts";
import { Quantity, QuantityEntity } from "./src/Quantity.ts";
import { Range } from "./src/Range.ts";
import { Temperature, TemperatureEntity } from "./src/Temperature.ts";
import { Time, TimeEntity } from "./src/Time.ts";
import { Location } from "./src/Location.ts";
import { URL } from "./src/URL.ts";
import { Email } from "./src/Email.ts";
import { Institution } from "./src/Institution.ts";

export type AnyEntity =
  | Entity<unknown, unknown>
  | TemperatureEntity
  | TimeEntity
  | QuantityEntity;

type DucklingLanguage = {
  Entity: Parser<AnyEntity>;
  Unstructured: Parser<string>;
  extract: Parser<(AnyEntity | null)[]>;
};

export const Duckling = (
  parsers: Parser<unknown>[] = [
    Range.parser,
    Temperature.parser,
    Time.parser,
    Quantity.parser,
    Location.parser,
    URL.parser,
    Email.parser,
    Institution.parser,
  ]
) =>
  createLanguage<DucklingLanguage>({
    Entity: () => any(...parsers),
    Unstructured: () => either(dot(__(word)), __(word)),
    extract: (s) =>
      map(
        seq(
          space(),
          map(
            manyTill(
              any(s.Entity, skip1(s.Unstructured), skip1(anyChar())),
              skip1(eof())
            ),
            ([...matches]) => {
              return matches.filter((m) => !!m);
            }
          )
        ),
        ([, res]) => res
      ),
  });

export * from "./src/Entity.ts";
export * from "./src/Quantity.ts";
export * from "./src/Range.ts";
export * from "./src/Temperature.ts";
export * from "./src/Time.ts";
export * from "./src/Location.ts";
export * from "./src/URL.ts";
export * from "./src/Email.ts";
export * from "./src/Institution.ts";
