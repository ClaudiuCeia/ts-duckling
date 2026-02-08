import { assertEquals } from "@std/assert";
import { Duckling } from "../mod.ts";

Deno.test("Email in sentence", () => {
  const res = Duckling().extract({
    text: `I've never emailed no-reply+foo@some.domain.dev before`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
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
  }
});
