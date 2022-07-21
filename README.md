<center><img src="https://github.com/ClaudiuCeia/ts-duckling/blob/main/logo.png" width="160"/></center>

# ts-duckling

A Typescript library for Deno that parses text into structured data. Inspired by
[duckling](https://github.com/facebook/duckling) but using a more naive approach
with parser combinators.

What this means in practice is that while the library is easy to extend and is
relatively light, it will perform badly on larger data sets and it will be much
more error prone since the rules for entities are hard coded.

You can [test this online](https://duckling.deno.dev/) here.

## When would I use this?

If you have a Deno Typescript codebase, and you want to extract entities from
relatively small data samples (ie: blog posts, comments, messages, etc.), this
will probably work for you. Even more so if the format of the data is relatively
stable.

However, you can expect false positives as well as false negatives in some
scenarios since `ts-duckling` doesn't understand the context surrounding the
entities:

```ts
// ts-duckling falsely assumes that 6/2022 is a date
const res = Duckling.extract("6/2022 is 0.00296735905");
/**
   [
      {
        end: 7,
        kind: "time",
        start: 0,
        text: "6/2022 ",
        value: {
          grain: "day",
          when: "2022-01-05T22:00:00.000Z",
        },
      },
      {
        end: 23,
        kind: "quantity",
        start: 10,
        text: "0.00296735905",
        value: {
          amount: 0.296735905,
        },
      },
    ]
*/
```

## Adding new entity types

This will be supported in the release version. You can take a look at how the
current entities are define to get a feel of how this will work. Probably:

```ts
type FizzBuzzLanguage = EntityLanguage<
  {
    fizz: Parser<string>;
    buzz: Parser<string>;
    fizzbuzz: Parser<string>;
  },
  string
>;

entity = createLanguage<FizzBuzzLanguage>({
  fizz: () => fuzzyCase("fizz"),
  buzz: () => fuzzyCase("buzz"),
  fizzbuzz: (s) => mapJoin(seq(s.fizz, s.buzz)),
  parser: (s) => either(s.fizz, s.buzz, s.fizzbuzz),
});

Duckling.add(entity);

Duckling.extract(`
    FizzBuzz is a programming problem where you print fizz for multiples
    of 3, buzz for multiples of 5, and fizzbuzz for multiples of both 3 and 5.
`);
```
