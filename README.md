<p align="center">
  <img
    src="https://raw.githubusercontent.com/ClaudiuCeia/ts-duckling/main/logo.png"
    width="200"
    alt="ts-duckling logo"
  />
</p>

# ts-duckling

Extract typed entities from text in TypeScript.

Find dates, times, URLs, countries, quantities, institutions, languages, and
sensitive values in free-form text. Each result includes a typed value and its
source span. Everything runs locally, with no model or network request.

<p>
  <a href="https://github.com/ClaudiuCeia/ts-duckling/actions/workflows/ci.yml"><img src="https://github.com/ClaudiuCeia/ts-duckling/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://jsr.io/@claudiu-ceia/ts-duckling"><img src="https://jsr.io/badges/@claudiu-ceia/ts-duckling" alt="JSR"></a>
  <a href="https://www.npmjs.com/package/@claudiu-ceia/ts-duckling"><img src="https://img.shields.io/npm/v/@claudiu-ceia/ts-duckling" alt="npm"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/ClaudiuCeia/ts-duckling" alt="MIT license"></a>
</p>

```ts
import { Duckling, Email, Time, URL } from "@claudiu-ceia/ts-duckling";

const duckling = Duckling([Time.parser, URL.parser, Email.parser]);

const entities = duckling.extract(
  "The review is on May 18, 2024. Notes are at https://example.com/brief and contact alex@company.io",
);

for (const entity of entities) {
  console.log(entity.kind, entity.text, JSON.stringify(entity.value));
}
```

Output:

```text
time May 18, 2024 {"when":{"type":"date","year":2024,"month":5,"day":18},"grain":"day","era":"CE"}
url https://example.com/brief {"url":"https://example.com/brief"}
email alex@company.io {"email":"alex@company.io"}
```

Passing an explicit parser list controls what Duckling looks for and narrows
the result type to those entity kinds.

The example and output are checked in
[`examples/readme.test.ts`](./examples/readme.test.ts).

## Playground

