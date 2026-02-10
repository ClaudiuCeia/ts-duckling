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
  <b>Extract</b> structured data, <b>render</b> rich highlights, and <b>redact</b> PII from free-form text — no ML, no network calls.
</p>

<p align="center">
  <a href="https://github.com/ClaudiuCeia/ts-duckling/actions/workflows/ci.yml"><img src="https://github.com/ClaudiuCeia/ts-duckling/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://jsr.io/@claudiu-ceia/ts-duckling"><img src="https://jsr.io/badges/@claudiu-ceia/ts-duckling" alt="JSR"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/ClaudiuCeia/ts-duckling" alt="MIT license"></a>
  <a href="https://claudiuceia.github.io/ts-duckling/"><img src="https://img.shields.io/badge/playground-live%20demo-3b82f6" alt="Playground"></a>
</p>

```ts
import { Duckling, PIIParsers } from "@claudiu-ceia/ts-duckling";

// Extract structured entities from a chat message
const entities = Duckling().extract(
  "Hey! Meet me at Times Square tomorrow at 3pm. My email is alex@company.io",
);
// → [{ kind: "location", text: "Times Square", ... },
//    { kind: "time",     text: "tomorrow at 3pm", ... },
//    { kind: "email",    text: "alex@company.io", ... }]

// Redact PII in one line
Duckling(PIIParsers).redact(
  "Contact alex@company.io, SSN 078-05-1120, or call +14155552671",
);
// → "Contact ██████████████████, SSN ███████████, or call ████████████"
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
- **Self-contained** — no native dependencies, no runtime downloads, no network
  calls
- **Runs everywhere** — Deno, Node.js, and browsers (see the
  [live playground](https://claudiuceia.github.io/ts-duckling/))

## Documentation

- [Installation](#installation)
- [Getting started](#getting-started)
  - [Extract entities](#extract-entities)
  - [Pick specific parsers](#pick-specific-parsers)
  - [Redact PII](#redact-pii)
  - [Render entities](#render-entities)
  - [Map entities to components](#map-entities-to-components)
  - [Async extraction](#async-extraction)
  - [Custom entities](#custom-entities)
- [Supported entities](#supported-entities)
- [API reference](#api-reference)
  - [`Duckling()`](#duckling-1)
  - [`.extract(text)`](#extracttext)
  - [`.render(text, fn)`](#rendertext-fn)
  - [`.renderMap(text, fn)`](#rendermaptext-fn)
  - [`.redact(text, opts?)`](#redacttext-opts)
  - [`.extractAsync(text, opts?)`](#extractasynctext-opts)
  - [`.renderAsync(text, fn, opts?)`](#renderasynctext-fn-opts)
  - [`.renderMapAsync(text, fn, opts?)`](#rendermapasynctext-fn-opts)
  - [`AsyncScanOptions`](#asyncscanoptions)
  - [`PIIParsers`](#piiparsers)
  - [`RedactOptions`](#redactoptions)
  - [`RenderFn`](#renderfn)
  - [`RenderMapFn`](#rendermapfn)
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

Call `Duckling()` with no arguments to use **all 19 built-in parsers**:

```ts
import { Duckling } from "@claudiu-ceia/ts-duckling";

const msg =
  "Hey! I'll be in Germany next Friday at 5pm. Shoot me a message at alex@company.io or visit https://example.com/invite";

for (const e of Duckling().extract(msg)) {
  console.log(e.kind, e.text);
}
// location  Germany
// time      next Friday at 5pm
// email     alex@company.io
// url       https://example.com/invite
```

Each entity carries structured data:

```ts
// entities[0]
{
  kind: "location",
  value: { location: "Germany" },
  start: 16,
  end: 23,
  text: "Germany"
}
```

### Pick specific parsers

Pass an array of parsers to narrow both **what gets extracted** and **the return
type**:

```ts
import { Duckling, Email, Time, URL } from "@claudiu-ceia/ts-duckling";

