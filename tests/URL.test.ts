import { test } from "bun:test";
import { assertEquals } from "./assert.ts";
import { Duckling, URL } from "../mod.ts";

test("URL", () => {
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

test("URL without port", () => {
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

test("URL ftp", () => {
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

test("URL protocol parser preserves source casing", () => {
  for (const protocol of ["HTTP", "HTTPS", "FTP", "FTPS"]) {
    const result = URL.Protocol({ text: protocol, index: 0 });
    assertEquals(result.success, true, protocol);
    if (result.success) assertEquals(result.value, protocol);
  }
});

test("URL with path + fragment (Wikipedia)", () => {
  const text =
    "See https://en.wikipedia.org/wiki/Master_Juba#England_tour,_1848 for more";
  const res = Duckling().extract(text);

  assertEquals(res[0].kind, "url");
  assertEquals(
    res[0].text,
    "https://en.wikipedia.org/wiki/Master_Juba#England_tour,_1848",
  );
});

test("URL with percent-encoded path (Wikipedia Arabic)", () => {
  const text =
    "See https://ar.wikipedia.org/wiki/%D8%A7%D9%84%D9%85%D8%B9%D9%84%D9%85_%D8%AC%D9%88%D8%A8%D8%A7";
  const res = Duckling().extract(text);

  assertEquals(res[0].kind, "url");
  assertEquals(
    res[0].text,
    "https://ar.wikipedia.org/wiki/%D8%A7%D9%84%D9%85%D8%B9%D9%84%D9%85_%D8%AC%D9%88%D8%A8%D8%A7",
  );
});

test("URL with query params (Wikipedia create account)", () => {
  const text =
    "https://en.wikipedia.org/w/index.php?title=Special:CreateAccount&returnto=Master+Juba";
  const res = Duckling().extract(text);

  assertEquals(res[0].kind, "url");
  assertEquals(
    res[0].text,
    "https://en.wikipedia.org/w/index.php?title=Special:CreateAccount&returnto=Master+Juba",
  );
});

test("URL bare domain", () => {
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

test("URL bare domain with subdomain", () => {
  const res = Duckling().extract(
    "Check docs.example.org and my-site.example.com please",
  );

  assertEquals(
    res.map(({ text }) => text),
    ["docs.example.org", "my-site.example.com"],
  );
});

test("URL bare domain with path", () => {
  const res = Duckling().extract("See example.com/about for info");

  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "example.com/about");
  assertEquals(res[0].value, { url: "example.com/about" });
});

test("URL bare domain with port", () => {
  const res = Duckling().extract("Running at localhost.com:3000 now");

  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "localhost.com:3000");
  assertEquals(res[0].value, { url: "localhost.com:3000" });
});

test("URL prefers full URL over bare domain", () => {
  const res = Duckling().extract("Go to https://example.com/path please");

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "https://example.com/path");
  assertEquals(res[0].value, { url: "https://example.com/path" });
});

test("URL accepts active TLDs added since the old snapshot", () => {
  const res = Duckling().extract("radio.music");

  assertEquals(res.length, 1);
  assertEquals(res[0].text, "radio.music");
  assertEquals(res[0].value, { url: "radio.music" });
});

test("URL rejects retired and non-root TLDs as bare domains", () => {
  assertEquals(Duckling().extract("example.active"), []);
  assertEquals(Duckling().extract("example.an"), []);
});

test("URL accepts IDN TLDs in Punycode and Unicode", () => {
  const res = Duckling().extract("Visit example.xn--p1ai or example.рф");

  assertEquals(
    res.map(({ text }) => text),
    ["example.xn--p1ai", "example.рф"],
  );
});

test("URL prefers the longest overlapping TLD", () => {
  const res = Duckling([URL.parser]).extract("service.community");

  assertEquals(
    res.map(({ text }) => text),
    ["service.community"],
  );
});

test("URL matches case-insensitive TLDs in bare domains", () => {
  const res = Duckling([URL.parser]).extract("service.COM service.COMMUNITY");
  assertEquals(
    res.map(({ text }) => text),
    ["service.COM", "service.COMMUNITY"],
  );
});

test("URL full URL with localhost", () => {
  const res = Duckling().extract("http://localhost:3000/ is ready");
  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "http://localhost:3000/");
  assertEquals(res[0].value, { url: "http://localhost:3000/" });
});

test("URL full URL with IPv4 literal", () => {
  const res = Duckling().extract("Connect to https://127.0.0.1:8443/a for API");
  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "https://127.0.0.1:8443/a");
  assertEquals(res[0].value, { url: "https://127.0.0.1:8443/a" });
});

test("URL full URL with bracketed IPv6", () => {
  const res = Duckling().extract("Try https://[2001:db8::1]/x endpoint");
  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "https://[2001:db8::1]/x");
  assertEquals(res[0].value, { url: "https://[2001:db8::1]/x" });
});

test("URL accepts uppercase TLD and hyphens in full URL", () => {
  const res = Duckling().extract("Visit https://my-site.EXAMPLE.COM/ now");
  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "https://my-site.EXAMPLE.COM/");
  assertEquals(res[0].value, { url: "https://my-site.EXAMPLE.COM/" });
});

test("URL accepts Unicode label in full URL", () => {
  const res = Duckling().extract("See https://münchen.de/ page");
  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "https://münchen.de/");
  assertEquals(res[0].value, { url: "https://münchen.de/" });
});

