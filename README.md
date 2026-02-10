<p align="center">
  <img
    src="https://raw.githubusercontent.com/ClaudiuCeia/ts-duckling/main/logo.png"
    width="200"
    alt="ts-duckling logo"
  />
</p>

<h1 align="center">ts-duckling</h1>

<p align="center">
  A tiny, deterministic entity extractor for TypeScript.<br>
  <b>Extract</b> structured data and <b>redact</b> PII from free-form text — no ML, no network calls.
</p>

<p align="center">
  <a href="https://github.com/ClaudiuCeia/ts-duckling/actions/workflows/ci.yml"><img src="https://github.com/ClaudiuCeia/ts-duckling/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://jsr.io/@claudiu-ceia/ts-duckling"><img src="https://jsr.io/badges/@claudiu-ceia/ts-duckling" alt="JSR"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/ClaudiuCeia/ts-duckling" alt="MIT license"></a>
  <a href="https://claudiuceia.github.io/ts-duckling/"><img src="https://img.shields.io/badge/playground-live%20demo-3b82f6" alt="Playground"></a>
</p>

```ts
import { Duckling, PIIParsers } from "@claudiu-ceia/ts-duckling";

// Extract structured entities
const entities = Duckling().extract(
  "Email me at foo@bar.com — meeting at 3pm",
);
// → [{ kind: "email", value: { email: "foo@bar.com" }, ... },
//    { kind: "time",  value: { when: "...", grain: "hour" }, ... }]

// Redact PII in one line
Duckling(PIIParsers).redact("Email me at foo@bar.com, SSN 123-45-6789");
// → "Email me at ███████████████, SSN ███████████"
```

## Overview

**ts-duckling** uses
[parser combinator grammars](https://github.com/ClaudiuCeia/combine) (no ML
models, no HTTP) to extract structured entities from text. Inspired by
Facebook's [duckling](https://github.com/facebook/duckling), but built in pure
TypeScript and running anywhere — Deno, Node, or the browser.

