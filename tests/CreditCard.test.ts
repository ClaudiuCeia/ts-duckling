import { assertEquals } from "@std/assert";
import { CreditCard, Duckling } from "../mod.ts";

Deno.test("Credit card (Luhn)", () => {
  const res = Duckling([CreditCard.parser]).extract({
    text: "use 4242 4242 4242 4242 for testing",
    index: 0,
  });

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, [
      {
        start: 4,
        end: 23,
        kind: "credit_card",
        text: "4242 4242 4242 4242",
        value: {
          digits: "4242424242424242",
        },
      },
    ]);
  }
});

Deno.test("Credit card invalid does not parse", () => {
  const res = Duckling([CreditCard.parser]).extract({
    text: "use 4242 4242 4242 4243 for testing",
    index: 0,
  });

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, []);
  }
});
