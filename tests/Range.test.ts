import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { Duckling } from "../mod.ts";

Deno.test("Time range", () => {
  const res = Duckling.extract({
    text: `I had booked the conference room from the 1st of June until the 5th of June 2022`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 80,
        kind: "range",
        start: 33,
        text: "from the 1st of June until the 5th of June 2022",
        value: {
          max: {
            end: 80,
            kind: "time",
            start: 64,
            text: "5th of June 2022",
            value: {
              era: "CE",
              grain: "day",
              when: "2022-06-04T21:00:00.000Z",
            },
          },
          min: {
            end: 54,
            kind: "time",
            start: 42,
            text: "1st of June ",
            value: {
              era: "CE",
              grain: "day",
              when: "2022-05-31T21:00:00.000Z",
            },
          },
        },
      },
    ]);
  }
});

Deno.test("Temperature range", () => {
  const res = Duckling.extract({
    text: `We expect between 10 and 12 degrees Celsius`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 43,
        kind: "range",
        start: 10,
        text: "between 10 and 12 degrees Celsius",
        value: {
          max: {
            end: 43,
            kind: "temperature",
            start: 25,
            text: "12 degrees Celsius",
            value: {
              amount: {
                end: 28,
                kind: "quantity",
                start: 25,
                text: "12 ",
                value: {
                  amount: 12,
                },
              },
              unit: "Celsius",
            },
          },
          min: {
            end: 21,
            kind: "temperature",
            start: 18,
            text: "10 ",
            value: {
              amount: {
                end: 21,
                kind: "quantity",
                start: 18,
                text: "10 ",
                value: {
                  amount: 10,
                },
              },
              unit: "Celsius",
            },
          },
        },
      },
    ]);
  }
});

Deno.test("Year range", () => {
  const res = Duckling.extract({
    text: `Developed in the period between 2700 and 2300 BCE in Sumer`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 50,
        kind: "range",
        start: 24,
        text: "between 2700 and 2300 BCE ",
        value: {
          max: {
            end: 50,
            kind: "time",
            start: 41,
            text: "2300 BCE ",
            value: {
              era: "BCE",
              grain: "era",
              when: "2300 BCE",
            },
          },
          min: {
            end: 37,
            kind: "time",
            start: 32,
            text: "2700 ",
            value: {
              era: "BCE",
              grain: "era",
              when: "2700 BCE",
            },
          },
        },
      },
    ]);
  }
});
