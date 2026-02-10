import {
  any,
  anyChar,
  eof,
  failure,
  manyTill,
  map,
  optional,
  type Parser,
  recognizeAt,
  seq,
  skip1,
  space,
  step,
} from "@claudiu-ceia/combine";
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
 * Union of all entity types produced by the built-in parsers.
 *
 * This is the element type returned by `Duckling().extract(...)` when no
 * custom parser list is provided.
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

const DefaultParsers: [Parser<AnyEntity>, ...Parser<AnyEntity>[]] = [
  Range.parser,
  Time.parser,
  Temperature.parser,
  Quantity.parser,
  Location.parser,
  URL.parser,
  Email.parser,
  Institution.parser,
  Language.parser,
  Phone.parser,
  IPAddress.parser,
  SSN.parser,
  CreditCard.parser,
  UUID.parser,
  ApiKey.parser,
];

type NonEmptyArray<T> = [T, ...T[]];
type ParserTuple<T extends NonEmptyArray<unknown>> = {
  [K in keyof T]: Parser<T[K]>;
};

/**
 * Create an extractor that scans free-form text and returns all matching
 * entities.
 *
 * Called without arguments, uses all built-in parsers and returns
 * `AnyEntity[]`.
 *
 * @example
 * ```ts
 * const entities = Duckling().extract("It's 90F outside, email me at a@b.com");
 * // entities: AnyEntity[]
 * ```
 */
export function Duckling(): { extract: (text: string) => AnyEntity[] };
/**
 * Create an extractor with a specific set of parsers. The return type is
 * automatically narrowed to the union of the entity types produced by the
 * given parsers.
 *
 * @param parsers - A non-empty array of entity parsers.
 *
 * @example
 * ```ts
 * const entities = Duckling([Email.parser, URL.parser]).extract(
 *   "Reach me at a@b.com or https://example.com",
 * );
 * // entities: (EmailEntity | URLEntity)[]
 * ```
 */
export function Duckling<T extends NonEmptyArray<unknown>>(
  parsers: ParserTuple<T>,
): { extract: (text: string) => T[number][] };

export function Duckling(parsers: Parser<unknown>[] = DefaultParsers) {
  let parser: Parser<unknown>;

  if (parsers.length === 0) {
    parser = (ctx) => failure(ctx, "entity");
  }

  const entities = map(
    step(
      recognizeAt(...(parsers as NonEmptyArray<Parser<unknown>>)),
      "shortest",
    ),
    (recs) => recs.map((r) => r.value),
  );

  const unstructured = any(dot(word), __(word), space());
  parser = map(
    seq(
      optional(space()),
      map(
        manyTill(
          any(entities, skip1(unstructured), skip1(anyChar())),
          skip1(eof()),
        ),
        ([...matches]) =>
          matches.filter((m): m is AnyEntity[] => Array.isArray(m)).flat(),
      ),
    ),
    ([, res]) => res,
  );

  return {
    extract: (input: string) => {
      const result = parser({ text: input, index: 0 });
      return result.success ? result.value : [];
    },
  };
}

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
