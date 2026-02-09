import { assertEquals } from "@std/assert";
import { Duckling, Quantity, SSN } from "../mod.ts";

Deno.test("SSN", () => {
  const res = Duckling([SSN.parser]).extract("My SSN is 123-45-6789.");

  assertEquals(res, [
    {
      start: 10,
      end: 21,
      kind: "ssn",
      text: "123-45-6789",
      value: {
        ssn: "123-45-6789",
        area: {
          start: 10,
          end: 13,
          kind: "quantity",
          text: "123",
          value: {
            amount: 123,
          },
        },
        group: {
          start: 14,
          end: 16,
          kind: "quantity",
          text: "45",
          value: {
            amount: 45,
          },
        },
        serial: {
          start: 17,
          end: 21,
          kind: "quantity",
          text: "6789",
          value: {
            amount: 6789,
          },
        },
      },
    },
  ]);
});

Deno.test("SSN invalid does not parse", () => {
  const res = Duckling([SSN.parser]).extract("no ssn 000-12-1234 here");

  assertEquals(res, []);
});

Deno.test("SSN wins over Quantity even when Quantity is ordered first", () => {
  const res = Duckling([Quantity.parser, SSN.parser]).extract(
    "My SSN is 123-45-6789.",
  );

  assertEquals(res.some((e) => e.kind === "ssn"), true);
});