Try the [live entity extraction playground](https://claudiuceia.github.io/ts-duckling/)
in your browser.

## Installation

```sh
bun add @claudiu-ceia/ts-duckling
```

```sh
npm install @claudiu-ceia/ts-duckling
```

```sh
pnpm add @claudiu-ceia/ts-duckling
```

```sh
deno add jsr:@claudiu-ceia/ts-duckling
```

Import the npm package in Bun or Node:

```ts
import { Duckling } from "@claudiu-ceia/ts-duckling";
```

Import the JSR package in Deno:

```ts
import { Duckling } from "jsr:@claudiu-ceia/ts-duckling";
```

## Supported entities

### General text entities

| Export        | `kind`        | Example                             | Scope or validation                                                                                    |
| ------------- | ------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `Time`        | `time`        | `May 18, 2024`, `next Friday`       | English-focused dates, times, weekdays, and relative expressions. Invalid calendar dates are rejected. |
| `Range`       | `range`       | `between 10 and 12 degrees Celsius` | Time, era-qualified year, and temperature ranges.                                                      |
| `Temperature` | `temperature` | `90F`, `20 Celsius`                 | Celsius, Fahrenheit, and some unitless degree expressions. A bare `1 degree` is rejected.              |
| `Quantity`    | `quantity`    | `100,000.24`, `2 million`           | Numeric quantities and English compact multipliers. It does not assign physical or currency units.     |
| `Location`    | `location`    | `Germany`, `Türkiye`                | Countries only. It does not recognize cities, landmarks, or addresses.                                 |
| `URL`         | `url`         | `https://example.com/brief`         | HTTP, HTTPS, FTP, FTPS, and bare domains. Bare domains require a listed active TLD.                    |
| `Institution` | `institution` | `King's College London`             | Capitalization-based names for universities, colleges, schools, city halls, and town halls.            |
| `Language`    | `language`    | `Mandarin Chinese`                  | English CLDR names, aliases, and compatibility names with canonical language codes.                    |

### Sensitive values and identifiers

| Export          | `kind`           | Example                                       | Scope or validation                                                                                |
| --------------- | ---------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `Email`         | `email`          | `no-reply+foo@some.domain.dev`                | Validates syntax, boundaries, and length limits. It does not check deliverability.                 |
| `Phone`         | `phone`          | `+1 (415) 555-2671`                           | Structural E.164-shaped international and 10-digit NANP forms. It does not query numbering plans.  |
| `IPAddress`     | `ip`             | `192.168.1.1`, `2001:db8::1`                  | Validates IPv4 octets and full or compressed hexadecimal IPv6.                                     |
| `SSN`           | `ssn`            | `123-45-6789`                                 | Hyphenated US format with basic area, group, and serial constraints. Validation is not exhaustive. |
| `CreditCard`    | `credit_card`    | `4242 4242 4242 4242`                         | Requires 13 to 19 digits and a valid Luhn checksum. It does not validate the issuer.               |
| `UUID`          | `uuid`           | `550e8400-e29b-41d4-a716-446655440000`        | Canonical hexadecimal shape. Version and variant bits are not constrained.                         |
| `ApiKey`        | `api_key`        | `sk_live_` followed by a provider key body    | Recognized provider prefixes only. Generic unprefixed keys are not matched.                        |
| `IBAN`          | `iban`           | `GB29 NWBK 6016 1331 9268 19`                 | Checks supported country length and the Mod 97 checksum.                                           |
| `MACAddress`    | `mac_address`    | `00:1A:2B:3C:4D:5E`                           | Six-octet colon or hyphen forms and Cisco dot notation. It does not validate the OUI.              |
| `JWT`           | `jwt`            | `eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.abc123` | Checks three base64url-shaped segments and a JSON object header. It does not verify signatures.    |
| `CryptoAddress` | `crypto_address` | `1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2`          | Checksum-validates supported Bitcoin forms and validates Ethereum address casing rules.            |
| `BIC`           | `bic`            | `DEUTDEFF`, `BOFAUS3NXXX`                     | Checks uppercase ISO 9362 shape and a known country code. It does not query a bank registry.       |

## Selecting parsers and typed results

Parser selection controls recognition scope and TypeScript inference:

```ts
import { Duckling, Time, URL } from "@claudiu-ceia/ts-duckling";

const duckling = Duckling([Time.parser, URL.parser]);
const entities = duckling.extract("Review May 18, 2024 at https://example.com");
// entities: (TimeEntity | URLEntity)[]
```

Call `Duckling()` with no arguments to explore all 20 built-in parser
categories. Most applications should select only the categories they need to
reduce false positives.

`extractAsync(text, options)` scans one complete string and periodically yields
to the event loop. It supports cancellation through `AbortSignal`. It is
cooperative asynchronous scanning. It does not consume a stream of chunks.

## Rendering extracted spans

Use `renderMap()` to turn extracted spans into React or JSX values while
preserving unmatched text:

```tsx
import type { JSX } from "react";
import { Duckling, Time, URL } from "@claudiu-ceia/ts-duckling";

const text = "Review May 18, 2024 at https://example.com";
const parts = Duckling([Time.parser, URL.parser]).renderMap<JSX.Element>(
  text,
  ({ entity, children }) => (
    <mark key={entity.start} data-kind={entity.kind}>
      {children}
    </mark>
  ),
);
```

`render()` performs string replacement through the same extracted spans. A
callback receives the entity and the already-rendered text for its span.

> `render()` does not sanitize HTML, attributes, or URLs. Escape and validate
> values before inserting its output into a document.

## PII and sensitive values

`PIIParsers` detects configured sensitive formats and `.redact()` provides
basic span replacement. Use
[`@claudiu-ceia/pii-mask`](https://github.com/ClaudiuCeia/pii-mask) for nested
object traversal, reusable masking policies, caching, and Pino or Winston
integration.

```ts
import { Duckling, PIIParsers } from "@claudiu-ceia/ts-duckling";

const scrubbed = Duckling(PIIParsers).redact("Email alex@company.io");
// "Email ███████████████"
```

Detection is rule-based and can produce false positives and false negatives.
It is not a compliance boundary and should not replace known-field redaction.

The preset includes email addresses, phone numbers, IP addresses, SSNs, credit
card numbers, UUIDs, API keys, IBANs, MAC addresses, JWTs, cryptocurrency
addresses, and BIC/SWIFT identifiers. Some of these are credentials or
identifiers rather than universally defined PII.

## Custom entities

Any Combine parser that returns an `Entity` can be used alongside the built-in
parsers.

```ts
import { defineLanguage, map, regex } from "@claudiu-ceia/combine";
import { Duckling, ent, type Entity } from "@claudiu-ceia/ts-duckling";

type HashtagEntity = Entity<"hashtag", { tag: string }>;

const Hashtag = defineLanguage<{
  Full: HashtagEntity;
  parser: HashtagEntity;
}>({
  Full: () =>
    map(regex(/#[A-Za-z0-9_]{2,64}/, "hashtag"), (match, before, after) =>
      ent({ tag: match.slice(1) }, "hashtag", before, after),
    ),
  parser: (symbol) => symbol.Full,
});

const entities = Duckling([Hashtag.parser]).extract("Ship #duckling");
```

See [Combine](https://github.com/ClaudiuCeia/combine) for grammar construction.

## Scope and accuracy

- Recognition is rule-based.
- Temporal vocabulary and supporting data are English-focused.
- `Location` currently recognizes countries only.
- Yearless and relative dates depend on the current UTC date.
- Ambiguous text can produce false positives. For example, `6/2022` can be read as a date.
- Entity validation varies by parser. The tables above summarize important checks.
- Duckling does not perform open-domain named entity recognition.
- PII and credential detection cannot guarantee that sensitive text is absent.

Use a narrow parser list and test against representative input. Do not enable
entity categories that the application does not need.

## Runtime support

The published package is runtime-neutral TypeScript and ESM.

Bun is the primary development toolchain. npm packages are tested on Bun and
supported Node versions. The same source is published to JSR and checked with
Deno. Browser support is exercised through the playground build.

CI pins Bun 1.4.0, tests Node 24 and 26, and checks the JSR source with Deno 2.x.

The playground is part of the Bun workspace. Its source remains under `docs/`
because GitHub Pages publishes that directory.

## Benchmarks

Benchmark sources in [`bench/`](./bench/) cover mixed text, sensitive values,
no-match text, parser selection, and cooperative async scanning. They are
regression checks rather than published performance claims.

Run them with `bun run bench`. Record the Bun version, machine or CI runner,
input size, selected parsers, match count, sample count, and reported statistic
when publishing results.

## API documentation

The main methods are:

```text
Duckling(parsers?)
extract(text)
extractAsync(text, options?)
render(text, callback)
renderMap(text, callback)
redact(text, options?)
```

Async variants of `render()` and `renderMap()` are also available. See the
[generated JSR API reference](https://jsr.io/@claudiu-ceia/ts-duckling/doc) for
types, callback signatures, entity value shapes, and experimental API details.

## Development

Install dependencies and run the repository checks with Bun:

```sh
bun install
bun run check
bun run package:check
bun run bench
```

Run the playground with `bun run docs:dev` and build it with
`bun run docs:build`.

Deno remains part of compatibility and JSR validation:

```sh
DENO_NO_PACKAGE_JSON=1 deno check --frozen-lockfile mod.ts
DENO_NO_PACKAGE_JSON=1 deno publish --dry-run --frozen-lockfile
```

## License

MIT © [Claudiu Ceia](https://github.com/ClaudiuCeia)
