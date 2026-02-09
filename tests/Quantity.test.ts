import { assertEquals } from "@std/assert";
import { Duckling, Quantity } from "../mod.ts";

Deno.test("Quantity", () => {
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

Deno.test("CommaSeparated", () => {
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

Deno.test("FractionalComma", () => {
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

Deno.test("Literal quantity", () => {
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

Deno.test("Literal quantity no false positive", () => {
  const res = Duckling().extract("10 BCE");

  assertEquals(
    res.some((e) => e.kind === "time" && e.text === "10 BCE"),
    true,
  );
});

Deno.test("Just literal", () => {
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

Deno.test("Short literal", () => {
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
