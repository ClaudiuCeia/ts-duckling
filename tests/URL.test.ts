import { assertEquals } from "@std/assert";
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

Deno.test("URL without port", () => {
  const res = Duckling().extract({
    text: "Visit https://duckling.deno.dev/ now",
    index: 0,
  });

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, [
      {
        start: 6,
        end: 31,
        kind: "url",
        text: "https://duckling.deno.dev",
        value: {
          url: "https://duckling.deno.dev",
        },
      },
    ]);
  }
});

Deno.test("URL ftp", () => {
  const res = Duckling().extract({
    text: "Get it from ftp://example.com/ now",
    index: 0,
  });

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, [
      {
        start: 12,
        end: 29,
        kind: "url",
        text: "ftp://example.com",
        value: {
          url: "ftp://example.com",
        },
      },
    ]);
  }
});
