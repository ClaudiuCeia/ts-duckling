import { assertEquals } from "https://deno.land/std@0.149.0/testing/asserts.ts";
import { Duckling } from "../mod.ts";

Deno.test("URL", () => {
  const res = Duckling().extract({
    text: `Checkout the preview at https://duckling.deno.dev:8080/`,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 54,
        kind: "url",
        start: 24,
        text: "https://duckling.deno.dev:8080",
        value: {
          url: "https://duckling.deno.dev:8080",
        },
      },
    ]);
  }
});