const entities = Duckling([Email.parser, URL.parser, Time.parser]).extract(
  "Ping me at alex@company.io or https://meet.com — available tomorrow at 2pm",
);
// entities: (EmailEntity | URLEntity | TimeEntity)[]
```

### Redact PII

Use `.redact()` to replace matched entity spans with a mask character:

```ts
import { Duckling, PIIParsers } from "@claudiu-ceia/ts-duckling";

// Redact all PII (email, phone, IP, SSN, credit card, UUID, API key, IBAN, MAC, JWT)
Duckling(PIIParsers).redact(
  "Patient email: john.doe@clinic.org, SSN 078-05-1120, phone +14155552671",
);
// → "Patient email: ██████████████████████, SSN ███████████, phone ████████████"

// Custom mask character
Duckling(PIIParsers).redact("Call +14155552671", { mask: "X" });
// → "Call XXXXXXXXXXXX"

// Redact only specific kinds
Duckling(PIIParsers).redact(
  "Contact john.doe@clinic.org, SSN 078-05-1120",
  { kinds: ["ssn"] },
);
// → "Contact john.doe@clinic.org, SSN ███████████"
```

### Render entities

Use `.render()` to replace entity spans via a callback — perfect for turning
plain-text messages into HTML with highlighted or linked entities:

```ts
import { Duckling } from "@claudiu-ceia/ts-duckling";

const msg =
  "Hey! Meet at Times Square tomorrow at 3pm, email me at alex@company.io or check https://example.com/rsvp";

const html = Duckling().render(msg, ({ entity, children }) => {
  switch (entity.kind) {
    case "url":
      return `<a href="${children}">${children}</a>`;
    case "email":
      return `<a href="mailto:${children}">${children}</a>`;
    default:
      return `<mark data-kind="${entity.kind}">${children}</mark>`;
  }
});
// → 'Hey! Meet at <mark data-kind="location">Times Square</mark>
//    <mark data-kind="time">tomorrow at 3pm</mark>, email me at
//    <a href="mailto:alex@company.io">alex@company.io</a> or check
//    <a href="https://example.com/rsvp">https://example.com/rsvp</a>'
```

Nested entities (e.g. an SSN containing quantity sub-parts) are rendered
inside-out — inner entities are transformed first, and the parent receives the
result:

```ts
import { Duckling, Quantity, SSN } from "@claudiu-ceia/ts-duckling";

Duckling([Quantity.parser, SSN.parser]).render(
  "SSN 123-45-6789",
  ({ entity, children }) => `<${entity.kind}>${children}</${entity.kind}>`,
);
// → "SSN <ssn><quantity>123</quantity>-<quantity>45</quantity>-<quantity>6789</quantity></ssn>"
```

Return `undefined` to leave a span unchanged — useful for selective rendering:

```ts
import { Duckling } from "@claudiu-ceia/ts-duckling";

// Only make URLs clickable, leave everything else as plain text
Duckling().render(
  "Visit https://example.com — event on next Friday at 5pm in Germany",
  ({ entity, children }) => {
    if (entity.kind === "url") return `<a href="${children}">${children}</a>`;
    return undefined;
  },
);
// → 'Visit <a href="https://example.com">https://example.com</a> — event on next Friday at 5pm in Germany'
```

### Map entities to components

Use `.renderMap()` when you need an **array of segments** instead of a single
string — ideal for React, Preact, Solid, or any framework that renders element
trees:

```tsx
import { Duckling } from "@claudiu-ceia/ts-duckling";

const msg = "Hey! I'm at Times Square, email me at alex@company.io";

const segments = Duckling().renderMap<JSX.Element>(
  msg,
  ({ entity, children }) => (
    <mark key={entity.start} data-kind={entity.kind}>
      {children}
    </mark>
  ),
);
// → ["Hey! I'm at ", <mark data-kind="location">Times Square</mark>,
//    ", email me at ", <mark data-kind="email">alex@company.io</mark>]

