import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { Duckling } from "../mod.ts";

Deno.test("Quantity", () => {
  const res = Duckling.extract({
    text: `How many did you get? more than 3 or less than 171176?`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 34,
        kind: "quantity",
        start: 32,
        text: "3 ",
        value: {
          amount: 3,
        },
      },
      {
        end: 54,
        kind: "quantity",
        start: 37,
        text: "less than 171176?",
        value: {
          amount: -171176,
        },
      },
    ]);
  }
});