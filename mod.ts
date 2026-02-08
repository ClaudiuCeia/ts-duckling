import {
  any,
  anyChar,
  createLanguageThis,
  eof,
  manyTill,
  map,
  optional,
  Parser,
  seq,
  skip1,
  space,
} from "@claudiu-ceia/combine";
import { __, dot, word } from "./src/common.ts";
import { Entity } from "./src/Entity.ts";
import { Quantity, QuantityEntity } from "./src/Quantity.ts";
import { Range } from "./src/Range.ts";
import { Temperature, TemperatureEntity } from "./src/Temperature.ts";
import { Time, TimeEntity } from "./src/Time.ts";
import { Location, LocationEntity } from "./src/Location.ts";
import { URL, URLEntity } from "./src/URL.ts";
import { Email, EmailEntity } from "./src/Email.ts";
import { Institution, InstitutionEntity } from "./src/Institution.ts";
import { Language, LanguageEntity } from "./src/Language.ts";

export type AnyEntity =
  | Entity<unknown, unknown>
  | TemperatureEntity
  | TimeEntity
  | QuantityEntity
  | LocationEntity
  | URLEntity
  | EmailEntity
  | InstitutionEntity
  | LanguageEntity;

export const Duckling = (
  parsers: Parser<AnyEntity>[] = [
    Range.parser,
    Time.parser,
    Temperature.parser,
    Quantity.parser,
    Location.parser,
    URL.parser,
    Email.parser,
    Institution.parser,
    Language.parser,
  ],
) =>
  createLanguageThis({
    Entity() {
      return any(...parsers);
    },
    Unstructured() {
      return any(dot(word), __(word), space());
    },
    extract() {
      return map(
        seq(
          optional(space()),
          map(
            manyTill(
              any(this.Entity, skip1(this.Unstructured), skip1(anyChar())),
              skip1(eof()),
            ),
            ([...matches]) => matches.filter((m) => !!m),
          ),
        ),
        ([, res]) => res,
      );
    },
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
export * from "./src/Language.ts";
