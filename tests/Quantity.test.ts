import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { Duckling } from "../mod.ts";

Deno.test("Quantity", () => {
  const res = Duckling().extract({
    text: `How many did you get? more than 3 or less than 171176?`,
    index: 0,
  });
  
  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
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
  }
});

Deno.test("CommaSeparated", () => {
  const res = Duckling().extract({
    text: `Among the cities with a population over 100,000 people`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
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
  }
});

Deno.test("FractionalComma", () => {
  const res = Duckling().extract({
    text: `There are at least 100,000.24 things`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
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
  }
});
