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

test("URL accepts underscores inside protocol-qualified hosts", () => {
  const res = Duckling([URL.parser]).extract(
    "https://foo_bar.example.com/path http://my_service.localhost:3000/",
  );
  assertEquals(
    res.map(({ text }) => text),
    ["https://foo_bar.example.com/path", "http://my_service.localhost:3000/"],
  );
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

test("URL accepts percent-encoded labels in full URLs", () => {
  const urls = [
    "http://%65xample.com/",
    "https://ex%61mple.com/path",
    "ftp://example%2ecom/file",
    "https://%65xample。com/path",
    "https://example%2ecom。cn/path",
    "https://example.com%2e/path",
    "https://example.com%E3%80%82/path",
    "https://example.com%EF%BC%8E/path",
    "https://example.com%EF%BD%A1/path",
  ];
  assertEquals(
    Duckling([URL.parser])
      .extract(urls.join(" "))
      .map(({ text }) => text),
    urls,
  );
});

test("URL validates protocol-qualified hosts", () => {
  for (const host of [
    "localhost",
    "127.0.0.1",
    "[2001:db8::1]",
    "cafe\u0301.example",
    "example_com",
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

test("URL trims sentence colons from suffixes", () => {
  const res = Duckling([URL.parser]).extract(
    "See https://example.com/path: next https://example.org/?q=value: and https://example.net/#section:) plus https://example.edu/a:b. https://example.gov/a:: next",
  );
  assertEquals(
    res.map(({ text }) => text),
    [
      "https://example.com/path",
      "https://example.org/?q=value",
      "https://example.net/#section",
      "https://example.edu/a:b",
      "https://example.gov/a",
    ],
  );

  const incomplete = URL.Suffix({ text: "/path:", index: 0, final: false });
  assertEquals(incomplete.success, false);
  assertEquals("pending" in incomplete && incomplete.pending, true);
});

test("URL preserves colons before internal suffix punctuation", () => {
  const urls = [
    "https://example.com/a:(b)",
    "https://example.com/?q=a:,b",
    "https://example.com/#a:;b",
    "https://example.com/O:'Brien",
    "https://example.com/a:，_b",
    "https://example.com/a,:b",
    "https://example.com/a):b",
    "https://example.com/a?:b",
    "https://example.com/a:)b",
    "https://example.com/a:,)b",
    "https://example.com/a:)(b)",
    "https://example.com/a::b",
    "https://example.com/a):)b",
    "https://example.com/?q=a]:]b",
    "https://example.com/#a}:}b",
    "https://example.com/a:):)b",
  ];
  assertEquals(
    Duckling([URL.parser])
      .extract(urls.join(" "))
      .map(({ text }) => text),
    urls,
  );
});

test("URL trims mixed terminal punctuation containing colons", () => {
  const cases: Array<[string, string[]]> = [
    ["https://example.com/a.: next", ["https://example.com/a"]],
    ["https://example.com/a?: next", ["https://example.com/a"]],
    ["https://example.com/a:. next", ["https://example.com/a"]],
    ["https://a.com/x:https://b.com/y", ["https://a.com/x", "https://b.com/y"]],
    [
      "https://a.com/x:)https://b.com/y",
      ["https://a.com/x", "https://b.com/y"],
    ],
    [
      "https://a.com/x?:),https://b.com/y",
      ["https://a.com/x", "https://b.com/y"],
    ],
  ];
  for (const [input, expected] of cases) {
    assertEquals(
      Duckling([URL.parser])
        .extract(input)
        .map(({ text }) => text),
      expected,
      input,
    );
  }
});

test("URL preserves internal punctuation and unmatched opening brackets", () => {
  const res = Duckling([URL.parser]).extract(
    "https://example.com/a..b https://example.org/a?!b https://example.net/a(b https://example.edu/a(b)c https://en.wikipedia.org/wiki/Function_((mathematics)) https://example.gov/(((a)))",
  );
  assertEquals(
    res.map(({ text }) => text),
    [
      "https://example.com/a..b",
      "https://example.org/a?!b",
      "https://example.net/a(b",
      "https://example.edu/a(b)c",
      "https://en.wikipedia.org/wiki/Function_((mathematics))",
      "https://example.gov/(((a)))",
    ],
  );
});

test("URL preserves unmatched closing brackets inside suffixes", () => {
  const res = Duckling([URL.parser]).extract(
    "https://example.com/a)b https://example.org/a]]b https://example.net/a).b https://example.edu/a)?b https://example.gov/a)(b https://example.io/a)]b https://example.dev/a])b",
  );
  assertEquals(
    res.map(({ text }) => text),
    [
      "https://example.com/a)b",
      "https://example.org/a]]b",
      "https://example.net/a).b",
      "https://example.edu/a)?b",
      "https://example.gov/a)(b",
      "https://example.io/a)]b",
      "https://example.dev/a])b",
    ],
  );
});

test("URL preserves deeply nested balanced groups", () => {
  const depth = 3_000;
  const input = `https://example.com/${"(".repeat(depth)}a${")".repeat(depth)}`;
  assertEquals(
    Duckling([URL.parser])
      .extract(input)
      .map(({ text }) => text),
    [input],
  );
});

test("URL only keeps incomplete balanced groups pending", () => {
  for (const text of ["/abc next", "/(a) next"]) {
    const result = URL.Suffix({ text, index: 0, final: false });
    assertEquals(result.success, true, text);
  }

  const incomplete = URL.Suffix({ text: "/(a", index: 0, final: false });
  assertEquals(incomplete.success, false);
  assertEquals("pending" in incomplete && incomplete.pending, true);
});

test("URL completes unmatched groups at definitive streaming boundaries", () => {
  for (const [text, expected] of [
    ["/(a next", "/(a"],
    ["/(a—next", "/(a"],
    ["/(foo,https://b.com/bar)", "/(foo"],
  ]) {
    const result = URL.Suffix({ text, index: 0, final: false });
    assertEquals(result.success, true, text);
    if (result.success) assertEquals(result.value, expected, text);
  }
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

test("URL preserves a valid port before a sentence colon", () => {
  const res = Duckling([URL.parser]).extract(
    "Server http://localhost:8080: ready; mirror https://example.com:0: ready",
  );
  assertEquals(
    res.map(({ text }) => text),
    ["http://localhost:8080", "https://example.com:0"],
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
  for (const port of ["0", "1", "65535"]) {
    const result = URL.Port({ text: port, index: 0 });
    assertEquals(result.success, true, port);
    if (result.success) assertEquals(result.ctx.index, port.length, port);
  }
  for (const port of ["", "65536", "1.5", "abc", "9".repeat(1000)]) {
    assertEquals(URL.Port({ text: port, index: 0 }).success, false, port);
  }
});

test("URL accepts port zero", () => {
  const res = Duckling([URL.parser]).extract(
    "http://localhost:0/ example.com:0/path https://example.org:000000/",
  );
  assertEquals(
    res.map(({ text }) => text),
    [
      "http://localhost:0/",
      "example.com:0/path",
      "https://example.org:000000/",
    ],
  );
});

test("URL accepts zero-padded ports by numeric value", () => {
  const res = Duckling([URL.parser]).extract(
    "http://localhost:000080/ https://example.com:000001/path",
  );
  assertEquals(
    res.map(({ text }) => text),
    ["http://localhost:000080/", "https://example.com:000001/path"],
  );

  const port = URL.Port({ text: "000080", index: 0 });
  assertEquals(port.success, true);
  if (port.success) assertEquals(port.value, 80);
});

test("URL treats compatibility periods after ports as prose boundaries", () => {
  const res = Duckling([URL.parser]).extract(
    "http://example.com:8080。谢谢 http://localhost:000080．继续",
  );
  assertEquals(
    res.map(({ text }) => text),
    ["http://example.com:8080", "http://localhost:000080"],
  );
});

test("URL rejects IDN hostname continuations after ports", () => {
  for (const separator of ["。", "．", "｡"]) {
    for (const tail of ["中国/path", "例子.中国/path"]) {
      const input = `http://example.com:80${separator}${tail}`;
      assertEquals(Duckling([URL.parser]).extract(input), [], input);
    }
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

test("URL validates decomposed hosts after normalization", () => {
  const label = "e\u0301".repeat(25);
  const input = `https://${Array(5).fill(label).join(".")}/`;
  const longRawLabelInput = `https://${"e\u0301".repeat(32)}.com/`;
  assertEquals(
    Duckling([URL.parser])
      .extract(`${input} ${longRawLabelInput}`)
      .map(({ text }) => text),
    [input, longRawLabelInput],
  );
});

test("URL validates contextual IDNA characters", () => {
  const accepted = [
    "l·l.cat",
    "क्‍ष.com",
    "نامه‌ای.com",
    "·a.com",
    "͵α.com",
    "׳א.com",
    "״א.com",
    "・例.com",
  ];
  const input = accepted
    .flatMap((host) => [`https://${host}/`, host])
    .join(" ");
  assertEquals(
    Duckling([URL.parser])
      .extract(input)
      .map(({ text }) => text),
    accepted.flatMap((host) => [`https://${host}/`, host]),
  );

  for (const host of ["क‍ष.com", "نامه‍ای.com"]) {
    assertEquals(Duckling([URL.parser]).extract(`https://${host}/`), [], host);
    assertEquals(Duckling([URL.parser]).extract(host), [], host);
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

test("URL recognizes CJK and full-width text boundaries", () => {
  const res = Duckling([URL.parser]).extract(
    "请访问 https://example.com。谢谢 「https://example.org」 https://example.net！ https://example.edu．继续 ＂https://example.gov＂ https://example。com。谢谢",
  );
  assertEquals(
    res.map(({ text }) => text),
    [
      "https://example.com",
      "https://example.org",
      "https://example.net",
      "https://example.edu",
      "https://example.gov",
      "https://example。com",
    ],
  );
});

test("URL accepts compatibility dots inside registered domains", () => {
  const urls = [
    "https://example。com/path",
    "https://example．com/path",
    "https://example｡com/path",
    "https://example。invalid/path",
    "https://www.google.com。cn/path",
    "https://example.com。invalid/path",
    "https://www.google.com。internal。cn/path",
    "https://www.google.com。内部。cn/path",
    "http://localhost。internal/path",
    "https://127.0.0.1。example/path",
    "https://foo.localhost。com/path",
    "https://foo127.0.0.1。com/path",
    "https://example.ⓒⓞⓜ/path",
  ];
  assertEquals(
    Duckling([URL.parser])
      .extract(urls.join(" "))
      .map(({ text }) => text),
    urls,
  );

  assertEquals(
    Duckling([URL.parser]).extract("https://999。999。999。999/path"),
    [],
  );
});

test("URL treats terminal compatibility dots as punctuation", () => {
  const res = Duckling([URL.parser]).extract(
    "http://localhost。 https://example.invalid． https://[::1]｡谢谢",
  );
  assertEquals(
    res.map(({ text }) => text),
    ["http://localhost", "https://example.invalid", "https://[::1]"],
  );
});

test("URL preserves CJK punctuation inside suffixes", () => {
  const urls = [
    "https://example.com/こんにちは、世界",
    "https://example.com/?q=你好，世界",
    "https://example.com/a。b",
    "https://example.com/a。_b",
    "https://example.com/?q=a，_b",
  ];
  assertEquals(
    Duckling([URL.parser])
      .extract(`${urls.join(" ")} https://example.org/path。`)
      .map(({ text }) => text),
    [...urls, "https://example.org/path"],
  );

  assertEquals(
    Duckling([URL.parser])
      .extract("https://example.com/path。谢谢")
      .map(({ text }) => text),
    ["https://example.com/path"],
  );

  assertEquals(
    Duckling([URL.parser])
      .extract(
        "请访问 https://example.com/路径。谢谢 https://example.org/?q=路径！继续",
      )
      .map(({ text }) => text),
    ["https://example.com/路径", "https://example.org/?q=路径"],
  );

  assertEquals(
    Duckling([URL.parser])
      .extract(
        "https://example.com/😀。谢谢 https://example.org/©！继续 https://example.net/?q=✓？完成",
      )
      .map(({ text }) => text),
    [
      "https://example.com/😀",
      "https://example.org/©",
      "https://example.net/?q=✓",
    ],
  );
});

test("URL treats repeated periods as sentence punctuation", () => {
  const res = Duckling([URL.parser]).extract(
    "See https://example.com...next and https://example.org..more http://intranet...next http://LOCALHOST..more",
  );
  assertEquals(
    res.map(({ text }) => text),
    [
      "https://example.com",
      "https://example.org",
      "http://intranet",
      "http://LOCALHOST",
    ],
  );
});

test("URL treats opening brackets as text boundaries", () => {
  const res = Duckling([URL.parser]).extract(
    "See https://example.com[1] example.org(note) example.net{draft}",
  );
  assertEquals(
    res.map(({ text }) => text),
    ["https://example.com", "example.org", "example.net"],
  );
});

test("URL treats safe bare-domain delimiters consistently on long lines", () => {
  for (const delimiter of ["=", "$", "+", "\u201c"]) {
    const text = `${"A".repeat(300)}${delimiter}example.com`;
    assertEquals(
      Duckling([URL.parser])
        .extract(text)
        .map(({ text: value }) => value),
      ["example.com"],
      delimiter,
    );
  }
});

test("URL rejects starts attached to Unicode words and connectors", () => {
  for (const text of [
    "\u{10400}https://example.com",
    "\u{1e800}https://example.com",
    "foo_https://example.com",
    "foo\u203fhttps://example.com",
  ]) {
    assertEquals(Duckling([URL.parser]).extract(text), [], text);
    const start = text.indexOf("https");
    assertEquals(URL.Full({ text, index: start }).success, false, text);
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

test("URL separates links used as Markdown text and destinations", () => {
  const res = Duckling([URL.parser]).extract(
    "[https://example.com/a](https://target.example/b)",
  );
  assertEquals(
    res.map(({ text }) => text),
    ["https://example.com/a", "https://target.example/b"],
  );
});

test("URL separates adjacent parenthesized links", () => {
  const res = Duckling([URL.parser]).extract(
    "(https://a.com/x)(https://b.com/y)",
  );
  assertEquals(
    res.map(({ text }) => text),
    ["https://a.com/x", "https://b.com/y"],
  );
});

test("URL stops unmatched groups before adjacent links", () => {
  const res = Duckling([URL.parser]).extract(
    "https://a.com/(foo,https://b.com/bar)",
  );
  assertEquals(
    res.map(({ text }) => text),
    ["https://a.com/(foo", "https://b.com/bar"],
  );
});

test("URL stops balanced groups before bracket-delimited links", () => {
  const res = Duckling([URL.parser]).extract(
    "https://a.com/path[link](https://b.com/target)",
  );
  assertEquals(
    res.map(({ text }) => text),
    ["https://a.com/path[link]", "https://b.com/target"],
  );
});

test("URL separates period-delimited host-only links", () => {
  const res = Duckling([URL.parser]).extract(
    "http://localhost.http://example.com https://127.0.0.1.https://[::1]",
  );
  assertEquals(
    res.map(({ text }) => text),
    [
      "http://localhost",
      "http://example.com",
      "https://127.0.0.1",
      "https://[::1]",
    ],
  );
});

test("URL rejects partial matches from invalid attached authorities", () => {
  for (const text of [
    "https://user:pass@example.com/path",
    "https://example.com。:abc.com/x",
    "https://localhost｡:80evil.com",
    "example.com。:abc.com/x",
    "https://example.com。。?next.com",
    "https://example.com。:80。evil.com/x",
    "https://[::1]。。?next.com",
    "https://[::1]:80。。#next.com",
    "https://[::1]:000080。。:abc.com/x",
    "https://example.com:1.5。。?next.com",
    "https://localhost:1.5。。#next.com",
    "https://example.invalid。。?next.com",
    "http://intranet。.#next.com",
    "https://user:pass@example.com。。?next.com",
    `https://${"x".repeat(300)}。.#next.com`,
    `https://${"x".repeat(300)}++example.com/path`,
    `https://${"x".repeat(64)}\u201cexample.com/path`,
    `https://${"x".repeat(64)}+]example.com/path`,
    `https://${"x".repeat(64)}+。example.com/path`,
    "https://;.;example.org/path",
    "https://[/],example.org/path",
    `https://${Array.from({ length: 4 }, () => "%61".repeat(60)).join(".")}:80。evil.com/path`,
    "https://user:pass@example.com\u201cexample.org/path",
    "https://example.com:65536\u201cexample.org/path",
    "https://example.com:1.5\u201cexample.org/path",
    "https://[::1]evil\u201cexample.org/path",
    "https://127.0.0.1:1.5。.:abc.com/x",
    "https://example.com:80。。?next.com",
    "https://example.com:80。。#next.com",
    "https://example.com:80。。:abc.com/x",
    "https://example.com:80。.:abc.com/x",
    "https://%zz.example.com/path",
    "https://example%6x.com/path",
    "https://%2dexample.com/path",
    "https://example%2d.com/path",
    "https://example.com%2e./path",
    "https://example.com%2E.:8080/path",
    "https://example.com%E3%80%82./path",
    "https://example.com%EF%BC%8E./path",
    "https://example.com%EF%BD%A1./path",
    "https://!example.com/path",
    "https://[::1].evil",
    "https://[::1]._evil/path",
    "http://localhost:80@evil.com",
    "http://127.0.0.1:80@evil.com",
    "http://[::1]:80@evil.com",
    "http://localhost:000080。evil.com",
    "http://[::1]:80.evil.com",
    "http://[::1]:80。evil.com",
    "http://[::1]:80evil.com",
    "http://[::1]evil.com",
    "http://[::1]example.org/path",
    "http://example.com../path",
    "http://localhost../path",
    "http://127.0.0.1../path",
    "http://example.com..:8080/path",
    "http://example.com..?query",
    "http://example.com..#fragment",
    "http://example.com..?next.com",
    "http://example.com..#next.com",
    "http://example.com..\\evil.com",
    "example.com..:next.org",
    "example.com..\\next.org",
    `https://${"x".repeat(300)}..?next.com`,
    `https://${"x".repeat(300)}..#next.com`,
    "http://example.com:1.5",
    "http://example.com:65536",
  ]) {
    assertEquals(Duckling([URL.parser]).extract(text), [], text);
  }

  for (const separator of ["%", ":", "+", "&", "=", "(", "["]) {
    const text = `https://${"x".repeat(300)}${separator}example.com/path`;
    assertEquals(Duckling([URL.parser]).extract(text), [], text);
  }

  for (const first of [".", "。", "．", "｡"]) {
    for (const second of [".", "。", "．", "｡"]) {
      if (first === "." && second === ".") continue;
      const text = `https://example.com${first}${second}/path`;
      assertEquals(Duckling([URL.parser]).extract(text), [], text);
    }
  }

  for (const dots of ["..。", "..．", "..｡"]) {
    for (const continuation of [
      "/path",
      "?next.com",
      "#next.com",
      ":8080/path",
    ]) {
      const text = `https://example.com${dots}${continuation}`;
      assertEquals(Duckling([URL.parser]).extract(text), [], text);
    }
  }
});

test("URL accepts a terminal DNS root dot before authority delimiters", () => {
  const res = Duckling([URL.parser]).extract(
    "https://example.com./path http://localhost.:8080/ example.com./path example.org.:8080/path example.net.?q=1 https://example.com。/path https://example.com．?q=1 https://example.com｡:8080/path",
  );
  assertEquals(
    res.map(({ text }) => text),
    [
      "https://example.com./path",
      "http://localhost.:8080/",
      "example.com./path",
      "example.org.:8080/path",
      "example.net.?q=1",
      "https://example.com。/path",
      "https://example.com．?q=1",
      "https://example.com｡:8080/path",
    ],
  );
});

test("URL accepts ordinary punctuation before bare domains", () => {
  const res = Duckling([URL.parser]).extract(
    "Website:example.com See...example.org/path https://localhost,example.net https://localhost!example.edu https://localhost<example.gov See...?example.io Wait..#example.dev https://a.com]example.info/path https://[::1]!example.biz/path",
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
      "example.io",
      "example.dev",
      "https://a.com",
      "example.info/path",
      "https://[::1]",
      "example.biz/path",
    ],
  );
});

test("URL separates domains after schemes inside query values", () => {
  const first = `https://a.com/?next=https://${"x".repeat(64)}`;
  const second = "https://b.com/?next=ftp://[garbage]";
  const third = `https://c.com/?next=https://${"x".repeat(64)}`;
  const res = Duckling([URL.parser]).extract(
    `${first}\u201cexample.org/path ${second}\u201cexample.net/path ${third},\u201cexample.info/path`,
  );
  assertEquals(
    res.map(({ text }) => text),
    [
      first,
      "example.org/path",
      second,
      "example.net/path",
      third,
      "example.info/path",
    ],
  );
});

test("URL separates domains after schemes inside balanced suffix groups", () => {
  const first = `https://a.com/?x=(foo-https://${"x".repeat(64)})`;
  const second = `https://b.com/?next=x(y)-https://${"x".repeat(64)}`;
  const res = Duckling([URL.parser]).extract(
    `${first}\u201cexample.org/path ${second}\u201cexample.net/path`,
  );
  assertEquals(
    res.map(({ text }) => text),
    [first, "example.org/path", second, "example.net/path"],
  );
});

test("URL keeps external wrappers outside nested completion checks", () => {
  const first = `https://a.com/?next=https://${"x".repeat(64)}`;
  const res = Duckling([URL.parser]).extract(
    `(${first})\u201cexample.org/path [${first}]\u201cexample.net/path`,
  );
  assertEquals(
    res.map(({ text }) => text),
    [first, "example.org/path", first, "example.net/path"],
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

test("URL matches compatibility-normalized bare TLDs", () => {
  const domains = ["example.ｃｏｍ", "example.ⓓⓔ", "example.com。cn"];
  assertEquals(
    Duckling([URL.parser])
      .extract(domains.join(" "))
      .map(({ text }) => text),
    domains,
  );
});
