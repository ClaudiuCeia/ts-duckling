import { assertEquals } from "@std/assert";
import { Duckling, SSN } from "../mod.ts";

Deno.test("SSN", () => {
  const res = Duckling([SSN.parser]).extract({
    text: "My SSN is 123-45-6789.",
    index: 0,
  });

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, [
      {
        start: 10,
        end: 21,
        kind: "ssn",
        text: "123-45-6789",
        value: {
          ssn: "123-45-6789",
        },
      },
    ]);
  }
});

Deno.test("SSN invalid does not parse", () => {
  const res = Duckling([SSN.parser]).extract({
    text: "no ssn 000-12-1234 here",
    index: 0,
  });

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, []);
  }
});
