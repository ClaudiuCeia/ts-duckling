<p align="center">
  <img
    src="https://raw.githubusercontent.com/ClaudiuCeia/ts-duckling/main/logo.png"
    width="200"
    alt="ts-duckling logo"
  />
</p>

# ts-duckling

[![CI](https://github.com/ClaudiuCeia/ts-duckling/actions/workflows/ci.yml/badge.svg)](https://github.com/ClaudiuCeia/ts-duckling/actions/workflows/ci.yml)
[![JSR](https://jsr.io/badges/@claudiu-ceia/ts-duckling)](https://jsr.io/@claudiu-ceia/ts-duckling)
[![License](https://img.shields.io/github/license/ClaudiuCeia/ts-duckling)](./LICENSE)
[![Playground](https://img.shields.io/badge/playground-GitHub%20Pages-3b82f6)](https://claudiuceia.github.io/ts-duckling/)

A tiny, deterministic entity extractor for TypeScript/Deno, inspired by
[duckling](https://github.com/facebook/duckling). This version uses parser
combinator grammars (no ML).

Online playground: https://claudiuceia.github.io/ts-duckling/

## Install (Deno / JSR)

```ts
import { Duckling } from "jsr:@claudiu-ceia/ts-duckling@^0.0.14";
```

## Quickstart

```ts
import {
  Duckling,
  Email,
  Time,
  URL,
} from "jsr:@claudiu-ceia/ts-duckling@^0.0.14";

const text =
  "Email me at foo@example.com and visit https://example.com tomorrow.";
const entities = Duckling([Email.parser, URL.parser, Time.parser]).extract(
  text,
);
console.log(entities);
```

## Supported Entities

- Time (relative, day-of-week, common dates, ISO `...Z` timestamps)
- Range (time ranges, year ranges, temperature ranges)
- Temperature
- Quantity
- Location (countries, dataset-backed)
- URL
- Email
- Institution
- Language (dataset-backed)
- Phone (E.164-ish)
- IP address (IPv4 + deterministic IPv6 full form)
- SSN (US)
- Credit card (Luhn)
- UUID
- API keys (best-effort detection for common provider prefixes)

## When would I use this?

If you have a Deno TypeScript codebase, and you want to extract entities from
relatively small data samples (ie: blog posts, comments, messages, etc.), this
will probably work for you. Even more so if the format of the data is relatively
stable.

However, you can expect false positives as well as false negatives in some
scenarios since `ts-duckling` doesn't understand the context surrounding the
entities:

```ts
// ts-duckling falsely assumes that 6/2022 is a date
const entities2 = Duckling([Time.parser]).extract("6/2022 is 0.00296735905");
console.log(entities2);
```

## Adding New Entity Types

Define a parser that returns an `Entity`, then pass its `.parser` to `Duckling`.

```ts
import {
  createLanguage,
  map,
  type Parser,
  regex,
} from "jsr:@claudiu-ceia/combine@^0.2.8";
import {
  type AnyEntity,
  Duckling,
  ent,
  type Entity,
} from "jsr:@claudiu-ceia/ts-duckling@^0.0.14";

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

type MyEntity = AnyEntity | HashtagEntity;
const entities3 = Duckling<MyEntity>([Hashtag.parser]).extract(
  "hello #duckling",
);
console.log(entities3);
```

# License

MIT © [Claudiu Ceia](https://github.com/ClaudiuCeia)