test("URL accepts Punycode label in full URL", () => {
  const res = Duckling().extract("See https://xn--mnchen-3ya.de/ info");
  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "https://xn--mnchen-3ya.de/");
  assertEquals(res[0].value, { url: "https://xn--mnchen-3ya.de/" });
});

test("URL validates protocol-qualified hosts", () => {
  for (const host of [
    "localhost",
    "127.0.0.1",
    "[2001:db8::1]",
    "cafe\u0301.example",
  ]) {
    const result = URL.FullHost({ text: host, index: 0 });
    assertEquals(result.success, true, host);
    if (result.success) assertEquals(result.ctx.index, host.length, host);
  }

  for (const host of [
    "[garbage]",
    "[]",
    "999.999.999.999",
    "-example.com",
    "example-.com",
    "example..com",
    "example_com",
    `[${"1".repeat(1000)}]`,
  ]) {
    assertEquals(URL.FullHost({ text: host, index: 0 }).success, false, host);
  }
});

test("URL bounds DNS label and host lengths", () => {
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

  const bare253 = [label63, label63, label63, "a".repeat(57), "com"].join(".");
  const bare254 = bare253.replace(
    `${"a".repeat(57)}.com`,
    `${"a".repeat(58)}.com`,
  );
  assertEquals(URL.Domain({ text: bare253, index: 0 }).success, true);
  assertEquals(URL.Domain({ text: bare254, index: 0 }).success, false);
});

test("URL trims trailing unmatched closing punctuation from suffix", () => {
  const res = Duckling().extract("See https://example.com/a).");
  assertEquals(res[0].kind, "url");
  assertEquals(res[0].text, "https://example.com/a");
  assertEquals(res[0].value, { url: "https://example.com/a" });
});

test("URL trims unmatched quotes and preserves balanced brackets", () => {
  const res = Duckling([URL.parser]).extract(
    'See "https://example.com/a" and https://example.com/(a), then https://example.com...',
  );
  assertEquals(
    res.map(({ text }) => text),
    ["https://example.com/a", "https://example.com/(a)", "https://example.com"],
  );
});

test("URL preserves a trailing slash before sentence punctuation", () => {
  assertEquals(
    Duckling([URL.parser])
      .extract('https://example.com/. "https://example.com/"')
      .map(({ text }) => text),
    ["https://example.com/", "https://example.com/"],
  );
  assertEquals(URL.Suffix({ text: "/", index: 0 }).success, true);
  assertEquals(URL.Suffix({ text: "?", index: 0 }).success, false);
  assertEquals(URL.Suffix({ text: "#", index: 0 }).success, false);
});

test("URL leaves empty query and fragment delimiters as punctuation", () => {
  const res = Duckling([URL.parser]).extract(
    "https://example.com? https://example.org/path# https://example.net/? https://example.edu/#",
  );
  assertEquals(
    res.map(({ text }) => text),
    [
      "https://example.com",
      "https://example.org/path",
      "https://example.net/",
      "https://example.edu/",
    ],
  );
});

test("URL preserves internal punctuation and unmatched opening brackets", () => {
  const res = Duckling([URL.parser]).extract(
    "https://example.com/a..b https://example.org/a?!b https://example.net/a(b https://example.edu/a(b)c https://en.wikipedia.org/wiki/Function_((mathematics))",
  );
  assertEquals(
    res.map(({ text }) => text),
    [
      "https://example.com/a..b",
      "https://example.org/a?!b",
      "https://example.net/a(b",
      "https://example.edu/a(b)c",
      "https://en.wikipedia.org/wiki/Function_((mathematics))",
    ],
  );
});

test("URL preserves a valid port before a terminal period", () => {
  const res = Duckling([URL.parser]).extract(
    "http://example.com:8080. http://example.org:8080... http://localhost.:8080…",
  );
  assertEquals(
    res.map(({ text }) => text),
    [
      "http://example.com:8080",
      "http://example.org:8080",
      "http://localhost.:8080",
    ],
  );
});

