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

type AnyEntity =
  | Entity<unknown, unknown>
  | TemperatureEntity
  | TimeEntity
  | QuantityEntity;

type DucklingLanguage = {
  Entity: Parser<AnyEntity>;
  Unstructured: Parser<string>;
  extract: Parser<(AnyEntity | null)[]>;
};

export const Duckling = createLanguage<DucklingLanguage>({
  Entity: () =>
    any(Range.parser, Temperature.parser, Time.parser, Quantity.parser),
  Unstructured: () => either(dot(__(word)), __(word)),
  extract: (s) =>
    map(
      seq(
        space(),
        map(
          manyTill(any(s.Entity, skip1(s.Unstructured), skip1(anyChar())), skip1(eof())),
          ([...matches]) => {
            return matches.filter((m) => !!m);
          }
        )
      ),
      ([, res]) => res
    ),
});
