import { assertEquals } from "@std/assert";
import { Duckling, Phone } from "../mod.ts";

Deno.test("Phone (E.164)", () => {
  const res = Duckling([Phone.parser]).extract({
    text: "Call +14155552671 now",
    index: 0,
  });

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, [
      {
        start: 5,
        end: 17,
        kind: "phone",
        text: "+14155552671",
        value: {
          phone: "+14155552671",
        },
      },
    ]);
  }
});

Deno.test("Phone preferred over quantity in Duckling()", () => {
  const res = Duckling().extract({
    text: "Call +14155552671 now",
    index: 0,
  });

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, [
      {
        start: 5,
        end: 17,
        kind: "phone",
        text: "+14155552671",
        value: {
          phone: "+14155552671",
        },
      },
    ]);
  }
});
