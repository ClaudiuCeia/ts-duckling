import {
  allMatches,
  any,
  anyChar,
  createLanguageThis,
  eof,
  failure,
  manyTill,
  map,
  optional,
  Parser,
  seq,
  skip1,
  space,
} from "@claudiu-ceia/combine";
import { __, dot, word } from "./src/common.ts";
import { Quantity, QuantityEntity } from "./src/Quantity.ts";
import { Range, type RangeEntity } from "./src/Range.ts";
import { Temperature, TemperatureEntity } from "./src/Temperature.ts";
import { Time, TimeEntity } from "./src/Time.ts";
import { Location, LocationEntity } from "./src/Location.ts";
import { URL, URLEntity } from "./src/URL.ts";
import { Email, EmailEntity } from "./src/Email.ts";
import { Institution, InstitutionEntity } from "./src/Institution.ts";
import { Language, LanguageEntity } from "./src/Language.ts";
import { Phone, PhoneEntity } from "./src/Phone.ts";
import { IPAddress, IPAddressEntity } from "./src/IPAddress.ts";
import { SSN, SSNEntity } from "./src/SSN.ts";
import { CreditCard, CreditCardEntity } from "./src/CreditCard.ts";
import { UUID, UUIDEntity } from "./src/UUID.ts";

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
  | UUIDEntity;

export const Duckling = (
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
  ],
) =>
  createLanguageThis({
    Entity() {
      if (parsers.length === 0) {
        return (ctx) => failure(ctx, "entity");
      }

      const matchAll = allMatches(
        ...(parsers as [Parser<AnyEntity>, ...Parser<AnyEntity>[]]),
      );
      return matchAll as Parser<AnyEntity[]>;
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
