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

Deno.test("URL with path + fragment (Wikipedia)", () => {
  const text =
    "See https://en.wikipedia.org/wiki/Master_Juba#England_tour,_1848 for more";
  const res = Duckling().extract({ text, index: 0 });

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value[0].kind, "url");
    assertEquals(
      res.value[0].text,
      "https://en.wikipedia.org/wiki/Master_Juba#England_tour,_1848",
    );
  }
});

Deno.test("URL with percent-encoded path (Wikipedia Arabic)", () => {
  const text =
    "See https://ar.wikipedia.org/wiki/%D8%A7%D9%84%D9%85%D8%B9%D9%84%D9%85_%D8%AC%D9%88%D8%A8%D8%A7";
  const res = Duckling().extract({ text, index: 0 });

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value[0].kind, "url");
    assertEquals(
      res.value[0].text,
      "https://ar.wikipedia.org/wiki/%D8%A7%D9%84%D9%85%D8%B9%D9%84%D9%85_%D8%AC%D9%88%D8%A8%D8%A7",
    );
  }
});

Deno.test("URL with query params (Wikipedia create account)", () => {
  const text =
    "https://en.wikipedia.org/w/index.php?title=Special:CreateAccount&returnto=Master+Juba";
  const res = Duckling().extract({ text, index: 0 });

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value[0].kind, "url");
    assertEquals(
      res.value[0].text,
      "https://en.wikipedia.org/w/index.php?title=Special:CreateAccount&returnto=Master+Juba",
    );
  }
});
