import { assertEquals } from "@std/assert";
import { Duckling, IPAddress } from "../mod.ts";

Deno.test("IPv4", () => {
  const res = Duckling([IPAddress.parser]).extract("ping 192.168.0.1 please");

  assertEquals(res, [
    {
      start: 5,
      end: 16,
      kind: "ip",
      text: "192.168.0.1",
      value: {
        ip: "192.168.0.1",
        version: 4,
      },
    },
  ]);
});

Deno.test("IPv4 invalid octet does not parse", () => {
  const res = Duckling([IPAddress.parser]).extract("ping 999.1.1.1 please");

  assertEquals(res, []);
});

Deno.test("IPv4 followed by fifth octet is rejected", () => {
  const res = Duckling([IPAddress.parser]).extract("192.168.0.1.5");
  assertEquals(res, []);
});

Deno.test("IPv4 malformed continuations do not expose a valid suffix", () => {
  for (
    const input of [
      "999.192.168.0.1",
      "192.168.0.1.example",
      "::ffff:192.0.2.128.5",
    ]
  ) {
    assertEquals(
      Duckling([IPAddress.parser]).extract(input),
      [],
      `expected no match for: ${input}`,
    );
  }
});

Deno.test("IPv4 at end of sentence (trailing period) still matches", () => {
  const res = Duckling([IPAddress.parser]).extract("Connect to 192.168.0.1.");
  assertEquals(res.length, 1);
  assertEquals(res[0].value.ip, "192.168.0.1");
});

Deno.test("IPv6 full form", () => {
  const res = Duckling([IPAddress.parser]).extract(
    "addr 2001:0db8:85a3:0000:0000:8a2e:0370:7334 ok",
  );

  assertEquals(res, [
    {
      start: 5,
      end: 44,
      kind: "ip",
      text: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
      value: {
        ip: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        version: 6,
      },
    },
  ]);
});

Deno.test("IPv6 full form with extra ninth group is rejected", () => {
  // 9 colon-separated groups — parser must not yield the first 8 as a prefix
  const res = Duckling([IPAddress.parser]).extract(
    "1:2:3:4:5:6:7:8:9",
  );
  assertEquals(res, []);
});

Deno.test("IPv6 full form rejects an IPv4-style continuation", () => {
  const res = Duckling([IPAddress.parser]).extract("1:2:3:4:5:6:7:8.9");
  assertEquals(res, []);
});

Deno.test("IPv6 full form at end of sentence still matches", () => {
  const res = Duckling([IPAddress.parser]).extract("Use 1:2:3:4:5:6:7:8.");
  assertEquals(res.map((entity) => entity.text), ["1:2:3:4:5:6:7:8"]);
});

Deno.test("invalid compressed IPv6 group counts do not expose a valid suffix", () => {
  for (
    const input of [
      "1:2:3:4:5:6:7::8",
      "1:2:3:4:5:6::192.0.2.1",
    ]
  ) {
    assertEquals(
      Duckling([IPAddress.parser]).extract(input),
      [],
      `expected no match for: ${input}`,
    );
  }
});

Deno.test("IPv6 compressed loopback ::1", () => {
  const res = Duckling([IPAddress.parser]).extract("lo ::1 ok");
  assertEquals(res.length, 1);
  assertEquals(res[0].value.ip, "::1");
  assertEquals(res[0].value.version, 6);
});

Deno.test("IPv6 compressed loopback ::1 at end of sentence still matches", () => {
  const res = Duckling([IPAddress.parser]).extract("the loopback is ::1.");
  assertEquals(res.length, 1);
  assertEquals(res[0].value.ip, "::1");
});

Deno.test("IPv6 compressed 2001:db8::1", () => {
  const res = Duckling([IPAddress.parser]).extract("addr 2001:db8::1 ok");
  assertEquals(res.length, 1);
  assertEquals(res[0].value.ip, "2001:db8::1");
  assertEquals(res[0].value.version, 6);
});

Deno.test("IPv6 compressed fe80::1", () => {
  const res = Duckling([IPAddress.parser]).extract("link fe80::1 ok");
  assertEquals(res.length, 1);
  assertEquals(res[0].value.ip, "fe80::1");
  assertEquals(res[0].value.version, 6);
});

Deno.test("IPv6 compressed all-zeros ::", () => {
  const res = Duckling([IPAddress.parser]).extract("unspecified :: ok");
  assertEquals(res.length, 1);
  assertEquals(res[0].value.ip, "::");
  assertEquals(res[0].value.version, 6);
});

Deno.test("IPv6 compressed followed by extra colon group is rejected", () => {
  // ::1: — the trailing colon would form an additional group
  const res = Duckling([IPAddress.parser]).extract("::1:");
  assertEquals(res, []);
});

Deno.test("IPv4-mapped IPv6 ::ffff:192.0.2.128", () => {
  const res = Duckling([IPAddress.parser]).extract(
    "mapped ::ffff:192.0.2.128 ok",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].kind, "ip");
  assertEquals(res[0].value.ip, "::ffff:192.0.2.128");
  assertEquals(res[0].value.version, 6);
  assertEquals(res[0].text, "::ffff:192.0.2.128");
});

Deno.test("IPv4-compatible IPv6 ::192.0.2.128", () => {
  const res = Duckling([IPAddress.parser]).extract("::192.0.2.128 ok");
  assertEquals(res.length, 1);
  assertEquals(res[0].value.ip, "::192.0.2.128");
  assertEquals(res[0].value.version, 6);
});

Deno.test("IPv4-mapped IPv6 with prefix 2001:db8::ffff:192.0.2.128", () => {
  const res = Duckling([IPAddress.parser]).extract(
    "2001:db8::ffff:192.0.2.128",
  );
  assertEquals(res.length, 1);
  assertEquals(res[0].value.ip, "2001:db8::ffff:192.0.2.128");
  assertEquals(res[0].value.version, 6);
});

Deno.test("IP parsers still accept common label separators", () => {
  const res = Duckling([IPAddress.parser]).extract(
    "IPv4:192.168.0.1 IPv6:2001:db8:85a3:0:0:8a2e:370:7334",
  );

  assertEquals(res.map((entity) => entity.text), [
    "192.168.0.1",
    "2001:db8:85a3:0:0:8a2e:370:7334",
  ]);
});