// Drop it straight into a component
function HighlightedMessage({ text }: { text: string }) {
  const segments = Duckling().renderMap<JSX.Element>(
    text,
    ({ entity, children }) => {
      switch (entity.kind) {
        case "url":
          return <a href={entity.text}>{children}</a>;
        case "email":
          return <a href={`mailto:${entity.text}`}>{children}</a>;
        case "time":
          return <time>{children}</time>;
        default:
          return <mark data-kind={entity.kind}>{children}</mark>;
      }
    },
  );

  return <p>{segments}</p>;
}
```

Like `.render()`, nested entities are handled automatically — child spans are
mapped first, and the parent callback receives the already-mapped children as
`(string | R)[]`.

### Async extraction

> **Experimental** — these methods are stable enough to use but the API may
> change in a future minor release.

Every method has an async counterpart (`extractAsync`, `renderAsync`,
`renderMapAsync`) that periodically yields to the browser event loop during
scanning. This prevents long inputs from blocking the main thread — no Web
Worker needed:

```ts
import { Duckling } from "@claudiu-ceia/ts-duckling";

const controller = new AbortController();

const entities = await Duckling().extractAsync(longText, {
  signal: controller.signal, // cancel early if needed
  yieldEvery: 256, // yield every N scan positions (default 512)
});
```

Uses
[`scheduler.yield()`](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield)
when available (Chrome 129+, Edge 129+, Firefox 142+), falling back to
`setTimeout(0)`.

`renderMapAsync` is especially useful in UI frameworks — extract and map
entities to React elements without blocking paint:

```tsx
const segments = await Duckling().renderMapAsync<JSX.Element>(
  text,
  ({ entity, children }) => <mark data-kind={entity.kind}>{children}</mark>,
);
// → ["plain text", <mark>...</mark>, " more text"]
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
  "Email alex@company.io with #feedback",
);
// entities: (EmailEntity | HashtagEntity)[]
```

## Supported entities

| Entity          | Kind          | Example matches                                          |
| --------------- | ------------- | -------------------------------------------------------- |
| **Time**        | `time`        | `tomorrow at 3pm`, `next Friday`, `2024-01-15T10:30:00Z` |
| **Range**       | `range`       | `2020-2024`, `20°C to 30°C`, `Monday to Friday`          |
| **Temperature** | `temperature` | `72°F`, `20 celsius`, `-5°C`                             |
| **Quantity**    | `quantity`    | `5 kg`, `100 miles`, `3,500.00`                          |
| **Location**    | `location`    | `United States`, `Germany`, `Japan`                      |
| **URL**         | `url`         | `https://example.com/path?q=1`, `docs.example.org`       |
| **Institution** | `institution` | `University of Oxford`, `New York City Hall`             |
| **Language**    | `language`    | `English`, `Japanese`, `Portuguese`                      |

### PII

Available via `PIIParsers` for targeted redaction with
`Duckling(PIIParsers).redact(…)`.

| Entity          | Kind             | Example matches                                         |
| --------------- | ---------------- | ------------------------------------------------------- |
| **Email**       | `email`          | `user@example.com`, `first.last@company.io`             |
| **Phone**       | `phone`          | `+14155552671`, `+44 20 7123 4567`, `(415) 555-2671`    |
| **IP address**  | `ip`             | `192.168.1.1`, `2001:db8::1`, `::1`                     |
| **SSN**         | `ssn`            | `123-45-6789`                                           |
| **Credit card** | `credit_card`    | `4111 1111 1111 1111`, `5500-0000-0000-0004`            |
| **UUID**        | `uuid`           | `550e8400-e29b-41d4-a716-446655440000`                  |
| **API key**     | `api_key`        | `sk-proj-abc123…`, `ghp_abc123…`, `AKIA…`               |
| **IBAN**        | `iban`           | `GB29NWBK60161331926819`, `DE89 3704 0044 0532 0130 00` |
| **MAC address** | `mac_address`    | `00:1A:2B:3C:4D:5E`, `001A.2B3C.4D5E`                   |
| **JWT**         | `jwt`            | `eyJhbGciOiJIUzI1NiIs…`                                 |
| **Crypto**      | `crypto_address` | `0x742d35Cc…f2bD18`, `bc1qar0srrr…`, `1BvBMSEY…`        |

## API reference

### `Duckling()`

