import { assertEquals } from "@std/assert";
import { Duckling } from "../mod.ts";

Deno.test("URL", () => {
  const res = Duckling().extract(
    "Checkout the preview at https://duckling.deno.dev:8080/",
  );

  assertEquals(res, [
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
});

Deno.test("URL without port", () => {
  const res = Duckling().extract("Visit https://duckling.deno.dev/ now");

  assertEquals(res, [
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
});

Deno.test("URL ftp", () => {
  const res = Duckling().extract("Get it from ftp://example.com/ now");

  assertEquals(res, [
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
});

Deno.test("URL with path + fragment (Wikipedia)", () => {
  const text =
    "See https://en.wikipedia.org/wiki/Master_Juba#England_tour,_1848 for more";
  const res = Duckling().extract(text);

  assertEquals(res[0].kind, "url");
  assertEquals(
    res[0].text,
    "https://en.wikipedia.org/wiki/Master_Juba#England_tour,_1848",
  );
});

Deno.test("URL with percent-encoded path (Wikipedia Arabic)", () => {
  const text =
    "See https://ar.wikipedia.org/wiki/%D8%A7%D9%84%D9%85%D8%B9%D9%84%D9%85_%D8%AC%D9%88%D8%A8%D8%A7";
  const res = Duckling().extract(text);

  assertEquals(res[0].kind, "url");
  assertEquals(
    res[0].text,
    "https://ar.wikipedia.org/wiki/%D8%A7%D9%84%D9%85%D8%B9%D9%84%D9%85_%D8%AC%D9%88%D8%A8%D8%A7",
  );
});

Deno.test("URL with query params (Wikipedia create account)", () => {
  const text =
    "https://en.wikipedia.org/w/index.php?title=Special:CreateAccount&returnto=Master+Juba";
  const res = Duckling().extract(text);

  assertEquals(res[0].kind, "url");
  assertEquals(
    res[0].text,
    "https://en.wikipedia.org/w/index.php?title=Special:CreateAccount&returnto=Master+Juba",
  );
});

Deno.test("URL bare domain", () => {
  const res = Duckling().extract("Visit google.com for more");

  assertEquals(res, [
    {
      start: 6,
      end: 16,
      kind: "url",
      text: "google.com",
      value: { url: "google.com" },
    },
  ]);
});

Deno.test("URL bare domain with subdomain", () => {
  const res = Duckling().extract("Check docs.example.org please");

  assertEquals(res, [
    {
      start: 6,
      end: 22,
      kind: "url",
      text: "docs.example.org",
      value: { url: "docs.example.org" },
    },
  ]);
});

Deno.test("URL bare domain with path", () => {
  const res = Duckling().extract("See example.com/about for info");

  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "example.com/about");
  assertEquals(res[0].value, { url: "example.com/about" });
});

Deno.test("URL bare domain with port", () => {
  const res = Duckling().extract("Running at localhost.com:3000 now");

  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "localhost.com:3000");
  assertEquals(res[0].value, { url: "localhost.com:3000" });
});

Deno.test("URL prefers full URL over bare domain", () => {
  const res = Duckling().extract("Go to https://example.com/path please");

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "https://example.com/path");
  assertEquals(res[0].value, { url: "https://example.com/path" });
});
