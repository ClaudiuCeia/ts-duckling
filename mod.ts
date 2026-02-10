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
import { asyncScan, type AsyncScanOptions } from "./src/async.ts";
import { buildSpanTree, renderMapNode, renderNode } from "./src/render.ts";
import type { RenderFn, RenderMapFn } from "./src/render.ts";
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
import { IBAN, type IBANEntity } from "./src/IBAN.ts";
import { MACAddress, type MACAddressEntity } from "./src/MACAddress.ts";
import { JWT, type JWTEntity } from "./src/JWT.ts";
import {
  CryptoAddress,
  type CryptoAddressEntity,
} from "./src/CryptoAddress.ts";
import { BIC, type BICEntity } from "./src/BIC.ts";

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
  | ApiKeyEntity
  | IBANEntity
  | MACAddressEntity
  | JWTEntity
  | CryptoAddressEntity
  | BICEntity;

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
  IBAN.parser,
  MACAddress.parser,
  JWT.parser,
  CryptoAddress.parser,
  BIC.parser,
];

/**
 * Union of entity types considered Personally Identifiable Information (PII).
 *
 * Covers: email addresses, phone numbers, IP addresses, Social Security
 * Numbers, credit card numbers, UUIDs, API keys, IBANs, MAC addresses,
 * JWTs, and cryptocurrency wallet addresses.
 */
export type PIIEntity =
  | EmailEntity
  | PhoneEntity
  | IPAddressEntity
  | SSNEntity
  | CreditCardEntity
  | UUIDEntity
  | ApiKeyEntity
  | IBANEntity
  | MACAddressEntity
  | JWTEntity
  | CryptoAddressEntity
  | BICEntity;

/**
 * Pre-built parser tuple targeting PII entities.
 *
 * Pass this to {@link Duckling} for a quick redaction pipeline:
 *
 * @example
 * ```ts
 * import { Duckling, PIIParsers } from "@claudiu-ceia/ts-duckling";
 *
 * Duckling(PIIParsers).redact("Email me at a@b.com, SSN 123-45-6789");
 * // → "Email me at ███████████████, SSN ███████████"
 * ```
 */
export const PIIParsers: ParserTuple<
  [
    EmailEntity,
    PhoneEntity,
    IPAddressEntity,
    SSNEntity,
    CreditCardEntity,
    UUIDEntity,
    ApiKeyEntity,
    IBANEntity,
    MACAddressEntity,
    JWTEntity,
    CryptoAddressEntity,
    BICEntity,
  ]
> = [
  Email.parser,
  Phone.parser,
  IPAddress.parser,
  SSN.parser,
  CreditCard.parser,
  UUID.parser,
  ApiKey.parser,
  IBAN.parser,
  MACAddress.parser,
  JWT.parser,
  CryptoAddress.parser,
  BIC.parser,
];

type NonEmptyArray<T> = [T, ...T[]];
type ParserTuple<T extends NonEmptyArray<unknown>> = {
  [K in keyof T]: Parser<T[K]>;
};

/**
 * Options for {@link Duckling().redact}.
 *
 * @property mask  - The character used to replace each redacted character.
 *                   Defaults to `"█"`.
 * @property kinds - If provided, only entities whose `kind` matches one of
 *                   these values are redacted. When omitted **all** extracted
 *                   entities are redacted.
 */
export interface RedactOptions<K extends string = string> {
  mask?: string;
  kinds?: K[];
}

