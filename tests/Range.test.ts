import { assertEquals } from "@std/assert";
import { FakeTime } from "@std/testing/time";
import { Duckling } from "../mod.ts";

Deno.test("Time range", () => {
  const time = new FakeTime(new Date("2022-01-01T00:00:00.000Z"));
  try {
    const res = Duckling().extract(
      "I had booked the conference room from the 1st of June until the 5th of June 2022",
    );

    assertEquals(res, [
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
  } finally {
    time.restore();
  }
});

Deno.test("Temperature range", () => {
  const res = Duckling().extract("We expect between 10 and 12 degrees Celsius");

  assertEquals(res, [
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
});

Deno.test("Temperature range with min as temperature", () => {
  const res = Duckling().extract(
    "We expect between 10 degrees Celsius and 12 degrees Celsius",
  );

  const range = res.find((e) => e.kind === "range");
  assertEquals(range?.kind, "range");
  if (range?.kind !== "range") return;
  assertEquals(range.value.min.kind, "temperature");
  assertEquals(range.value.min.text, "10 degrees Celsius");
  assertEquals(range.value.max.kind, "temperature");
  assertEquals(range.value.max.text, "12 degrees Celsius");
});

Deno.test("Year range", () => {
  const res = Duckling().extract(
    "Developed in the period between 2700 and 2300 BCE in Sumer",
  );

  assertEquals(res, [
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
});

Deno.test("Year range with dash", () => {
  const res = Duckling().extract(
    "Sima Qian (145–90 BC), author of the Records of the Grand Historian",
  );

  assertEquals(
    res.some((e) => e.kind === "quantity" && e.text === "145"),
    true,
  );
  assertEquals(
    res.some((e) => e.kind === "time" && e.text === "90 BC"),
    true,
  );
});

Deno.test("Time range with dash", () => {
  const res = Duckling().extract(`
      Herodotus of Halicarnassus (484 BC–c. 425 BC) has
      generally been acclaimed as the "father of history"
    `);

  assertEquals(
    res.some((e) => e.kind === "time" && e.text === "484 BC"),
    true,
  );
  assertEquals(
    res.some((e) => e.kind === "time" && e.text === "c. 425 BC"),
    true,
  );
});
