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

Deno.test("Duckling extracts CC + 4-digit groups (step shortest)", () => {
  const text = "CC 4242 4242 4242 4242";
  const res = Duckling().extract({ text, index: 0 });

  assertEquals(res.success, true);
  if (!res.success) return;

  assertEquals(
    res.value.some((e) =>
      e.kind === "credit_card" && e.text === "4242 4242 4242 4242"
    ),
    true,
  );

  const groups = res.value.filter((e) =>
    e.kind === "quantity" && e.text === "4242"
  );
  assertEquals(groups.length, 4);
  assertEquals(groups.map((e) => [e.start, e.end]), [
    [3, 7],
    [8, 12],
    [13, 17],
    [18, 22],
  ]);
});