export type { AsyncScanOptions } from "./src/async.ts";
export type {
  RenderEntity,
  RenderFn,
  RenderMapEntity,
  RenderMapFn,
} from "./src/render.ts";

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
export function Duckling(): {
  extract: (text: string) => AnyEntity[];
  /** @experimental */
  extractAsync: (
    text: string,
    opts?: AsyncScanOptions,
  ) => Promise<AnyEntity[]>;
  redact: (text: string, opts?: RedactOptions<AnyEntity["kind"]>) => string;
  render: (text: string, fn: RenderFn<AnyEntity>) => string;
  /** @experimental */
  renderAsync: (
    text: string,
    fn: RenderFn<AnyEntity>,
    opts?: AsyncScanOptions,
  ) => Promise<string>;
  renderMap: <R>(text: string, fn: RenderMapFn<AnyEntity, R>) => (string | R)[];
  /** @experimental */
  renderMapAsync: <R>(
    text: string,
    fn: RenderMapFn<AnyEntity, R>,
    opts?: AsyncScanOptions,
  ) => Promise<(string | R)[]>;
};
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
): {
  extract: (text: string) => T[number][];
  /** @experimental */
  extractAsync: (
    text: string,
    opts?: AsyncScanOptions,
  ) => Promise<T[number][]>;
  redact: (
    text: string,
    opts?: RedactOptions<
      T[number] extends { kind: infer K extends string } ? K : string
    >,
  ) => string;
  render: (text: string, fn: RenderFn<T[number]>) => string;
  /** @experimental */
  renderAsync: (
    text: string,
    fn: RenderFn<T[number]>,
    opts?: AsyncScanOptions,
  ) => Promise<string>;
  renderMap: <R>(
    text: string,
    fn: RenderMapFn<T[number], R>,
  ) => (string | R)[];
  /** @experimental */
  renderMapAsync: <R>(
    text: string,
    fn: RenderMapFn<T[number], R>,
    opts?: AsyncScanOptions,
  ) => Promise<(string | R)[]>;
};

