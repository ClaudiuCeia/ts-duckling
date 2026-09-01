import { assertEquals } from "@std/assert";
import { Duckling, URL } from "../mod.ts";

Deno.test("URL", () => {
  const res = Duckling().extract(
    "Checkout the preview at https://duckling.deno.dev:8080/",
  );

  assertEquals(res, [
    {
      end: 55,
      kind: "url",
      start: 24,
      text: "https://duckling.deno.dev:8080/",
      value: {
        url: "https://duckling.deno.dev:8080/",
      },
    },
  ]);
});

Deno.test("URL without port", () => {
  const res = Duckling().extract("Visit https://duckling.deno.dev/ now");

  assertEquals(res, [
    {
      start: 6,
      end: 32,
      kind: "url",
      text: "https://duckling.deno.dev/",
      value: {
        url: "https://duckling.deno.dev/",
      },
    },
  ]);
});

Deno.test("URL ftp", () => {
  const res = Duckling().extract("Get it from ftp://example.com/ now");

  assertEquals(res, [
    {
      start: 12,
      end: 30,
      kind: "url",
      text: "ftp://example.com/",
      value: {
        url: "ftp://example.com/",
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
  const res = Duckling().extract(
    "Check docs.example.org and my-site.example.com please",
  );

  assertEquals(res.map(({ text }) => text), [
    "docs.example.org",
    "my-site.example.com",
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

Deno.test("URL accepts active TLDs added since the old snapshot", () => {
  const res = Duckling().extract("radio.music");

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "radio.music");
  assertEquals(res[0].value, { url: "radio.music" });
});

Deno.test("URL rejects retired and non-root TLDs as bare domains", () => {
  assertEquals(Duckling().extract("example.active"), []);
  assertEquals(Duckling().extract("example.an"), []);
});

Deno.test("URL accepts IDN TLDs in Punycode and Unicode", () => {
  const res = Duckling().extract("Visit example.xn--p1ai or example.рф");

  assertEquals(res.map(({ text }) => text), [
    "example.xn--p1ai",
    "example.рф",
  ]);
});

Deno.test("URL prefers the longest overlapping TLD", () => {
  const res = Duckling([URL.parser]).extract("service.community");

  assertEquals(res.map(({ text }) => text), ["service.community"]);
});

Deno.test("URL matches case-insensitive TLDs in bare domains", () => {
  const res = Duckling([URL.parser]).extract("service.COM service.COMMUNITY");
  assertEquals(res.map(({ text }) => text), [
    "service.COM",
    "service.COMMUNITY",
  ]);
});

Deno.test("URL full URL with localhost", () => {
  const res = Duckling().extract("http://localhost:3000/ is ready");
  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "http://localhost:3000/");
  assertEquals(res[0].value, { url: "http://localhost:3000/" });
});

Deno.test("URL full URL with IPv4 literal", () => {
  const res = Duckling().extract("Connect to https://127.0.0.1:8443/a for API");
  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "https://127.0.0.1:8443/a");
  assertEquals(res[0].value, { url: "https://127.0.0.1:8443/a" });
});

Deno.test("URL full URL with bracketed IPv6", () => {
  const res = Duckling().extract("Try https://[2001:db8::1]/x endpoint");
  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "https://[2001:db8::1]/x");
  assertEquals(res[0].value, { url: "https://[2001:db8::1]/x" });
});

Deno.test("URL accepts uppercase TLD and hyphens in full URL", () => {
  const res = Duckling().extract("Visit https://my-site.EXAMPLE.COM/ now");
  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "https://my-site.EXAMPLE.COM/");
  assertEquals(res[0].value, { url: "https://my-site.EXAMPLE.COM/" });
});

Deno.test("URL accepts Unicode label in full URL", () => {
  const res = Duckling().extract("See https://münchen.de/ page");
  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "https://münchen.de/");
  assertEquals(res[0].value, { url: "https://münchen.de/" });
});

Deno.test("URL accepts Punycode label in full URL", () => {
  const res = Duckling().extract("See https://xn--mnchen-3ya.de/ info");
  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "https://xn--mnchen-3ya.de/");
  assertEquals(res[0].value, { url: "https://xn--mnchen-3ya.de/" });
});

Deno.test("URL validates protocol-qualified hosts", () => {
  for (
    const host of [
      "localhost",
      "127.0.0.1",
      "[2001:db8::1]",
      "cafe\u0301.example",
    ]
  ) {
    const result = URL.FullHost({ text: host, index: 0 });
    assertEquals(result.success, true, host);
    if (result.success) assertEquals(result.ctx.index, host.length, host);
  }

  for (
    const host of [
      "[garbage]",
      "[]",
      "999.999.999.999",
      "-example.com",
      "example-.com",
      "example..com",
      "example_com",
      `[${"1".repeat(1000)}]`,
    ]
  ) {
    assertEquals(URL.FullHost({ text: host, index: 0 }).success, false, host);
  }
});

Deno.test("URL bounds DNS label and host lengths", () => {
  const label63 = "a".repeat(63);
  const label64 = "a".repeat(64);
  const host253 = [label63, label63, label63, "a".repeat(61)].join(".");
  const host254 = `${host253}a`;

  for (const host of [label63, host253]) {
    const result = URL.FullHost({ text: host, index: 0 });
    assertEquals(result.success, true, host.length.toString());
    if (result.success) assertEquals(result.ctx.index, host.length);
  }
  for (const host of [label64, host254]) {
    assertEquals(
      URL.FullHost({ text: host, index: 0 }).success,
      false,
      host.length.toString(),
    );
  }

  const bare253 = [label63, label63, label63, "a".repeat(57), "com"].join(
    ".",
  );
  const bare254 = bare253.replace(
    `${"a".repeat(57)}.com`,
    `${"a".repeat(58)}.com`,
  );
  assertEquals(URL.Domain({ text: bare253, index: 0 }).success, true);
  assertEquals(URL.Domain({ text: bare254, index: 0 }).success, false);
});

Deno.test("URL trims trailing unmatched closing punctuation from suffix", () => {
  const res = Duckling().extract("See https://example.com/a).");
  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "https://example.com/a");
  assertEquals(res[0].value, { url: "https://example.com/a" });
});

