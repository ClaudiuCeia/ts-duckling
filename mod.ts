import {
  any,
  anyChar,
  createLanguageThis,
  eof,
  failure,
  manyTill,
  map,
  optional,
  type Parser,
  seq,
  skip1,
  space,
} from "@claudiu-ceia/combine";
import { recognizeAt, step } from "@claudiu-ceia/combine/nondeterministic";
import { __, dot, word } from "./src/common.ts";
import { Quantity, type QuantityEntity } from "./src/Quantity.ts";
import { Range, type RangeEntity } from "./src/Range.ts";
import { Temperature, type TemperatureEntity } from "./src/Temperature.ts";
import { Time, type TimeEntity } from "./src/Time.ts";
import { Location, type LocationEntity } from "./src/Location.ts";
import { URL, type URLEntity } from "./src/URL.ts";
import { Email, type EmailEntity } from "./src/Email.ts";
import { Institution, type InstitutionEntity } from "./src/Institution.ts";
import { Language, type LanguageEntity } from "./src/Language.ts";
import { Phone, type PhoneEntity } from "./src/Phone.ts";
import { IPAddress, type IPAddressEntity } from "./src/IPAddress.ts";
import { SSN, type SSNEntity } from "./src/SSN.ts";
import { CreditCard, type CreditCardEntity } from "./src/CreditCard.ts";
import { UUID, type UUIDEntity } from "./src/UUID.ts";
import { ApiKey, type ApiKeyEntity } from "./src/ApiKey.ts";

/**
 * Union of all entity types returned by the built-in parsers.
 *
 * Note: `Duckling().extract()` can return multiple matches for the same span
 * (for example a structured parser + a more generic `quantity` match).
 */
export type AnyEntity =
  | TemperatureEntity
  | TimeEntity
  | QuantityEntity
  | RangeEntity<TemperatureEntity>
  | RangeEntity<TimeEntity>
  | LocationEntity
  | URLEntity
  | EmailEntity
  | InstitutionEntity
  | LanguageEntity
  | PhoneEntity
  | IPAddressEntity
  | SSNEntity
  | CreditCardEntity
  | UUIDEntity
  | ApiKeyEntity;

type DucklingLanguage = {
  Entity: () => Parser<AnyEntity[]>;
  Unstructured: () => Parser<string>;
  extract: () => Parser<AnyEntity[]>;
};

/**
 * Creates a Duckling-like extractor language.
 *
 * It parses arbitrary text and returns entity matches produced by the provided
 * entity parsers.
 */
export const Duckling: (
  parsers?: Parser<AnyEntity>[],
) => ReturnType<typeof createLanguageThis<DucklingLanguage>> = (
  parsers: Parser<AnyEntity>[] = [
    Range.parser,
    Email.parser,
    URL.parser,
    UUID.parser,
    Phone.parser,
    IPAddress.parser,
    SSN.parser,
    CreditCard.parser,
    Time.parser,
    Temperature.parser,
    Quantity.parser,
    Location.parser,
    Institution.parser,
    Language.parser,
    ApiKey.parser,
  ],
) =>
  createLanguageThis<DucklingLanguage>({
    Entity() {
      if (parsers.length === 0) {
        return (ctx) => failure(ctx, "entity");
      }

      // Return all entity matches at the current position, but only advance by
      // the shortest match. This ensures we don't "skip over" potential
      // overlapping matches (useful for debug/analysis and the demo UI).
      const p = step(
        recognizeAt(
          ...(parsers as [Parser<AnyEntity>, ...Parser<AnyEntity>[]]),
        ),
        "shortest",
      );
      return map(p, (recs) => recs.map((r) => r.value));
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
            ([...matches]) =>
              matches.filter((m): m is AnyEntity[] => Array.isArray(m)).flat(),
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
export * from "./src/Phone.ts";
export * from "./src/IPAddress.ts";
export * from "./src/SSN.ts";
export * from "./src/CreditCard.ts";
export * from "./src/UUID.ts";
export * from "./src/Institution.ts";
export * from "./src/Language.ts";
export * from "./src/ApiKey.ts";