// deno-lint-ignore no-explicit-any
export function Duckling(parsers?: any): any {
  const p: Parser<unknown>[] = parsers ?? DefaultParsers;
  let parser: Parser<unknown>;

  if (p.length === 0) {
    parser = (ctx) => failure(ctx, "entity");
  }

  const entities = map(
    step(
      recognizeAt(...(p as NonEmptyArray<Parser<unknown>>)),
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

  const parse = (input: string): unknown[] => {
    const result = parser({ text: input, index: 0 });
    return result.success ? (result.value as unknown[]) : [];
  };

  return {
    extract: parse,
    /**
     * @experimental
     *
     * Async version of {@link extract} that yields to the event loop
     * periodically, preventing main-thread blocking on large inputs.
     *
     * Uses `scheduler.yield()` when available (Chrome 129+, Edge 129+,
     * Firefox 142+), falling back to `setTimeout(0)`.
     *
     * @example
     * ```ts
     * const controller = new AbortController();
     * const entities = await Duckling().extractAsync(longText, {
     *   signal: controller.signal,
     *   yieldEvery: 256,
     * });
     * ```
     */
    extractAsync: (
      input: string,
      opts?: AsyncScanOptions,
    ): Promise<unknown[]> => {
      return asyncScan(
        input,
        p as NonEmptyArray<Parser<unknown>>,
        opts,
      );
    },
    /**
     * Replace entity spans using a callback function.
     *
     * Entities are arranged into a tree: wider spans become parents of
     * narrower ones contained within them. The callback receives each entity
     * together with the already-rendered text of its children, allowing
     * nested rendering (e.g. an SSN wrapping its quantity sub-parts).
     *
     * Return a replacement string to transform the span, or `undefined` to
     * leave it as-is.
     *
     * @example
     * ```ts
     * // Wrap entities in HTML tags
     * Duckling().render(
     *   "Email me at a@b.com",
     *   ({ entity, children }) =>
     *     `<mark data-kind="${entity.kind}">${children}</mark>`,
     * );
     * // → 'Email me at <mark data-kind="email">a@b.com</mark>'
     * ```
     */
    render: (
      input: string,
      fn: RenderFn<unknown>,
    ): string => {
      const all = parse(input) as {
        kind: string;
        start: number;
        end: number;
        text: string;
      }[];
      if (all.length === 0) return input;
      const tree = buildSpanTree(all, input.length);
      return renderNode(tree, input, fn);
    },
    /**
     * @experimental
     *
     * Async version of {@link render} that yields to the event loop
     * during entity extraction.
     */
    renderAsync: async (
      input: string,
      fn: RenderFn<unknown>,
      opts?: AsyncScanOptions,
    ): Promise<string> => {
      const all = (await asyncScan(
        input,
        p as NonEmptyArray<Parser<unknown>>,
        opts,
      )) as {
        kind: string;
        start: number;
        end: number;
        text: string;
      }[];
      if (all.length === 0) return input;
      const tree = buildSpanTree(all, input.length);
      return renderNode(tree, input, fn);
    },
    /**
     * Map entity spans to arbitrary values, returning an array of segments.
     *
     * Like {@link render}, entities are arranged into a span tree. The
     * callback receives each entity and its children as `(string | R)[]`
     * segments — ideal for frameworks like React where you need element
     * arrays rather than concatenated strings.
     *
     * @example
     * ```tsx
     * // React: wrap entities in <mark> elements
     * const segments = Duckling([Email.parser]).renderMap<JSX.Element>(
     *   "Contact a@b.com please",
     *   ({ entity, children }) =>
     *     <mark data-kind={entity.kind}>{children}</mark>,
     * );
     * // → ["Contact ", <mark data-kind="email">a@b.com</mark>, " please"]
     * ```
     */
    renderMap: <R>(
      input: string,
      // deno-lint-ignore no-explicit-any
      fn: RenderMapFn<any, R>,
    ): (string | R)[] => {
      const all = parse(input) as {
        kind: string;
        start: number;
        end: number;
        text: string;
      }[];
      if (all.length === 0) return [input];
      const tree = buildSpanTree(all, input.length);
      return renderMapNode<R>(tree, input, fn);
    },
    /**
     * @experimental
     *
     * Async version of {@link renderMap} that yields to the event loop
     * during entity extraction.
     */
    renderMapAsync: async <R>(
      input: string,
      // deno-lint-ignore no-explicit-any
      fn: RenderMapFn<any, R>,
      opts?: AsyncScanOptions,
    ): Promise<(string | R)[]> => {
      const all = (await asyncScan(
        input,
        p as NonEmptyArray<Parser<unknown>>,
        opts,
      )) as {
        kind: string;
        start: number;
        end: number;
        text: string;
      }[];
      if (all.length === 0) return [input];
      const tree = buildSpanTree(all, input.length);
      return renderMapNode<R>(tree, input, fn);
    },
    /**
     * Extract entities and replace each matched span with a mask character.
     *
     * Implemented on top of {@link render}. When `opts.kinds` is provided,
     * only entities of those kinds are redacted; otherwise **every** detected
     * entity is masked.
     *
     * @example
     * ```ts
     * Duckling().redact("Email me at a@b.com, SSN 123-45-6789");
     * // → "Email me at ███████, SSN ███████████"
     *
     * Duckling().redact("Call +14155552671", { kinds: ["phone"] });
     * // → "Call ████████████"
     *
     * Duckling().redact("SSN 123-45-6789", { mask: "X" });
     * // → "SSN XXXXXXXXXXX"
     * ```
     */
    redact: (
      input: string,
      opts: RedactOptions = {},
    ): string => {
      const mask = opts.mask ?? "█";
      const all = parse(input) as {
        kind: string;
        start: number;
        end: number;
        text: string;
      }[];
      const filtered = opts.kinds
        ? all.filter((e) => opts.kinds!.includes(e.kind))
        : all;
      if (filtered.length === 0) return input;

      const tree = buildSpanTree(filtered, input.length);
      return renderNode(tree, input, ({ entity }) => {
        return mask.repeat(entity.end - entity.start);
      });
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
export * from "./src/IBAN.ts";
export * from "./src/MACAddress.ts";
export * from "./src/JWT.ts";
export * from "./src/CryptoAddress.ts";
export * from "./src/BIC.ts";
