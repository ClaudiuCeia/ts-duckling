import { assertEquals } from "@std/assert";
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
    assertEquals(
      res.value.some((e) => e.kind === "temperature" && e.text === "40°C"),
      true,
    );
  }
});

Deno.test("unspecified", () => {
  const res = Duckling().extract({
    text: `Not sure how it is! Over 14 degrees outside...`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(
      res.value.some((e) =>
        e.kind === "temperature" && e.text === "14 degrees"
      ),
      true,
    );
  }
});

Deno.test("below zero", () => {
  const res = Duckling().extract({
    text: `I'm freezing, 21 celsius below zero here`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(
      res.value.some((e) =>
        e.kind === "temperature" && e.text === "21 celsius below zero"
      ),
      true,
    );
  }
});

Deno.test("below zero no unit does not parse temperature", () => {
  const res = Duckling().extract({
    // NOTE: current grammar requires an extra space when unit is omitted
    // (one space is consumed by optional(space()), and another by skip1(space())).
    text: `I'm freezing, 21  below zero here`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    const temp = res.value.find((e) =>
      typeof e !== "string" && e.kind === "temperature"
    );
    assertEquals(temp, undefined);
  }
});

Deno.test("No false positive for temperature", () => {
  const res = Duckling().extract({
    text: `In 1837 Charles Babbage first described his Analytical Engine`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
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
  }
});