- **Deterministic** — same input always produces the same output
- **Typed** — parser selection narrows the return type automatically
- **Composable** — bring your own parsers alongside the built-in ones
- **Self-contained** — no native dependencies, no runtime downloads, no network calls
- **Runs everywhere** — Deno, Node.js, and browsers (see the [live playground](https://claudiuceia.github.io/ts-duckling/))

## Documentation

- [Installation](#installation)
- [Getting started](#getting-started)
  - [Extract entities](#extract-entities)
  - [Pick specific parsers](#pick-specific-parsers)
  - [Redact PII](#redact-pii)
  - [Custom entities](#custom-entities)
- [Supported entities](#supported-entities)
- [API reference](#api-reference)
  - [`Duckling()`](#duckling-1)
  - [`.extract(text)`](#extracttext)
  - [`.redact(text, opts?)`](#redacttext-opts)
  - [`PIIParsers`](#piiparsers)
  - [`RedactOptions`](#redactoptions)
  - [`AnyEntity`](#anyentity)
  - [`PIIEntity`](#piientity)
- [Caveats](#caveats)
- [Playground](#playground)
- [License](#license)

## Installation

### Deno / JSR

```ts
import { Duckling } from "jsr:@claudiu-ceia/ts-duckling";
```

Or add to your import map:

```sh
deno add jsr:@claudiu-ceia/ts-duckling
```

### npm

```sh
npx jsr add @claudiu-ceia/ts-duckling
```

## Getting started

### Extract entities

Call `Duckling()` with no arguments to use **all 15 built-in parsers**:

```ts
import { Duckling } from "@claudiu-ceia/ts-duckling";

const entities = Duckling().extract(
  "Email me at foo@example.com and visit https://example.com tomorrow at 3pm.",
);

for (const e of entities) {
  console.log(e.kind, e.text);
}
// email  foo@example.com
// url    https://example.com
// time   tomorrow at 3pm
```

Each entity carries structured data:

```ts
// entities[0]
{
  kind: "email",
  value: { email: "foo@example.com" },
  start: 12,
  end: 27,
  text: "foo@example.com"
}
```

### Pick specific parsers

Pass an array of parsers to narrow both **what gets extracted** and **the return
type**:

```ts
import { Duckling, Email, URL } from "@claudiu-ceia/ts-duckling";

const entities = Duckling([Email.parser, URL.parser]).extract(
  "Reach me at a@b.com or https://example.com",
);
// entities: (EmailEntity | URLEntity)[]
```

### Redact PII

Use `.redact()` to replace matched entity spans with a mask character:

```ts
import { Duckling, PIIParsers } from "@claudiu-ceia/ts-duckling";

// Redact all PII (email, phone, IP, SSN, credit card, UUID, API key)
Duckling(PIIParsers).redact("Contact foo@bar.com, SSN 078-05-1120");
// → "Contact ███████████████, SSN ███████████"

// Custom mask character
Duckling(PIIParsers).redact("Call +14155552671", { mask: "X" });
// → "Call XXXXXXXXXXXX"

// Redact only specific kinds
Duckling(PIIParsers).redact("foo@bar.com 123-45-6789", { kinds: ["ssn"] });
// → "foo@bar.com ███████████"
```

### Custom entities

Define a parser that returns an `Entity`, then pass it to `Duckling`:

```ts
import { createLanguage, map, type Parser, regex } from "@claudiu-ceia/combine";
import { Duckling, ent, type Entity } from "@claudiu-ceia/ts-duckling";

type HashtagEntity = Entity<"hashtag", { tag: string }>;

type HashtagLanguage = {
  Full: Parser<HashtagEntity>;
  parser: Parser<HashtagEntity>;
};

const Hashtag = createLanguage<HashtagLanguage>({
  Full: () =>
    map(
      regex(/#[A-Za-z0-9_]{2,64}/, "hashtag"),
      (m, b, a) => ent({ tag: m.slice(1) }, "hashtag", b, a),
    ),
  parser: (s) => s.Full,
});

const entities = Duckling([Hashtag.parser]).extract("hello #duckling");
// → [{ kind: "hashtag", value: { tag: "duckling" }, start: 6, end: 15, text: "#duckling" }]
```

Custom parsers compose freely with the built-in ones:

```ts
import { Email } from "@claudiu-ceia/ts-duckling";

const entities = Duckling([Email.parser, Hashtag.parser]).extract(
  "Email a@b.com with #feedback",
);
// entities: (EmailEntity | HashtagEntity)[]
```

## Supported entities

| Entity          | Kind          | Example match                             | Notes                                 |
| --------------- | ------------- | ----------------------------------------- | ------------------------------------- |
| **Time**        | `time`        | `tomorrow at 3pm`, `2024-01-15T10:30:00Z` | Relative, day-of-week, ISO timestamps |
| **Range**       | `range`       | `2020-2024`, `20°C to 30°C`               | Time, year, and temperature ranges    |
| **Temperature** | `temperature` | `72°F`, `20 celsius`                      | Fahrenheit and Celsius                |
| **Quantity**    | `quantity`    | `5 kg`, `100 miles`                       | Units of measurement                  |
| **Location**    | `location`    | `United States`, `Germany`                | Countries (dataset-backed)            |
| **URL**         | `url`         | `https://example.com/path`                | Full URLs with TLD validation         |
| **Email**       | `email`       | `user@example.com`                        | Standard email addresses              |
| **Institution** | `institution` | `University of Oxford`                    | Known institutions                    |
| **Language**    | `language`    | `English`, `Japanese`                     | Language names (dataset-backed)       |
| **Phone**       | `phone`       | `+14155552671`                            | E.164-ish phone numbers               |
| **IP address**  | `ip_address`  | `192.168.1.1`, `::1`                      | IPv4 + IPv6 full form                 |
| **SSN**         | `ssn`         | `123-45-6789`                             | US Social Security Numbers            |
| **Credit card** | `credit_card` | `4111111111111111`                        | Luhn-validated card numbers           |
| **UUID**        | `uuid`        | `550e8400-e29b-41d4-a716-446655440000`    | RFC 4122 UUIDs                        |
| **API key**     | `api_key`     | `sk-abc123...`, `AKIA...`                 | Common provider prefixes              |

## API reference

### `Duckling()`

```ts
function Duckling(): { extract; redact };
function Duckling<T>(parsers: ParserTuple<T>): { extract; redact };
```

Creates an extractor/redactor pair. Without arguments, uses all 15 built-in
parsers and returns `AnyEntity[]`. When given an explicit parser array, the
return type narrows to the union of those entity types.

### `.extract(text)`

```ts
extract(text: string): Entity[]
```

Scans `text` and returns all matched entities, each with `kind`, `value`,
`start`, `end`, and `text` fields. Entities are returned in order of appearance.

### `.redact(text, opts?)`

```ts
redact(text: string, opts?: RedactOptions): string
```

Extracts entities then replaces each matched character with `opts.mask` (default
`"█"`). When `opts.kinds` is set, only those entity kinds are masked.
Overlapping spans are handled correctly.

### `PIIParsers`

```ts
const PIIParsers: [
  EmailParser,
  PhoneParser,
  IPAddressParser,
  SSNParser,
  CreditCardParser,
  UUIDParser,
  ApiKeyParser,
];
```

Pre-built parser tuple for PII-sensitive entities. Use with
`Duckling(PIIParsers)` for a quick redaction pipeline.

### `RedactOptions`

```ts
interface RedactOptions<K extends string = string> {
  mask?: string; // default: "█"
  kinds?: K[]; // when omitted, all entities are redacted
}
```

### `AnyEntity`

Union of all 15 built-in entity types. This is the return element type of
`Duckling().extract(...)`.

### `PIIEntity`

Union of the 7 PII entity types:
`EmailEntity | PhoneEntity | IPAddressEntity | SSNEntity | CreditCardEntity | UUIDEntity | ApiKeyEntity`.

## Caveats

ts-duckling uses grammar-based parsers, not ML. This means:

- **Deterministic**: same input → same output, every time
- **Fast**: no model loading, no network calls
- **But imperfect**: expect false positives/negatives for ambiguous inputs

For example:

```ts
// ts-duckling interprets 6/2022 as a date
Duckling([Time.parser]).extract("6/2022 is 0.00296735905");
// → [{ kind: "time", text: "6/2022", ... }]
```

If you need high accuracy on messy, ambiguous real-world text, consider an
ML-based solution. If you want **predictable, fast extraction** from structured
or semi-structured text (messages, forms, logs), ts-duckling is a great fit.

## Playground

Try ts-duckling in the browser:
**[Live Playground](https://claudiuceia.github.io/ts-duckling/)**

Paste or type any text and see entities extracted in real-time. You can also
fetch content from a URL to test against real web pages.

## License

MIT © [Claudiu Ceia](https://github.com/ClaudiuCeia)