Deno.test("URL trims unmatched quotes and preserves balanced brackets", () => {
  const res = Duckling([URL.parser]).extract(
    'See "https://example.com/a" and https://example.com/(a), then https://example.com...',
  );
  assertEquals(res.map(({ text }) => text), [
    "https://example.com/a",
    "https://example.com/(a)",
    "https://example.com",
  ]);
});

Deno.test("URL accepts a lone trailing slash but not empty query or fragment", () => {
  assertEquals(
    Duckling([URL.parser]).extract("https://example.com/").map(({ text }) =>
      text
    ),
    ["https://example.com/"],
  );
  assertEquals(URL.Suffix({ text: "/", index: 0 }).success, true);
  assertEquals(URL.Suffix({ text: "?", index: 0 }).success, false);
  assertEquals(URL.Suffix({ text: "#", index: 0 }).success, false);
});

Deno.test("URL rejects decimal port :1.5", () => {
  const res = Duckling().extract("http://example.com:1.5");
  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "http://example.com");
  assertEquals(res[0].value, { url: "http://example.com" });
});

Deno.test("URL rejects out-of-range port :65536", () => {
  const res = Duckling().extract("http://example.com:65536 end");
  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "http://example.com");
  assertEquals(res[0].value, { url: "http://example.com" });
});

Deno.test("URL validates integer port boundaries", () => {
  for (const port of ["1", "65535"]) {
    const result = URL.Port({ text: port, index: 0 });
    assertEquals(result.success, true, port);
    if (result.success) assertEquals(result.ctx.index, port.length, port);
  }
  for (const port of ["0", "65536", "1.5", "abc", "9".repeat(1000)]) {
    assertEquals(URL.Port({ text: port, index: 0 }).success, false, port);
  }
});