test("URL rejects decimal port :1.5", () => {
  assertEquals(Duckling([URL.parser]).extract("http://example.com:1.5"), []);
});

test("URL rejects out-of-range port :65536", () => {
  assertEquals(
    Duckling([URL.parser]).extract("http://example.com:65536 end"),
    [],
  );
});

test("URL validates integer port boundaries", () => {
  for (const port of ["1", "65535"]) {
    const result = URL.Port({ text: port, index: 0 });
    assertEquals(result.success, true, port);
    if (result.success) assertEquals(result.ctx.index, port.length, port);
  }
  for (const port of ["0", "65536", "1.5", "abc", "9".repeat(1000)]) {
    assertEquals(URL.Port({ text: port, index: 0 }).success, false, port);
  }
});

test("URL accepts trailing combining marks in Unicode labels", () => {
  for (const host of ["a\u0338.com", "\u0915\u094d.com"]) {
    const result = URL.FullHost({ text: host, index: 0 });
    assertEquals(result.success, true, host);
    if (result.success) assertEquals(result.ctx.index, host.length, host);
  }

  for (const host of ["\u0338a.com", "\u094d\u0915.com"]) {
    assertEquals(URL.FullHost({ text: host, index: 0 }).success, false, host);
  }
});

test("URL recognizes Markdown and Unicode text boundaries", () => {
  const res = Duckling([URL.parser]).extract(
    "`https://example.com/a` https://example.org/b—details https://example.net/c…more",
  );
  assertEquals(
    res.map(({ text }) => text),
    ["https://example.com/a", "https://example.org/b", "https://example.net/c"],
  );

  assertEquals(
    URL.FullHost({ text: "example.com@user", index: 0 }).success,
    false,
  );
});

test("URL rejects starts attached to astral Unicode words", () => {
  for (const text of [
    "\u{10400}https://example.com",
    "\u{1e800}https://example.com",
  ]) {
    assertEquals(Duckling([URL.parser]).extract(text), [], text);
  }
});

test("URL separates adjacent links and markup", () => {
  const res = Duckling([URL.parser]).extract(
    "[one](https://a.com/x)[two](https://b.com/y) https://c.com/a,https://d.com/b https://e.com/c.https://f.com/d <a>https://g.com/x</a>",
  );
  assertEquals(
    res.map(({ text }) => text),
    [
      "https://a.com/x",
      "https://b.com/y",
      "https://c.com/a",
      "https://d.com/b",
      "https://e.com/c",
      "https://f.com/d",
      "https://g.com/x",
    ],
  );
});

test("URL rejects partial matches from invalid attached authorities", () => {
  for (const text of [
    "https://user:pass@example.com/path",
    "https://%zz.example.com/path",
    "https://!example.com/path",
    "https://[::1].evil",
    "https://[::1]._evil/path",
    "http://example.com:1.5",
    "http://example.com:65536",
  ]) {
    assertEquals(Duckling([URL.parser]).extract(text), [], text);
  }

  for (const separator of ["%", ":", "+", "&", "=", "(", "["]) {
    const text = `https://${"x".repeat(300)}${separator}example.com/path`;
    assertEquals(Duckling([URL.parser]).extract(text), [], text);
  }
});

test("URL accepts a terminal DNS root dot before authority delimiters", () => {
  const res = Duckling([URL.parser]).extract(
    "https://example.com./path http://localhost.:8080/ example.com./path example.org.:8080/path example.net.?q=1",
  );
  assertEquals(
    res.map(({ text }) => text),
    [
      "https://example.com./path",
      "http://localhost.:8080/",
      "example.com./path",
      "example.org.:8080/path",
      "example.net.?q=1",
    ],
  );
});

test("URL accepts ordinary punctuation before bare domains", () => {
  const res = Duckling([URL.parser]).extract(
    "Website:example.com See...example.org/path https://localhost,example.net https://localhost!example.edu https://localhost<example.gov",
  );
  assertEquals(
    res.map(({ text }) => text),
    [
      "example.com",
      "example.org/path",
      "https://localhost",
      "example.net",
      "https://localhost",
      "example.edu",
      "https://localhost",
      "example.gov",
    ],
  );
});

test("URL trims an enclosing apostrophe after an internal apostrophe", () => {
  const res = Duckling([URL.parser]).extract(
    "See 'https://example.com/O'Brien' now",
  );
  assertEquals(
    res.map(({ text }) => text),
    ["https://example.com/O'Brien"],
  );
});

test("URL matches canonically equivalent Unicode TLDs", () => {
  const domain = "example.vermo\u0308gensberater";
  assertEquals(
    Duckling([URL.parser])
      .extract(domain)
      .map(({ text }) => text),
    [domain],
  );
});
