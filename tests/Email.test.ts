import { assertEquals } from "@std/assert";
import { Duckling } from "../mod.ts";

Deno.test("Email in sentence", () => {
  const res = Duckling().extract(
    "I've never emailed no-reply+foo@some.domain.dev before",
  );

  assertEquals(res, [
    {
      end: 47,
      kind: "email",
      start: 19,
      text: "no-reply+foo@some.domain.dev",
      value: {
        email: "no-reply+foo@some.domain.dev",
      },
    },
  ]);
});
