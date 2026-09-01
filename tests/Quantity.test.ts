import { test } from "bun:test";
import { assertEquals } from "./assert.ts";
import { Duckling, Quantity } from "../mod.ts";

test("Quantity", () => {
  const res = Duckling().extract(
    "How many did you get? more than 3 or less than 171176?",
  );

  assertEquals(res, [
    {
      end: 33,
      kind: "quantity",
      start: 32,
      text: "3",
      value: {
        amount: 3,
      },
    },
    {
      end: 53,
      kind: "quantity",
      start: 37,
      text: "less than 171176",
      value: {
        amount: -171176,
      },
    },
  ]);
});

test("CommaSeparated", () => {
  const res = Duckling().extract(
    "Among the cities with a population over 100,000 people",
  );

  assertEquals(res, [
    {
      end: 47,
      kind: "quantity",
      start: 40,
      text: "100,000",
      value: {
        amount: 100000,
      },
    },
  ]);
});

test("FractionalComma", () => {
  const res = Duckling().extract("There are at least 100,000.24 things");

  assertEquals(res, [
    {
      end: 29,
      kind: "quantity",
      start: 19,
      text: "100,000.24",
      value: {
        amount: 100000.24,
      },
    },
  ]);
});

test("Literal quantity", () => {
  const res = Quantity.innerParser({
    text: `10 million`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, {
      end: 10,
      kind: "quantity",
      start: 0,
      text: "10 million",
      value: {
        amount: 10000000,
      },
    });
  }
});

test("Literal quantity no false positive", () => {
  const res = Duckling().extract("10 BCE");

  assertEquals(
    res.some((e) => e.kind === "time" && e.text === "10 BCE"),
    true,
  );
});

test("Just literal", () => {
  const res = Duckling().extract("I have a thousand questions");

  assertEquals(res, [
    {
      end: 17,
      kind: "quantity",
      start: 9,
      text: "thousand",
      value: {
        amount: 1000,
      },
    },
  ]);
});

test("Short literal", () => {
  const res = Duckling().extract("I have a 1K questions");

  assertEquals(res, [
    {
      end: 11,
      kind: "quantity",
      start: 9,
      text: "1K",
      value: {
        amount: 1000,
      },
    },
  ]);
});

test("CLDR compact multipliers cover every long and short tier", () => {
  const cases: [string, number][] = [
    ["1 thousand", 1e3],
    ["2 million", 2e6],
    ["3 billion", 3e9],
    ["4 trillion", 4e12],
    ["1K", 1e3],
    ["2M", 2e6],
    ["3B", 3e9],
    ["4T", 4e12],
  ];
  for (const [text, amount] of cases) {
    const result = Quantity.innerParser({ text, index: 0 });
    assertEquals(result.success, true, text);
    if (result.success) assertEquals(result.value.value.amount, amount, text);
  }
});

test("CLDR numeric symbols and plus-minus compatibility are preserved", () => {
  const cases: [string, number][] = [
    ["1,234.5", 1234.5],
    ["+12", 12],
    ["-12", -12],
    ["±12", 12],
  ];
  for (const [text, amount] of cases) {
    const result = Quantity.innerParser({ text, index: 0 });
    assertEquals(result.success, true, text);
    if (result.success) assertEquals(result.value.value.amount, amount, text);
  }
});

test("legacy quantity multiplier spellings remain compatible", () => {
  const cases: [string, number][] = [
    ["hundred", 1e2],
    ["hundreds", 1e2],
    ["thousands", 1e3],
    ["millions", 1e6],
    ["billions", 1e9],
    ["trillions", 1e12],
    ["1k", 1e3],
  ];
  for (const [text, amount] of cases) {
    const result = Quantity.innerParser({ text, index: 0 });
    assertEquals(result.success, true, text);
    if (result.success) assertEquals(result.value.value.amount, amount, text);
  }

  for (const text of ["1m", "1b", "1t"]) {
    const lowercase = Quantity.innerParser({ text, index: 0 });
    assertEquals(lowercase.success, true, text);
    if (lowercase.success) {
      assertEquals(lowercase.value.value.amount, 1, text);
      assertEquals(lowercase.ctx.index, 1, text);
    }
  }
});
