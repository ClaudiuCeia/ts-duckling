import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { Duckling } from "../mod.ts";

Deno.test("fahrneheit", () => {
  const res = Duckling().extract({
    text: `It's hot! Over 90F outside...`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 18,
        kind: "temperature",
        start: 15,
        text: "90F",
        value: {
          amount: {
            end: 17,
            kind: "quantity",
            start: 15,
            text: "90",
            value: {
              amount: 90,
            },
          },
          unit: "Fahrenheit",
        },
      },
    ]);
  }
});

Deno.test("celsius", () => {
  const res = Duckling().extract({
    text: `It's hot! Over 40°C outside...`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 19,
        kind: "temperature",
        start: 15,
        text: "40°C",
        value: {
          amount: {
            end: 17,
            kind: "quantity",
            start: 15,
            text: "40",
            value: {
              amount: 40,
            },
          },
          unit: "Celsius",
        },
      },
    ]);
  }
});

Deno.test("unspecified", () => {
  const res = Duckling().extract({
    text: `Not sure how it is! Over 14 degrees outside...`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 35,
        kind: "temperature",
        start: 25,
        text: "14 degrees",
        value: {
          amount: {
            end: 27,
            kind: "quantity",
            start: 25,
            text: "14",
            value: {
              amount: 14,
            },
          },
          unit: "N/A",
        },
      },
    ]);
  }
});

Deno.test("below zero", () => {
  const res = Duckling().extract({
    text: `I'm freezing, 21 celsius below zero here`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 35,
        kind: "temperature",
        start: 14,
        text: "21 celsius below zero",
        value: {
          amount: {
            end: 16,
            kind: "quantity",
            start: 14,
            text: "21",
            value: {
              amount: -21,
            },
          },
          unit: "Celsius",
        },
      },
    ]);
  }
});