```ts
function Duckling(): {
  extract;
  extractAsync;
  render;
  renderAsync;
  renderMap;
  renderMapAsync;
  redact;
};
function Duckling<T>(parsers: ParserTuple<T>): {
  extract;
  extractAsync;
  render;
  renderAsync;
  renderMap;
  renderMapAsync;
  redact;
};
```

Creates an extractor/renderer/redactor. Without arguments, uses all 19 built-in
parsers and returns `AnyEntity[]`. When given an explicit parser array, the
return type narrows to the union of those entity types.

### `.extract(text)`

```ts
extract(text: string): Entity[]
```

Scans `text` and returns all matched entities, each with `kind`, `value`,
`start`, `end`, and `text` fields. Entities are returned in order of appearance.

### `.render(text, fn)`

```ts
render(text: string, fn: RenderFn<Entity>): string
```

Extracts entities, arranges them into a span tree (wider spans parent narrower
ones), and calls `fn` for each entity node. The callback receives the entity and
the already-rendered text of its children. Return a replacement string, or
`undefined` to leave the span as-is.

### `.renderMap(text, fn)`

```ts
renderMap<R>(text: string, fn: RenderMapFn<Entity, R>): (string | R)[]
```

Like `.render()`, but instead of producing a single string, returns an array of
segments: plain-text strings interleaved with values of type `R` produced by
your callback. This is the API you want for React/JSX — map entities to
elements, and the result is ready to drop into a component's children.

The callback receives `{ entity, children }` where `children` is
`(string | R)[]` — nested entities are already mapped.

### `.redact(text, opts?)`

```ts
redact(text: string, opts?: RedactOptions): string
```

Built on top of `.render()`. Extracts entities then replaces each matched span
with `opts.mask` (default `"█"`). When `opts.kinds` is set, only those entity
kinds are masked. Overlapping/nested spans are resolved via the span tree.

### `.extractAsync(text, opts?)`

> **Experimental** — this method is stable enough to use but may change in a
> future minor release.

```ts
extractAsync(text: string, opts?: AsyncScanOptions): Promise<Entity[]>
```

Async version of `.extract()` that yields to the event loop periodically.
Supports cancellation via `AbortSignal`.

### `.renderAsync(text, fn, opts?)`

> **Experimental** — this method is stable enough to use but may change in a
> future minor release.

```ts
renderAsync(text: string, fn: RenderFn<Entity>, opts?: AsyncScanOptions): Promise<string>
```

Async version of `.render()`.

### `.renderMapAsync(text, fn, opts?)`

> **Experimental** — this method is stable enough to use but may change in a
> future minor release.

```ts
renderMapAsync<R>(text: string, fn: RenderMapFn<Entity, R>, opts?: AsyncScanOptions): Promise<(string | R)[]>
```

Async version of `.renderMap()`.

### `AsyncScanOptions`

```ts
interface AsyncScanOptions {
  signal?: AbortSignal; // cancel the scan
  yieldEvery?: number; // default: 512
}
```

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
  IBANParser,
  MACAddressParser,
  JWTParser,
  CryptoAddressParser,
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

### `RenderFn`

```ts
type RenderFn<E> = (ctx: {
  entity: E;
  children: string;
}) => string | undefined;
```

Callback for `.render()`. Receives the entity and the already-rendered text of
its nested children. Return a replacement string, or `undefined` to leave the
span unchanged.

### `RenderMapFn`

```ts
type RenderMapFn<E, R> = (ctx: {
  entity: E;
  children: (string | R)[];
}) => R;
```

Callback for `.renderMap()`. Receives the entity and its children as an array of
plain-text strings and already-mapped `R` values. Return a value of type `R` to
replace the span.

### `AnyEntity`

Union of all 19 built-in entity types. This is the return element type of
`Duckling().extract(...)`.

### `PIIEntity`

Union of the 11 PII entity types:
`EmailEntity | PhoneEntity | IPAddressEntity | SSNEntity | CreditCardEntity | UUIDEntity | ApiKeyEntity | IBANEntity | MACAddressEntity | JWTEntity | CryptoAddressEntity`.

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
