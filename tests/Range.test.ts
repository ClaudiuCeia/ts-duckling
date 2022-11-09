import { assertEquals } from "https://deno.land/std@0.149.0/testing/asserts.ts";
import { Duckling } from "../mod.ts";

Deno.test("Time range", () => {
  const res = Duckling().extract({
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
            end: 53,
            kind: "time",
            start: 42,
            text: "1st of June",
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
  const res = Duckling().extract({
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
                end: 27,
                kind: "quantity",
                start: 25,
                text: "12",
                value: {
                  amount: 12,
                },
              },
              unit: "Celsius",
            },
          },
          min: {
            end: 20,
            kind: "temperature",
            start: 18,
            text: "10",
            value: {
              amount: {
                end: 20,
                kind: "quantity",
                start: 18,
                text: "10",
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
  const res = Duckling().extract({
    text: `Developed in the period between 2700 and 2300 BCE in Sumer`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 49,
        kind: "range",
        start: 24,
        text: "between 2700 and 2300 BCE",
        value: {
          max: {
            end: 49,
            kind: "time",
            start: 41,
            text: "2300 BCE",
            value: {
              era: "BCE",
              grain: "era",
              when: "2300 BCE",
            },
          },
          min: {
            end: 36,
            kind: "time",
            start: 32,
            text: "2700",
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

Deno.test("Year range with dash", () => {
  const res = Duckling().extract({
    text: `Sima Qian (145–90 BC), author of the Records of the Grand Historian`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 14,
        kind: "quantity",
        start: 11,
        text: "145",
        value: {
          amount: 145,
        },
      },
      {
        end: 20,
        kind: "time",
        start: 15,
        text: "90 BC",
        value: {
          era: "BCE",
          grain: "era",
          when: "90 BC",
        },
      },
    ]);
  }
});

Deno.test("Time range with dash", () => {
  const res = Duckling().extract({
    text: `
      Herodotus of Halicarnassus (484 BC–c. 425 BC) has
      generally been acclaimed as the "father of history"
    `,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 41,
        kind: "time",
        start: 35,
        text: "484 BC",
        value: {
          era: "BCE",
          grain: "era",
          when: "484 BC",
        },
      },
      {
        end: 51,
        kind: "time",
        start: 42,
        text: "c. 425 BC",
        value: {
          era: "BCE",
          grain: "era",
          when: "425 BC",
        },
      },
    ]);
  }
});
