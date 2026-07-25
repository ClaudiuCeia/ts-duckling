import { assertEquals } from "@std/assert";
import { Duckling, Temperature } from "../mod.ts";

Deno.test("fahrneheit", () => {
  const res = Duckling().extract("It's hot! Over 90F outside...");

  assertEquals(res, [
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
});

Deno.test("celsius", () => {
  const res = Duckling().extract("It's hot! Over 40°C outside...");

  assertEquals(
    res.some((e) => e.kind === "temperature" && e.text === "40°C"),
    true,
  );
});

Deno.test("unspecified", () => {
  const res = Duckling().extract(
    "Not sure how it is! Over 14 degrees outside...",
  );

  assertEquals(
    res.some((e) => e.kind === "temperature" && e.text === "14 degrees"),
    true,
  );
});

Deno.test("below zero", () => {
  const res = Duckling().extract("I'm freezing, 21 celsius below zero here");

  assertEquals(
    res.some((e) =>
      e.kind === "temperature" && e.text === "21 celsius below zero"
    ),
    true,
  );
});

Deno.test("below zero no unit does not parse temperature", () => {
  // NOTE: current grammar requires an extra space when unit is omitted
  // (one space is consumed by optional(space()), and another by skip1(space())).
  const res = Duckling().extract("I'm freezing, 21  below zero here");

  const temp = res.find((e) => e.kind === "temperature");
  assertEquals(temp, undefined);
});

Deno.test("No false positive for temperature", () => {
  const res = Duckling().extract(
    "In 1837 Charles Babbage first described his Analytical Engine",
  );

  assertEquals(res, [
    {
      end: 7,
      kind: "quantity",
      start: 3,
      text: "1837",
      value: {
        amount: 1837,
      },
    },
  ]);
});

Deno.test("enumeration inherits Celsius from the final item", () => {
  const res = Duckling([Temperature.parser]).extract(
    "temperatures of 20, 25 and 30 Celsius",
  );

  assertEquals(res, [
    {
      end: 18,
      kind: "temperature",
      start: 16,
      text: "20",
      value: {
        amount: {
          end: 18,
          kind: "quantity",
          start: 16,
          text: "20",
          value: { amount: 20 },
        },
        unit: "Celsius",
      },
    },
    {
      end: 22,
      kind: "temperature",
      start: 20,
      text: "25",
      value: {
        amount: {
          end: 22,
          kind: "quantity",
          start: 20,
          text: "25",
          value: { amount: 25 },
        },
        unit: "Celsius",
      },
    },
    {
      end: 37,
      kind: "temperature",
      start: 27,
      text: "30 Celsius",
      value: {
        amount: {
          end: 29,
          kind: "quantity",
          start: 27,
          text: "30",
          value: { amount: 30 },
        },
        unit: "Celsius",
      },
    },
  ]);
});

Deno.test("temperature enumerations support conjunctions and numeric forms", () => {
  const fahrenheit = Duckling([Temperature.parser]).extract("20 or 30 F");
  assertEquals(
    fahrenheit.map((
      entity,
    ) => [entity.value.amount.value.amount, entity.value.unit]),
    [[20, "Fahrenheit"], [30, "Fahrenheit"]],
  );

  const celsius = Duckling([Temperature.parser]).extract(
    "-5.5, 0, and 2.5 °C",
  );
  assertEquals(
    celsius.map((
      entity,
    ) => [entity.value.amount.value.amount, entity.value.unit]),
    [[-5.5, "Celsius"], [0, "Celsius"], [2.5, "Celsius"]],
  );
});

Deno.test("temperature enumerations require a bounded explicit unit", () => {
  assertEquals(
    Duckling([Temperature.parser]).extract("scores of 20, 25 and 30 points"),
    [],
  );
  assertEquals(
    Duckling([Temperature.parser]).extract("20, 25 and 30 Celsiusian"),
    [],
  );
});

Deno.test("CLDR temperature names support singular degree forms", () => {
  const cases: [string, string][] = [
    ["1 degree Celsius", "Celsius"],
    ["1 degree Fahrenheit", "Fahrenheit"],
    ["2 degrees Celsius", "Celsius"],
    ["2 degrees Fahrenheit", "Fahrenheit"],
  ];
  for (const [text, unit] of cases) {
    const result = Duckling([Temperature.parser]).extract(text);
    assertEquals(result.length, 1, text);
    assertEquals(result[0].text, text);
    assertEquals(result[0].value.unit, unit);
  }
});

Deno.test("bare singular degree is not an unspecified temperature", () => {
  for (
    const text of [
      "The angle is 1 degree",
      "She earned a 1 degree qualification",
    ]
  ) {
    assertEquals(Duckling([Temperature.parser]).extract(text), [], text);
  }
});

Deno.test("CLDR degree symbol and compatibility unit aliases remain accepted", () => {
  const cases: [string, string][] = [
    ["10°C", "Celsius"],
    ["10°F", "Fahrenheit"],
    ["10 C", "Celsius"],
    ["10 F", "Fahrenheit"],
    ["10 celsius", "Celsius"],
    ["10 fahrenheit", "Fahrenheit"],
    ["10 degrees", "N/A"],
  ];
  for (const [text, unit] of cases) {
    const result = Duckling([Temperature.parser]).extract(text);
    assertEquals(result.length, 1, text);
    assertEquals(result[0].text, text);
    assertEquals(result[0].value.unit, unit);
  }
});
